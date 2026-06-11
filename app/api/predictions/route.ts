import { createPrediction } from './store';
import { errorResponse } from './responses';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', 'Request body must be valid JSON.');
  }

  const question =
    typeof body === 'object' &&
    body !== null &&
    'question' in body &&
    typeof body.question === 'string'
      ? body.question.trim()
      : '';

  if (question.length < 5 || question.length > 500) {
    return errorResponse(
      400,
      'INVALID_REQUEST',
      'question must contain between 5 and 500 characters.',
    );
  }

  const result = createPrediction(question);
  const completed = result.status === 'completed';

  return Response.json(
    {
      id: result.id,
      status: result.status,
      reused: result.reused,
      pollAfterMs: completed ? null : 2_000,
    },
    { status: completed ? 200 : 202 },
  );
}
