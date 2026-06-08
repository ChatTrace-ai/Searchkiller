/**
 * Recycle Pattern Engine
 *
 * Orchestrates the full feedback loop:
 *   Human initializes Evaluator (HITL) → Evaluator runs autonomously
 *   Planner.plan() → Evaluator.evaluate() → route to golden/failures
 *
 * Also provides regression utilities:
 *   - Compare new traces against golden benchmarks
 *   - Pre-screen against known failure patterns
 */

import { plan, loadTrace, listTraces, type TraceRecord } from './planner';
import {
  evaluate,
  isInitialized,
  queryFailures,
  listGoldenBenchmarks,
  type EvaluationRecord,
} from './evaluator';
import { readFile } from 'fs/promises';
import { join } from 'path';

const GOLDEN_DIR = join(process.cwd(), '.agents', 'golden');

export interface RecycleResult {
  traceId: string;
  evaluation: EvaluationRecord;
  preScreenWarnings: string[];
  recycledTo: 'golden' | 'failures';
}

/**
 * Execute the full recycle loop in one step:
 * 1. Emit trace via Planner
 * 2. Pre-screen against known failure patterns
 * 3. Evaluate autonomously using HITL-initialized config
 * 4. Route to golden/ or failures/
 *
 * Requires the Evaluator to have been initialized via HITL.
 */
export async function recycle(
  keyword: string,
  subQueries: string[],
  meta?: Record<string, unknown>,
): Promise<RecycleResult> {
  if (!isInitialized()) {
    throw new Error(
      'Evaluator not initialized. Human must call POST /api/evaluate {action:"initialize"} first.',
    );
  }

  const planResult = await plan(keyword, subQueries, meta);

  const warnings: string[] = [];
  const similarFailures = await queryFailures(keyword);
  if (similarFailures.length > 0) {
    warnings.push(
      `Found ${similarFailures.length} similar failure(s): ${similarFailures.map((f) => f.root_cause).join(', ')}`,
    );
  }

  const evaluation = await evaluate(planResult.traceId);

  return {
    traceId: planResult.traceId,
    evaluation,
    preScreenWarnings: warnings,
    recycledTo: evaluation.verdict === 'APPROVED' ? 'golden' : 'failures',
  };
}

/**
 * Evaluate an existing trace (already emitted by Planner).
 * Use when the trace was created separately and needs evaluation.
 */
export async function evaluateExisting(
  traceId: string,
): Promise<RecycleResult> {
  if (!isInitialized()) {
    throw new Error(
      'Evaluator not initialized. Human must call POST /api/evaluate {action:"initialize"} first.',
    );
  }

  const trace = await loadTrace(traceId);
  const keyword = (trace.metadata?.keyword as string) ?? '';

  const warnings: string[] = [];
  const similarFailures = await queryFailures(keyword);
  if (similarFailures.length > 0) {
    warnings.push(
      `Found ${similarFailures.length} similar failure(s): ${similarFailures.map((f) => f.root_cause).join(', ')}`,
    );
  }

  const evaluation = await evaluate(traceId);

  return {
    traceId,
    evaluation,
    preScreenWarnings: warnings,
    recycledTo: evaluation.verdict === 'APPROVED' ? 'golden' : 'failures',
  };
}

/**
 * Run a regression check: compare a new trace's output hash against
 * all golden benchmarks with matching actions.
 */
export async function regressionCheck(
  traceId: string,
): Promise<{ matches: string[]; divergences: string[] }> {
  const trace = await loadTrace(traceId);
  const goldenIds = await listGoldenBenchmarks();

  const matches: string[] = [];
  const divergences: string[] = [];

  for (const gid of goldenIds) {
    try {
      const goldenEval = JSON.parse(
        await readFile(join(GOLDEN_DIR, `${gid}.json`), 'utf-8'),
      ) as EvaluationRecord;

      const goldenTrace = await loadTrace(goldenEval.trace_id);

      if (goldenTrace.action === trace.action) {
        if (goldenTrace.output_hash === trace.output_hash) {
          matches.push(gid);
        } else {
          divergences.push(gid);
        }
      }
    } catch {
      continue;
    }
  }

  return { matches, divergences };
}

/**
 * Get a summary of the recycle system state.
 */
export async function getRecycleStats(): Promise<{
  evaluatorInitialized: boolean;
  totalTraces: number;
  goldenCount: number;
  failureCount: number;
  pendingCount: number;
}> {
  const traceIds = await listTraces();
  const goldenIds = await listGoldenBenchmarks();

  let pendingCount = 0;
  for (const tid of traceIds) {
    try {
      const trace = await loadTrace(tid);
      if (trace.verdict === 'PENDING') pendingCount++;
    } catch {
      continue;
    }
  }

  const failurePatterns = await queryFailures('');

  return {
    evaluatorInitialized: isInitialized(),
    totalTraces: traceIds.length,
    goldenCount: goldenIds.length,
    failureCount: failurePatterns.length,
    pendingCount,
  };
}
