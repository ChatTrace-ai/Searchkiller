/**
 * Recycle Pattern Engine
 *
 * Orchestrates the full feedback loop:
 *   Planner.plan() → Evaluator.beginEvaluation() → HITL gate → route to store
 *
 * Also provides regression utilities:
 *   - Compare new traces against golden benchmarks
 *   - Pre-screen against known failure patterns
 */

import { plan, loadTrace, listTraces, type TraceRecord } from './planner';
import {
  beginEvaluation,
  finalizeEvaluation,
  queryFailures,
  listGoldenBenchmarks,
  type HITLSignal,
  type EvaluationRecord,
} from './evaluator';
import { readFile } from 'fs/promises';
import { join } from 'path';

const GOLDEN_DIR = join(process.cwd(), '.agents', 'golden');

export interface RecycleResult {
  traceId: string;
  preScreenWarnings: string[];
  awaitingHuman: boolean;
}

export interface FullCycleResult {
  traceId: string;
  evaluation: EvaluationRecord;
  recycledTo: 'golden' | 'failures';
}

/**
 * Execute the first half of the recycle loop:
 * 1. Emit a trace via the Planner
 * 2. Pre-screen against known failure patterns
 * 3. Begin evaluation (advances to AWAITING_HUMAN)
 *
 * Returns pre-screen warnings and the trace ID for HITL pickup.
 */
export async function initiateRecycle(
  keyword: string,
  subQueries: string[],
  meta?: Record<string, unknown>,
): Promise<RecycleResult> {
  const planResult = await plan(keyword, subQueries, meta);

  const warnings: string[] = [];
  const similarFailures = await queryFailures(keyword);
  if (similarFailures.length > 0) {
    warnings.push(
      `Found ${similarFailures.length} similar failure(s): ${similarFailures.map((f) => f.root_cause).join(', ')}`,
    );
  }

  await beginEvaluation(planResult.traceId);

  return {
    traceId: planResult.traceId,
    preScreenWarnings: warnings,
    awaitingHuman: true,
  };
}

/**
 * Complete the recycle loop with a HITL signal.
 * Routes the evaluation to the appropriate store.
 */
export async function completeRecycle(
  traceId: string,
  signal: HITLSignal,
): Promise<FullCycleResult> {
  const evaluation = await finalizeEvaluation(traceId, signal);

  return {
    traceId,
    evaluation,
    recycledTo: signal.verdict === 'APPROVED' ? 'golden' : 'failures',
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
      if (trace.verdict === 'PENDING' || trace.verdict === 'AWAITING_HUMAN') {
        pendingCount++;
      }
    } catch {
      continue;
    }
  }

  const failurePatterns = await queryFailures('');

  return {
    totalTraces: traceIds.length,
    goldenCount: goldenIds.length,
    failureCount: failurePatterns.length,
    pendingCount,
  };
}
