import { NextResponse } from 'next/server';
import {
  initializeEvaluator,
  loadConfig,
  isInitialized,
  recycle,
  evaluateExisting,
  getRecycleStats,
  startLoop,
  loopNext,
  loopApprove,
  loopCancel,
  loadLoop,
  loopSummary,
  listLoops,
} from '@/lib/harness-adapter';

/**
 * POST /api/evaluate — Evaluator lifecycle endpoint
 *
 * Actions:
 *   initialize:     (HITL) Human defines evaluation criteria/thresholds → persists config
 *   config:         Read current evaluator configuration
 *   evaluate:       Run autonomous evaluation on a new keyword (plan + evaluate)
 *   evaluate_trace: Run autonomous evaluation on an existing trace
 *   stats:          Get recycle system summary
 *
 * Feedback Loop Actions:
 *   start_loop:     Start iterative feedback loop (generate + evaluate + HITL)
 *   loop_next:      Execute next iteration round
 *   loop_approve:   Approve current best version
 *   loop_cancel:    Cancel active loop
 *   loop_status:    Get loop state and history
 *   loop_list:      List all loops
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'initialize') {
      const { initialized_by, criteria, thresholds, auto_approve, notes } = body;
      if (!initialized_by || !criteria || !thresholds) {
        return NextResponse.json(
          { error: 'initialized_by, criteria, and thresholds are required' },
          { status: 400 },
        );
      }
      const config = await initializeEvaluator({
        initialized_by,
        criteria,
        thresholds,
        auto_approve: auto_approve ?? true,
        notes,
      });
      return NextResponse.json({ status: 'initialized', config });
    }

    if (action === 'config') {
      if (!isInitialized()) {
        return NextResponse.json(
          { error: 'Evaluator not initialized. Call action=initialize first.' },
          { status: 400 },
        );
      }
      const config = await loadConfig();
      return NextResponse.json(config);
    }

    if (action === 'evaluate') {
      const { keyword, subQueries, meta } = body;
      if (!keyword || !subQueries) {
        return NextResponse.json(
          { error: 'keyword and subQueries are required' },
          { status: 400 },
        );
      }
      const result = await recycle(keyword, subQueries, meta);
      return NextResponse.json(result);
    }

    if (action === 'evaluate_trace') {
      const { traceId } = body;
      if (!traceId) {
        return NextResponse.json(
          { error: 'traceId is required' },
          { status: 400 },
        );
      }
      const result = await evaluateExisting(traceId);
      return NextResponse.json(result);
    }

    if (action === 'stats') {
      const stats = await getRecycleStats();
      return NextResponse.json(stats);
    }

    // ── Feedback Loop Actions ──────────────────────────────────────────

    if (action === 'start_loop') {
      const { keyword, subQueries, sources, maxRounds, contractOverrides, judgeMode } = body;
      if (!keyword) {
        return NextResponse.json(
          { error: 'keyword is required' },
          { status: 400 },
        );
      }
      const result = await startLoop({
        keyword,
        subQueries,
        sources,
        maxRounds,
        contractOverrides,
        judgeMode,
      });
      return NextResponse.json(result);
    }

    if (action === 'loop_next') {
      const { loopId, userFeedback, judgeMode } = body;
      if (!loopId) {
        return NextResponse.json(
          { error: 'loopId is required' },
          { status: 400 },
        );
      }
      const result = await loopNext(loopId, userFeedback, judgeMode);
      return NextResponse.json(result);
    }

    if (action === 'loop_approve') {
      const { loopId } = body;
      if (!loopId) {
        return NextResponse.json(
          { error: 'loopId is required' },
          { status: 400 },
        );
      }
      const loop = await loopApprove(loopId);
      return NextResponse.json({ status: 'approved', loop, summary: loopSummary(loop) });
    }

    if (action === 'loop_cancel') {
      const { loopId, reason } = body;
      if (!loopId) {
        return NextResponse.json(
          { error: 'loopId is required' },
          { status: 400 },
        );
      }
      const loop = await loopCancel(loopId, reason);
      return NextResponse.json({ status: 'cancelled', loop });
    }

    if (action === 'loop_status') {
      const { loopId } = body;
      if (!loopId) {
        return NextResponse.json(
          { error: 'loopId is required' },
          { status: 400 },
        );
      }
      const loop = await loadLoop(loopId);
      return NextResponse.json({ loop, summary: loopSummary(loop) });
    }

    if (action === 'loop_list') {
      const ids = await listLoops();
      return NextResponse.json({ loops: ids, count: ids.length });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Use initialize, config, evaluate, evaluate_trace, stats, start_loop, loop_next, loop_approve, loop_cancel, loop_status, or loop_list.` },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
