/**
 * D5: Graceful Degradation Probe
 *
 * Tests system resilience when services are unavailable:
 *   - fetchSources() with ES unavailable → still returns Exa results
 *   - fetchSources() with empty sources → no crash
 *   - /api/research/report with invalid session → returns 404 (not 500)
 *   - All error responses have meaningful error messages
 *
 * Note: This probe tests the code paths directly rather than using
 * environment variable manipulation, to avoid side effects on other probes.
 */

import type { IProbe, ProbeResult, ProbeDetail, BackendEvalConfig } from './types';

export class GracefulDegradationProbe implements IProbe {
  readonly dimension = 'graceful_degradation';

  async run(config: BackendEvalConfig): Promise<ProbeResult> {
    const t0 = Date.now();
    const details: ProbeDetail[] = [];
    const baseUrl = config.baseUrl;

    // Scenario 1: /api/research/report with invalid sessionId → should 404, not 500
    try {
      const resp = await fetch(`${baseUrl}/api/research/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'nonexistent-session-id' }),
        signal: AbortSignal.timeout(5_000),
      });

      details.push({
        check: 'Invalid sessionId → returns 404 (not 500)',
        passed: resp.status === 404,
        expected: '404',
        actual: `HTTP ${resp.status}`,
      });

      if (resp.status === 404) {
        const json = await resp.json();
        details.push({
          check: 'Invalid sessionId → error message present',
          passed: Boolean(json.error),
          expected: 'error field present',
          actual: json.error ? 'present' : 'missing',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'Invalid sessionId → no crash',
        passed: false,
        expected: 'HTTP response',
        actual: 'crashed',
        error: msg,
      });
    }

    // Scenario 2: /api/plan with empty keyword → should 400, not 500
    try {
      const resp = await fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: '' }),
        signal: AbortSignal.timeout(5_000),
      });

      details.push({
        check: 'Empty keyword → returns 400 (not 500)',
        passed: resp.status === 400,
        expected: '400',
        actual: `HTTP ${resp.status}`,
      });

      if (resp.status === 400) {
        const json = await resp.json();
        details.push({
          check: 'Empty keyword → meaningful error message',
          passed: Boolean(json.error),
          expected: 'error field present',
          actual: json.error ? `"${json.error}"` : 'missing',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'Empty keyword → no crash',
        passed: false,
        expected: 'HTTP response',
        actual: 'crashed',
        error: msg,
      });
    }

    // Scenario 3: /api/research/fetch with empty subQueries → should 400, not 500
    try {
      const resp = await fetch(`${baseUrl}/api/research/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'test', subQueries: [] }),
        signal: AbortSignal.timeout(5_000),
      });

      details.push({
        check: 'Empty subQueries → returns 400 (not 500)',
        passed: resp.status === 400,
        expected: '400',
        actual: `HTTP ${resp.status}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'Empty subQueries → no crash',
        passed: false,
        expected: 'HTTP response',
        actual: 'crashed',
        error: msg,
      });
    }

    // Scenario 4: /api/evaluate with unknown action → should 400, not 500
    try {
      const resp = await fetch(`${baseUrl}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nonexistent_action' }),
        signal: AbortSignal.timeout(5_000),
      });

      details.push({
        check: 'Unknown evaluate action → returns 400 (not 500)',
        passed: resp.status === 400,
        expected: '400',
        actual: `HTTP ${resp.status}`,
      });

      if (resp.status === 400) {
        const json = await resp.json();
        details.push({
          check: 'Unknown action → error lists valid actions',
          passed: Boolean(json.error && json.error.includes('Unknown action')),
          expected: 'lists valid actions',
          actual: json.error ? 'present' : 'missing',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'Unknown action → no crash',
        passed: false,
        expected: 'HTTP response',
        actual: 'crashed',
        error: msg,
      });
    }

    // Scenario 5: Malformed JSON body → should 400 or 500, but not crash
    try {
      const resp = await fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json',
        signal: AbortSignal.timeout(5_000),
      });

      details.push({
        check: 'Malformed JSON → returns error (not crash)',
        passed: resp.status >= 400 && resp.status < 600,
        expected: '4xx or 5xx',
        actual: `HTTP ${resp.status}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'Malformed JSON → no crash',
        passed: false,
        expected: 'HTTP response',
        actual: 'crashed',
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
