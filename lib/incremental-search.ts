import type { Source, KnowledgeEntry, SearchStats } from './schemas';
import { checkCoverage, indexKnowledgeBulk, toSource } from './knowledge-store';
import { extractKnowledgeBatch, type ExtractionDiagnostics } from './knowledge-extractor';
import { getActiveProviders } from './search-provider';

export async function incrementalSearch(
  projectId: string,
  keyword: string,
  subQueries: string[],
): Promise<{ sources: Source[]; knowledgeEntries: KnowledgeEntry[]; stats: SearchStats }> {
  const effectiveProjectId = projectId || 'default';

  const coverageResults = await Promise.all(
    subQueries.map((q) => checkCoverage(effectiveProjectId, q)),
  );

  const coveredResults = coverageResults.filter((r) => r.covered);
  const uncoveredQueries = coverageResults
    .filter((r) => !r.covered)
    .map((r) => r.subQuery);

  const cachedSources: Source[] = coveredResults.flatMap((r) =>
    r.existingEntries.map(toSource),
  );

  let externalSources: Source[] = [];
  let newEntriesIndexed = 0;
  let extractionErrors = 0;
  let extractionDiagnostics: ExtractionDiagnostics | undefined;

  if (uncoveredQueries.length > 0) {
    const providers = getActiveProviders();
    const providerResults = await Promise.all(
      providers.map((p) => p.search(uncoveredQueries).catch(() => [] as Source[])),
    );
    externalSources = providerResults.flat();

    if (externalSources.length > 0) {
      const { results: extracted, diagnostics } = await extractKnowledgeBatch(externalSources);
      extractionDiagnostics = diagnostics;
      extractionErrors = diagnostics.failed;

      const validEntries: KnowledgeEntry[] = extracted
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .map((entry) => ({
          ...entry,
          project_id: effectiveProjectId,
          created_at: new Date().toISOString(),
        }));

      if (validEntries.length > 0) {
        const INDEXING_TIMEOUT_MS = 5000;
        let indexingResolved = false;

        const bulkPromise = indexKnowledgeBulk(validEntries).then((bulkResult) => {
          indexingResolved = true;
          newEntriesIndexed = bulkResult.succeeded + bulkResult.duplicates;
          console.info('[incremental-search] bulk indexing done:', bulkResult);
          return bulkResult;
        });

        const timeoutPromise = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), INDEXING_TIMEOUT_MS),
        );

        await Promise.race([bulkPromise, timeoutPromise]);

        if (!indexingResolved) {
          newEntriesIndexed = -1; // indicates pending (not yet confirmed)
          bulkPromise
            .then((r) => console.info('[incremental-search] deferred bulk completed:', r))
            .catch((e) => console.error('[incremental-search] deferred bulk error:', e));
        }
      }
    }
  }

  const allSources = [...cachedSources, ...externalSources];
  const dedupedSources = urlDedup(allSources);

  const knowledgeEntries = coveredResults.flatMap((r) => r.existingEntries);

  const stats: SearchStats = {
    totalSubQueries: subQueries.length,
    coveredByCache: coveredResults.length,
    fetchedFromExternal: uncoveredQueries.length,
    newEntriesIndexed,
    cacheHitRate:
      subQueries.length > 0
        ? coveredResults.length / subQueries.length
        : 0,
    extractionErrors,
    extractionDiagnostics,
  };

  console.info('incremental-search', {
    projectId: effectiveProjectId,
    keyword,
    stats,
  });

  return { sources: dedupedSources, knowledgeEntries, stats };
}

function urlDedup(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
