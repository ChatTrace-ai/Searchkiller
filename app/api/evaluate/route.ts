import { NextResponse } from 'next/server';
import { initiateRecycle, completeRecycle, getRecycleStats } from '@/agents/recycle';

/**
 * POST /api/evaluate — HITL evaluation endpoint
 *
 * Actions:
 *   initiate: Start the recycle loop for a new trace
 *   finalize: Complete evaluation with human verdict
 *   stats:    Get recycle system summary
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'initiate') {
      const { keyword, subQueries, meta } = body;
      if (!keyword || !subQueries) {
        return NextResponse.json(
          { error: 'keyword and subQueries are required' },
          { status: 400 },
        );
      }
      const result = await initiateRecycle(keyword, subQueries, meta);
      return NextResponse.json(result);
    }

    if (action === 'finalize') {
      const { traceId, signal } = body;
      if (!traceId || !signal?.verdict || !signal?.reviewer) {
        return NextResponse.json(
          { error: 'traceId, signal.verdict, and signal.reviewer are required' },
          { status: 400 },
        );
      }
      if (
        signal.verdict === 'REJECTED' &&
        (!signal.root_cause || !signal.lesson)
      ) {
        return NextResponse.json(
          { error: 'REJECTED verdicts require root_cause and lesson' },
          { status: 400 },
        );
      }
      const result = await completeRecycle(traceId, signal);
      return NextResponse.json(result);
    }

    if (action === 'stats') {
      const stats = await getRecycleStats();
      return NextResponse.json(stats);
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Use initiate, finalize, or stats.` },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
