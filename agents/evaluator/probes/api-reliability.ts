/**
 * D1: API Reliability Probe
 *
 * Tests all configured API endpoints for:
 *   - HTTP 2xx response
 *   - Valid JSON body
 *   - Required fields present
 *   - Response within SLA
 */

import type { IProbe, ProbeResult, ProbeDetail, BackendEvalConfig } from './types';

export class ApiReliabilityProbe implements IProbe {
  readonly dimension = 'api_reliability';

  async run(config: BackendEvalConfig): Promise<ProbeResult> {
    const t0 = Date.now();
    const details: ProbeDetail[] = [];

    for (const ep of config.apiEndpoints) {
      const url = `${config.baseUrl}${ep.path}`;
      const epStart = Date.now();

      try {
        const resp = await fetch(url, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
          signal: AbortSignal.timeout(ep.slaMs + 2000),
        });

        const latency = Date.now() - epStart;
        const isOk = resp.ok;

        details.push({
          check: `${ep.method} ${ep.path} → HTTP status`,
          passed: isOk,
          expected: '2xx',
          actual: `${resp.status}`,
          error: isOk ? undefined : `HTTP ${resp.status} ${resp.statusText}`,
        });

        details.push({
          check: `${ep.method} ${ep.path} → latency`,
          passed: latency <= ep.slaMs,
          expected: `<= ${ep.slaMs}ms`,
          actual: `${latency}ms`,
        });

        if (isOk) {
          try {
            const json = await resp.json();
            details.push({
              check: `${ep.method} ${ep.path} → valid JSON`,
              passed: true,
              expected: 'parseable JSON',
              actual: 'ok',
            });

            if (ep.requiredFields) {
              for (const field of ep.requiredFields) {
                const has = json[field] !== undefined && json[field] !== null;
                details.push({
                  check: `${ep.method} ${ep.path} → field "${field}"`,
                  passed: has,
                  expected: 'present',
                  actual: has ? 'present' : 'missing',
                });
              }
            }
          } catch {
            details.push({
              check: `${ep.method} ${ep.path} → valid JSON`,
              passed: false,
              expected: 'parseable JSON',
              actual: 'invalid JSON body',
            });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        details.push({
          check: `${ep.method} ${ep.path} → reachable`,
          passed: false,
          expected: 'reachable',
          actual: 'unreachable',
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
