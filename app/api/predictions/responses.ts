import type { ApiErrorBody } from '@/lib/prediction-types';

type ApiErrorCode = ApiErrorBody['error']['code'];

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  return Response.json({ error: { code, message } } satisfies ApiErrorBody, {
    status,
  });
}
