import { errorResponse } from '../responses';
import { listStaleFeatured, refreshPrediction } from '@/lib/prediction-store';

export const runtime = 'nodejs';

const MAX_BATCH = 8;
const DELAY_MS = 5_000;

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Number(limitParam), MAX_BATCH) : MAX_BATCH;

  if (!Number.isFinite(limit) || limit < 1) {
    return errorResponse(400, 'INVALID_REQUEST', 'limit must be between 1 and ' + MAX_BATCH);
  }

  const stale = await listStaleFeatured(limit);
  if (stale.length === 0) {
    return Response.json({ queued: 0, message: 'All featured predictions already have real data.' });
  }

  const results: Array<{ id: string; status: string }> = [];

  for (let i = 0; i < stale.length; i++) {
    const item = stale[i];
    const result = await refreshPrediction(item.id);
    results.push({ id: item.id, status: result.status });

    if (result.status === 'started' && i < stale.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const queued = results.filter((r) => r.status === 'started').length;

  return Response.json(
    { queued, total: stale.length, results },
    { status: 202 },
  );
}

export async function GET() {
  const stale = await listStaleFeatured();
  return Response.json({
    staleCount: stale.length,
    staleIds: stale.map((s) => s.id),
  });
}
