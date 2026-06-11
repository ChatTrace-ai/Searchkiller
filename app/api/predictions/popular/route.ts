import { decodeCursor, listPopularPredictions } from '../store';
import { errorResponse } from '../responses';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get('limit');
  const limit = rawLimit === null ? 16 : Number(rawLimit);

  if (!Number.isInteger(limit) || limit < 1 || limit > 32) {
    return errorResponse(
      400,
      'INVALID_REQUEST',
      'limit must be an integer between 1 and 32.',
    );
  }

  let offset: number;
  try {
    offset = decodeCursor(searchParams.get('cursor'));
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', 'cursor is invalid.');
  }

  return Response.json(
    listPopularPredictions({
      offset,
      limit,
      category: searchParams.get('category'),
    }),
  );
}
