import { NextResponse } from 'next/server';
import { initializeEvaluator, loadConfig, isInitialized } from '@/agents/evaluator';
import { recycle, evaluateExisting, getRecycleStats } from '@/agents/recycle';

/**
 * POST /api/evaluate — Evaluator lifecycle endpoint
 *
 * Actions:
 *   initialize: (HITL) Human defines evaluation criteria/thresholds → persists config
 *   config:     Read current evaluator configuration
 *   evaluate:   Run autonomous evaluation on a new keyword (plan + evaluate)
 *   evaluate_trace: Run autonomous evaluation on an existing trace
 *   stats:      Get recycle system summary
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

    return NextResponse.json(
      { error: `Unknown action: ${action}. Use initialize, config, evaluate, evaluate_trace, or stats.` },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
