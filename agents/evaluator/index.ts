import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { TraceRecord } from '../planner';
import { loadHandoff, type HandoffDocument } from '../handoff';

export type Verdict = 'APPROVED' | 'REJECTED';

export interface EvaluatorConfig {
  initialized_by: string;
  initialized_at: string;
  criteria: {
    require_schema_valid: boolean;
    require_output_non_empty: boolean;
    reject_known_failure_patterns: boolean;
    custom_rules?: CustomRule[];
  };
  thresholds: {
    max_latency_ms?: number;
    min_source_count?: number;
    min_quality_score?: number;
  };
  playwright?: {
    enabled: boolean;
    suites: ('api' | 'ui' | 'state' | 'all')[];
    fail_on_test_failure: boolean;
  };
  auto_approve: boolean;
  notes?: string;
}

export interface CustomRule {
  name: string;
  field: string;
  operator: 'lt' | 'gt' | 'eq' | 'neq' | 'contains';
  value: unknown;
}

export interface PlaywrightResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  ok: boolean;
}

export interface QualityChecks {
  schema_valid: boolean;
  output_non_empty: boolean;
  no_known_failure_pattern: boolean;
  latency_acceptable: boolean;
  custom_checks: { rule: string; passed: boolean }[];
  playwright_checks: PlaywrightResult[];
  all_passed: boolean;
}

export interface EvaluationRecord {
  trace_id: string;
  verdict: Verdict;
  evaluated_at: string;
  evaluated_by: string;
  quality_checks: QualityChecks;
  config_snapshot: string;
  root_cause?: string;
  lesson?: string;
  notes?: string;
  handoffId?: string;
}

const AGENTS_DIR = join(process.cwd(), '.agents');
const TRACES_DIR = join(AGENTS_DIR, 'traces');
const GOLDEN_DIR = join(AGENTS_DIR, 'golden');
const FAILURES_DIR = join(AGENTS_DIR, 'failures');
const CONFIG_PATH = join(AGENTS_DIR, 'evaluator-config.json');

// ---------------------------------------------------------------------------
// HITL Initialization — the ONLY human-interactive surface
// ---------------------------------------------------------------------------

/**
 * Initialize the Evaluator via HITL.
 * The human defines criteria, thresholds, and rules. Once persisted,
 * the Evaluator runs autonomously using this configuration.
 */
export async function initializeEvaluator(
  config: Omit<EvaluatorConfig, 'initialized_at'>,
): Promise<EvaluatorConfig> {
  const full: EvaluatorConfig = {
    ...config,
    initialized_at: new Date().toISOString(),
  };
  await writeFile(CONFIG_PATH, JSON.stringify(full, null, 2), 'utf-8');
  return full;
}

/**
 * Load the current Evaluator configuration.
 * Throws if the Evaluator has not been initialized yet.
 */
export async function loadConfig(): Promise<EvaluatorConfig> {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      'Evaluator not initialized. Call initializeEvaluator() via HITL first.',
    );
  }
  const raw = await readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as EvaluatorConfig;
}

export function isInitialized(): boolean {
  return existsSync(CONFIG_PATH);
}

// ---------------------------------------------------------------------------
// Autonomous Evaluation — no human gate, config-driven
// ---------------------------------------------------------------------------

