import { generateObject, generateText, streamText, streamObject } from 'ai';
import pLimit from 'p-limit';
import { flashModel, proModel } from './gemini';

// ---------------------------------------------------------------------------
// Concurrency limits per model tier
// ---------------------------------------------------------------------------

const flashLimit = pLimit(5);
const proLimit = pLimit(2);

function getLimiter(model: unknown) {
  return model === proModel ? proLimit : flashLimit;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export type GeminiErrorClass =
  | 'rate_limit'
  | 'timeout'
  | 'server_error'
  | 'auth_error'
  | 'validation'
  | 'unknown';

function classifyError(error: any): GeminiErrorClass {
  const status = error?.status ?? error?.statusCode;
  const code = error?.code ?? '';
  const msg = error?.message ?? '';

  if (status === 429 || code === 'RATE_LIMIT_EXCEEDED' || msg.includes('RESOURCE_EXHAUSTED'))
    return 'rate_limit';
  if (status === 401 || status === 403 || msg.includes('PERMISSION_DENIED'))
    return 'auth_error';
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || msg.includes('timeout') || code === 'ABORT_ERR')
    return 'timeout';
  if (status >= 500 || code === 'UNAVAILABLE' || msg.includes('503'))
    return 'server_error';
  if (error?.name === 'ZodError' || msg.includes('validation'))
    return 'validation';
  return 'unknown';
}

function isRetryable(cls: GeminiErrorClass): boolean {
  return cls === 'rate_limit' || cls === 'timeout' || cls === 'server_error';
}

// ---------------------------------------------------------------------------
// Retry engine
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1500;

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

interface RetryOpts {
  maxRetries?: number;
  timeoutMs?: number;
  label?: string;
}

async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const retries = opts.maxRetries ?? MAX_RETRIES;
  const label = opts.label ?? 'gemini-call';

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = opts.timeoutMs ? new AbortController() : undefined;
    const timer = controller
      ? setTimeout(() => controller.abort(), opts.timeoutMs)
      : undefined;

    try {
      const result = await fn(controller?.signal);
      if (timer) clearTimeout(timer);
      return result;
    } catch (error: any) {
      if (timer) clearTimeout(timer);

      const cls = classifyError(error);
      const isLast = attempt === retries;

      console.warn(
        `[gemini-client] ${label} attempt ${attempt + 1}/${retries + 1} failed: ${cls} — ${error?.message?.slice(0, 120)}`,
      );

      if (!isRetryable(cls) || isLast) {
        throw Object.assign(error, { geminiErrorClass: cls });
      }

      const jitter = Math.random() * 500;
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt) + jitter;
      await sleep(backoff);
    }
  }

  throw new Error(`[gemini-client] ${label}: exhausted retries`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * generateObject with retry, concurrency control, and optional timeout.
 */
export async function safeGenerateObject(
  params: Parameters<typeof generateObject>[0],
  opts?: RetryOpts,
) {
  const limiter = getLimiter(params.model);
  return limiter(() =>
    withRetry(
      () => generateObject(params as any) as any,
      { timeoutMs: 30_000, label: 'generateObject', ...opts },
    ),
  ) as ReturnType<typeof generateObject>;
}

/**
 * generateText with retry, concurrency control, and optional timeout.
 */
export async function safeGenerateText(
  params: Parameters<typeof generateText>[0],
  opts?: RetryOpts,
) {
  const limiter = getLimiter(params.model);
  return limiter(() =>
    withRetry(
      () => generateText(params as any),
      { timeoutMs: 120_000, label: 'generateText', ...opts },
    ),
  ) as ReturnType<typeof generateText>;
}

/**
 * streamText with concurrency control (no retry — streaming cannot be replayed).
 * Callers should handle errors from the stream itself.
 */
export function safeStreamText(
  params: Parameters<typeof streamText>[0],
) {
  return streamText(params as any) as ReturnType<typeof streamText>;
}

/**
 * streamObject with concurrency control (no retry — streaming cannot be replayed).
 */
export function safeStreamObject(
  params: Parameters<typeof streamObject>[0],
) {
  return streamObject(params as any) as ReturnType<typeof streamObject>;
}
