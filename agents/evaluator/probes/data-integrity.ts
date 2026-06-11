/**
 * D3: Data Integrity Probe
 *
 * Validates the data format and completeness of pipeline outputs:
 *   - /api/plan output: subQueries is string[], length 3-5
 *   - /api/research/fetch output: sessionId UUID, sources valid
 *   - Source objects: title, url, text all non-empty
 */

import type { IProbe, ProbeResult, ProbeDetail, BackendEvalConfig } from './types';

export class DataIntegrityProbe implements IProbe {
  readonly dimension = 'data_integrity';

  async run(config: BackendEvalConfig): Promise<ProbeResult> {
    const t0 = Date.now();
    const details: ProbeDetail[] = [];
    const baseUrl = config.baseUrl;

    // --- /api/plan validation ---
    let subQueries: string[] = [];
    try {
      const resp = await fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: '数据完整性测试' }),
        signal: AbortSignal.timeout(20_000),
      });
      const json = await resp.json();
      subQueries = json.subQueries ?? [];

      details.push({
        check: '/api/plan → subQueries is array',
        passed: Array.isArray(subQueries),
        expected: 'Array',
        actual: Array.isArray(subQueries) ? 'Array' : typeof subQueries,
      });

      details.push({
        check: '/api/plan → subQueries length 3-5',
        passed: subQueries.length >= 3 && subQueries.length <= 5,
        expected: '3-5',
        actual: `${subQueries.length}`,
      });

      const allStrings = subQueries.every((q) => typeof q === 'string' && q.trim().length > 0);
      details.push({
        check: '/api/plan → all subQueries are non-empty strings',
        passed: allStrings,
        expected: 'all non-empty strings',
        actual: allStrings ? 'ok' : 'contains empty/non-string',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: '/api/plan → reachable',
        passed: false,
        expected: 'valid response',
        actual: 'failed',
        error: msg,
      });
    }

    // --- /api/research/fetch validation ---
    if (subQueries.length > 0) {
      try {
        const resp = await fetch(`${baseUrl}/api/research/fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: '数据完整性测试', subQueries }),
          signal: AbortSignal.timeout(15_000),
        });
        const json = await resp.json();

        const sessionId = json.sessionId as string | undefined;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        details.push({
          check: '/api/research/fetch → sessionId is UUID',
          passed: Boolean(sessionId && uuidRegex.test(sessionId)),
          expected: 'UUID format',
          actual: sessionId ? (uuidRegex.test(sessionId) ? 'valid UUID' : sessionId) : 'missing',
        });

        const sources = json.sources as Array<{ title?: string; url?: string }> | undefined;
        details.push({
          check: '/api/research/fetch → sources is array',
          passed: Array.isArray(sources),
          expected: 'Array',
          actual: Array.isArray(sources) ? `Array[${sources.length}]` : typeof sources,
        });

        if (Array.isArray(sources)) {
          const allHaveTitle = sources.every((s) => typeof s.title === 'string' && s.title.length > 0);
          details.push({
            check: '/api/research/fetch → all sources have title',
            passed: allHaveTitle,
            expected: 'all non-empty',
            actual: allHaveTitle ? 'ok' : 'some missing',
          });

          const allHaveUrl = sources.every((s) => typeof s.url === 'string' && s.url.startsWith('http'));
          details.push({
            check: '/api/research/fetch → all sources have valid URL',
            passed: allHaveUrl,
            expected: 'all http(s) URLs',
            actual: allHaveUrl ? 'ok' : 'some invalid',
          });

          const urls = sources.map((s) => s.url);
          const uniqueUrls = new Set(urls);
          details.push({
            check: '/api/research/fetch → no duplicate URLs',
            passed: urls.length === uniqueUrls.size,
            expected: 'no duplicates',
            actual: urls.length === uniqueUrls.size ? 'ok' : `${urls.length - uniqueUrls.size} duplicates`,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown';
        details.push({
          check: '/api/research/fetch → reachable',
          passed: false,
          expected: 'valid response',
          actual: 'failed',
          error: msg,
        });
      }
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