function resolveField(trace: TraceRecord, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = trace;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateCustomRule(trace: TraceRecord, rule: CustomRule): boolean {
  const actual = resolveField(trace, rule.field);
  switch (rule.operator) {
    case 'lt': return typeof actual === 'number' && actual < (rule.value as number);
    case 'gt': return typeof actual === 'number' && actual > (rule.value as number);
    case 'eq': return actual === rule.value;
    case 'neq': return actual !== rule.value;
    case 'contains':
      return typeof actual === 'string' && actual.includes(rule.value as string);
    default: return false;
  }
}

async function loadFailurePatterns(): Promise<EvaluationRecord[]> {
  try {
    const files = await readdir(FAILURES_DIR);
    const records: EvaluationRecord[] = [];
    for (const f of files.filter((f) => f.endsWith('.json'))) {
      const raw = await readFile(join(FAILURES_DIR, f), 'utf-8');
      records.push(JSON.parse(raw));
    }
    return records;
  } catch {
    return [];
  }
}

/**
 * Run quality checks against a trace using the persisted config.
 * Purely deterministic — no human interaction.
 */
export async function runQualityChecks(
  trace: TraceRecord,
  config: EvaluatorConfig,
): Promise<QualityChecks> {
  const schemaValid = Boolean(trace.id && trace.agent && trace.action && trace.timestamp);

  const outputNonEmpty = trace.output_hash !== '';

  const failurePatterns = await loadFailurePatterns();
  const inputKey = trace.metadata?.keyword as string | undefined;
  const noKnownPattern = !failurePatterns.some(
    (fp) => inputKey && fp.root_cause?.includes(inputKey),
  );

  const durationMs = trace.metadata?.duration_ms as number | undefined;
  const maxLatency = config.thresholds.max_latency_ms ?? 30_000;
  const latencyOk = durationMs == null || durationMs < maxLatency;

  const customChecks = (config.criteria.custom_rules ?? []).map((rule) => ({
    rule: rule.name,
    passed: evaluateCustomRule(trace, rule),
  }));

  const playwrightChecks: PlaywrightResult[] = [];
  if (config.playwright?.enabled) {
    const { runTestSuite } = await import('../mcp/playwright-bridge');
    for (const suite of config.playwright.suites) {
      try {
        const result = await runTestSuite(suite);
        playwrightChecks.push({
          suite: result.suite,
          passed: result.passed,
          failed: result.failed,
          skipped: result.skipped,
          ok: result.failed === 0,
        });
      } catch {
        playwrightChecks.push({
          suite,
          passed: 0,
          failed: 1,
          skipped: 0,
          ok: false,
        });
      }
    }
  }

  const playwrightOk = !config.playwright?.fail_on_test_failure ||
    playwrightChecks.every((c) => c.ok);

  const criteriaResults = [
    !config.criteria.require_schema_valid || schemaValid,
    !config.criteria.require_output_non_empty || outputNonEmpty,
    !config.criteria.reject_known_failure_patterns || noKnownPattern,
    latencyOk,
    ...customChecks.map((c) => c.passed),
    playwrightOk,
  ];

  return {
    schema_valid: schemaValid,
    output_non_empty: outputNonEmpty,
    no_known_failure_pattern: noKnownPattern,
    latency_acceptable: latencyOk,
    custom_checks: customChecks,
    playwright_checks: playwrightChecks,
    all_passed: criteriaResults.every(Boolean),
  };
}

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
 * Autonomously evaluate a trace using the HITL-initialized config.
 * No human gate — the verdict is determined entirely by the criteria
 * the human set during initialization.
 *
 * If the trace is linked to a HandoffDocument, the evaluation record
 * includes the handoffId for structured context access.
 */
export async function evaluate(traceId: string): Promise<EvaluationRecord> {
  const config = await loadConfig();

  const filepath = join(TRACES_DIR, `${traceId}.json`);
  const trace = JSON.parse(await readFile(filepath, 'utf-8')) as TraceRecord;

  const checks = await runQualityChecks(trace, config);

  let handoff: HandoffDocument | undefined;
  if (trace.handoffId) {
    try {
      handoff = await loadHandoff(trace.handoffId);
    } catch {
      // Handoff not found — continue without it
    }
  }

  let verdict: Verdict;
  let rootCause: string | undefined;
  let lesson: string | undefined;

  if (checks.all_passed && config.auto_approve) {
    verdict = 'APPROVED';
  } else if (!checks.all_passed) {
    verdict = 'REJECTED';
    const failures: string[] = [];
    if (!checks.schema_valid) failures.push('schema_invalid');
    if (!checks.output_non_empty) failures.push('empty_output');
    if (!checks.no_known_failure_pattern) failures.push('known_failure_pattern');
    if (!checks.latency_acceptable) failures.push('latency_exceeded');
    for (const c of checks.custom_checks) {
      if (!c.passed) failures.push(`custom:${c.rule}`);
    }
    rootCause = failures.join(', ');
    lesson = `Auto-rejected by evaluator config (initialized by ${config.initialized_by}): ${rootCause}`;
  } else {
    verdict = 'APPROVED';
  }

  const evaluation: EvaluationRecord = {
    trace_id: traceId,
    verdict,
    evaluated_at: new Date().toISOString(),
    evaluated_by: `evaluator:config:${config.initialized_by}`,
    quality_checks: checks,
    config_snapshot: config.initialized_at,
    root_cause: rootCause,
    lesson,
    handoffId: handoff?.id,
  };

  const targetDir = verdict === 'APPROVED' ? GOLDEN_DIR : FAILURES_DIR;
  await writeFile(
    join(targetDir, `${traceId}.json`),
    JSON.stringify(evaluation, null, 2),
    'utf-8',
  );

  await updateTraceVerdict(traceId, verdict);

  return evaluation;
}

// ---------------------------------------------------------------------------
// Query utilities
// ---------------------------------------------------------------------------

export async function queryFailures(
  rootCausePattern: string,
): Promise<EvaluationRecord[]> {
  const all = await loadFailurePatterns();
  if (!rootCausePattern) return all;
  return all.filter(
    (r) =>
      r.root_cause &&
      r.root_cause.toLowerCase().includes(rootCausePattern.toLowerCase()),
  );
}

export async function listGoldenBenchmarks(): Promise<string[]> {
  try {
    const files = await readdir(GOLDEN_DIR);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}
