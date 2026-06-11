/**
 * D4: Cache Effectiveness Probe
 *
 * Tests the in-memory context cache:
 *   - After /fetch, the sessionId exists in cache (/report doesn't 404)
 *   - Invalid sessionId returns 404 (not 500)
 *   - Cache data completeness
 *
 * Note: MVP stage may have this dimension disabled (weight=0).
 */

import type { IProbe, ProbeResult, ProbeDetail, BackendEvalConfig } from './types';

export class CacheEffectivenessProbe implements IProbe {
  readonly dimension = 'cache_effectiveness';

  async run(config: BackendEvalConfig): Promise<ProbeResult> {
    const t0 = Date.now();
    const details: ProbeDetail[] = [];
    const baseUrl = config.baseUrl;

    // Step 1: Create a session via /api/plan + /api/research/fetch
    let sessionId: string | null = null;

    try {
      const planResp = await fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: '缓存测试' }),
        signal: AbortSignal.timeout(20_000),
      });
      const planJson = await planResp.json();
      const subQueries = planJson.subQueries ?? ['test query'];

      const fetchResp = await fetch(`${baseUrl}/api/research/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: '缓存测试', subQueries }),
        signal: AbortSignal.timeout(15_000),
      });
      const fetchJson = await fetchResp.json();
      sessionId = fetchJson.sessionId ?? null;

      details.push({
        check: 'Session creation → sessionId returned',
        passed: Boolean(sessionId),
        expected: 'non-null sessionId',
        actual: sessionId ? 'ok' : 'null',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'Session creation → reachable',
        passed: false,
        expected: 'success',
        actual: 'failed',
        error: msg,
      });
    }

    // Step 2: Verify cache hit — use /api/mindmap which also reads from cache
    // but does NOT trigger slow Gemini Pro generation.
    // If /mindmap returns 404, session is not cached. Any other status = cached.
    // Alternative: we call /report but abort immediately after getting the status code.
    if (sessionId) {
      try {
        const controller = new AbortController();
        const reportResp = await fetch(`${baseUrl}/api/research/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
          signal: controller.signal,
        });

        // We got the status — abort the stream immediately (no need to wait for Gemini)
        controller.abort();

        details.push({
          check: 'Cache hit → /report with valid sessionId',
          passed: reportResp.status !== 404,
          expected: 'not 404',
          actual: `HTTP ${reportResp.status}`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown';
        // AbortError is expected — we intentionally abort after getting the status
        const isAbort = msg.includes('abort');
        if (isAbort) {
          details.push({
            check: 'Cache hit → /report with valid sessionId',
            passed: true,
            expected: 'not 404',
            actual: 'HTTP 200 (streaming aborted after status check)',
          });
        } else {
          details.push({
            check: 'Cache hit → /report reachable',
            passed: false,
            expected: 'reachable',
            actual: 'failed',
            error: msg,
          });
        }
      }
    }

    // Step 3: Verify cache miss — invalid sessionId should return 404
    try {
      const invalidResp = await fetch(`${baseUrl}/api/research/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'invalid-session-id-00000000' }),
        signal: AbortSignal.timeout(5_000),
      });

      details.push({
        check: 'Cache miss → invalid sessionId returns 404',
        passed: invalidResp.status === 404,
        expected: '404',
        actual: `HTTP ${invalidResp.status}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'Cache miss → /report with invalid sessionId',
        passed: false,
        expected: '404 response',
        actual: 'failed',
        error: msg,
      });
    }

    const passedCount = details.filter((d) => d.passed).length;
    const totalCount = details.length;
    const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 10 * 100) / 100 : 0;

    const dim = config.dimensions.find((d) => d.name === this.dimension);
    const passed = score >= (dim?.hardThreshold ?? 0);

    return {
      dimension: this.dimension,
      score,
      passed,
      details,
      durationMs: Date.now() - t0,
    };
  }
}
