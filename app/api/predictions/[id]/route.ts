import { errorResponse } from '../responses';
import { getPrediction } from '../store';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const prediction = getPrediction(id);

  if (!prediction) {
    return errorResponse(
      404,
      'PREDICTION_NOT_FOUND',
      'Prediction was not found.',
    );
  }

  return Response.json(prediction);
}
