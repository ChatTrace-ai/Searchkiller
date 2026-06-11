/**
 * D2: Search Quality Probe
 *
 * Tests Exa + ES search results for:
 *   - Exa returns enough sources
 *   - ES connection health (or graceful failure)
 *   - Deduplicated total >= threshold
 *   - Snippet non-empty rate
 */

import type { IProbe, ProbeResult, ProbeDetail, BackendEvalConfig } from './types';
import { semanticSearch } from '@/lib/exa';
import { hybridSearch } from '@/lib/elasticsearch';

export class SearchQualityProbe implements IProbe {
  readonly dimension = 'search_quality';

  async run(config: BackendEvalConfig): Promise<ProbeResult> {
    const t0 = Date.now();
    const details: ProbeDetail[] = [];
    const queries = config.searchTestQueries;

    let exaSources: Array<{ title: string; url: string; text: string }> = [];
    let esSources: Array<{ title: string; url: string; text: string }> = [];

    try {
      exaSources = await semanticSearch(queries);
      details.push({
        check: 'Exa semantic search → available',
        passed: true,
        expected: 'no error',
        actual: `returned ${exaSources.length} sources`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'Exa semantic search → available',
        passed: false,
        expected: 'no error',
        actual: 'failed',
        error: msg,
      });
    }

    try {
      esSources = await hybridSearch(queries[0] ?? 'test');
      details.push({
        check: 'ES hybrid search → available',
        passed: true,
        expected: 'no error',
        actual: `returned ${esSources.length} sources`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      details.push({
        check: 'ES hybrid search → available',
        passed: false,
        expected: 'no error or graceful degradation',
        actual: 'failed',
        error: msg,
      });
    }

    const minExaSources = 3;
    details.push({
      check: `Exa source count >= ${minExaSources}`,
      passed: exaSources.length >= minExaSources,
      expected: `>= ${minExaSources}`,
      actual: `${exaSources.length}`,
    });

    const allSources = [...exaSources, ...esSources];
    const seen = new Set<string>();
    const deduped = allSources.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

    const minTotal = 3;
    details.push({
      check: `Deduplicated total >= ${minTotal}`,
      passed: deduped.length >= minTotal,
      expected: `>= ${minTotal}`,
      actual: `${deduped.length}`,
    });

    const hasDuplicates = allSources.length !== deduped.length;
    details.push({
      check: 'No duplicate URLs',
      passed: !hasDuplicates,
      expected: 'no duplicates',
      actual: hasDuplicates ? `${allSources.length - deduped.length} duplicates` : 'none',
    });

    const nonEmpty = deduped.filter((s) => s.text && s.text.trim().length > 0).length;
    const nonEmptyRate = deduped.length > 0 ? nonEmpty / deduped.length : 0;
    details.push({
      check: 'Snippet non-empty rate >= 80%',
      passed: nonEmptyRate >= 0.8,
      expected: '>= 80%',
      actual: `${(nonEmptyRate * 100).toFixed(0)}%`,
    });

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
