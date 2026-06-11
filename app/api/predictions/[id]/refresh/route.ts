import { errorResponse } from '../../responses';
import { refreshPrediction } from '../../store';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = refreshPrediction(id);

  if (result.status === 'not_found') {
    return errorResponse(
      404,
      'PREDICTION_NOT_FOUND',
      'Prediction was not found.',
    );
  }

  if (result.status === 'in_progress') {
    return errorResponse(
      409,
      'PREDICTION_IN_PROGRESS',
      'Prediction generation is already in progress.',
    );
  }

  return Response.json(
    {
      id,
      status: 'processing',
      pollAfterMs: 2_000,
    },
    { status: 202 },
  );
}
