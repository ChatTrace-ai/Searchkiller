import { readFile, writeFile, readdir, copyFile } from 'fs/promises';
import { join } from 'path';
import type { TraceRecord } from '../planner';

export type Verdict = 'APPROVED' | 'REJECTED';

export interface QualityChecks {
  schema_valid: boolean;
  output_non_empty: boolean;
  no_known_failure_pattern: boolean;
  latency_acceptable: boolean;
}

export interface EvaluationRecord {
  trace_id: string;
  verdict: Verdict;
  evaluated_at: string;
  evaluated_by: string;
  quality_checks: QualityChecks;
  root_cause?: string;
  lesson?: string;
  notes?: string;
}

export interface HITLSignal {
  verdict: Verdict;
  reviewer: string;
  root_cause?: string;
  lesson?: string;
  notes?: string;
}

const TRACES_DIR = join(process.cwd(), '.agents', 'traces');
const GOLDEN_DIR = join(process.cwd(), '.agents', 'golden');
const FAILURES_DIR = join(process.cwd(), '.agents', 'failures');

async function updateTraceVerdict(
  traceId: string,
  verdict: TraceRecord['verdict'],
): Promise<void> {
  const filepath = join(TRACES_DIR, `${traceId}.json`);
  const raw = await readFile(filepath, 'utf-8');
  const trace = JSON.parse(raw) as TraceRecord;
  trace.verdict = verdict;
  trace.agent = 'evaluator';
  await writeFile(filepath, JSON.stringify(trace, null, 2), 'utf-8');
}

/**
 * Run automated quality checks against a trace.
 * These run BEFORE the HITL gate — they inform but don't replace human judgment.
 */
export async function runQualityChecks(
  trace: TraceRecord,
): Promise<QualityChecks> {
  const failurePatterns = await loadFailurePatterns();
  const inputKey = trace.metadata?.keyword as string | undefined;

  const noKnownPattern = !failurePatterns.some(
    (fp) => inputKey && fp.root_cause?.includes(inputKey),
  );

  return {
    schema_valid: Boolean(
      trace.id && trace.agent && trace.action && trace.timestamp,
    ),
    output_non_empty: trace.output_hash !== '',
    no_known_failure_pattern: noKnownPattern,
    latency_acceptable:
      typeof trace.metadata?.duration_ms === 'number'
        ? trace.metadata.duration_ms < 30_000
        : true,
  };
}

async function loadFailurePatterns(): Promise<EvaluationRecord[]> {
  try {
    const files = await readdir(FAILURES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    const records: EvaluationRecord[] = [];
    for (const f of jsonFiles) {
      const raw = await readFile(join(FAILURES_DIR, f), 'utf-8');
      records.push(JSON.parse(raw));
    }
    return records;
  } catch {
    return [];
  }
}

/**
 * Begin evaluation: run quality checks, advance verdict to AWAITING_HUMAN.
 * Returns the quality check results for the HITL interface to display.
 */
export async function beginEvaluation(
  traceId: string,
): Promise<{ trace: TraceRecord; checks: QualityChecks }> {
  const filepath = join(TRACES_DIR, `${traceId}.json`);
  const raw = await readFile(filepath, 'utf-8');
  const trace = JSON.parse(raw) as TraceRecord;

  const checks = await runQualityChecks(trace);

  await updateTraceVerdict(traceId, 'AWAITING_HUMAN');

  return { trace, checks };
}

/**
 * Finalize evaluation with HITL signal. This is the ONLY path to a terminal verdict.
 * Routes the evaluation to golden/ (APPROVED) or failures/ (REJECTED).
 */
export async function finalizeEvaluation(
  traceId: string,
  signal: HITLSignal,
): Promise<EvaluationRecord> {
  const checks = await runQualityChecks(
    JSON.parse(
      await readFile(join(TRACES_DIR, `${traceId}.json`), 'utf-8'),
    ),
  );

  const evaluation: EvaluationRecord = {
    trace_id: traceId,
    verdict: signal.verdict,
    evaluated_at: new Date().toISOString(),
    evaluated_by: signal.reviewer,
    quality_checks: checks,
    notes: signal.notes,
  };

  if (signal.verdict === 'REJECTED') {
    if (!signal.root_cause || !signal.lesson) {
      throw new Error(
        'REJECTED verdicts require root_cause and lesson fields',
      );
    }
    evaluation.root_cause = signal.root_cause;
    evaluation.lesson = signal.lesson;
  }

  const targetDir =
    signal.verdict === 'APPROVED' ? GOLDEN_DIR : FAILURES_DIR;
  const evalPath = join(targetDir, `${traceId}.json`);
  await writeFile(evalPath, JSON.stringify(evaluation, null, 2), 'utf-8');

  await updateTraceVerdict(traceId, signal.verdict);

  return evaluation;
}

/**
 * Query the failure store for patterns matching a root cause substring.
 */
export async function queryFailures(
  rootCausePattern: string,
): Promise<EvaluationRecord[]> {
  const all = await loadFailurePatterns();
  return all.filter(
    (r) =>
      r.root_cause &&
      r.root_cause.toLowerCase().includes(rootCausePattern.toLowerCase()),
  );
}

/**
 * List all golden benchmark trace IDs.
 */
export async function listGoldenBenchmarks(): Promise<string[]> {
  try {
    const files = await readdir(GOLDEN_DIR);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}
