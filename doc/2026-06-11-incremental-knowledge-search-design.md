# Incremental Knowledge Search — Backend Design

> Version: 0.2.0 | Date: 2026-06-11 | Status: Revised (R2 — addressing 10 findings from design review R1)

## Overview

将 Searchkiller 的搜索后端从"每次全量外部搜索"升级为"ES 知识库优先 + 增量外部补充"模式。核心思想：Exa/Google 搜索结果经 Gemini 结构化抽取后持久存入 Elasticsearch，后续搜索先查 ES 知识库，仅对未覆盖的子查询调用外部搜索，实现搜索成本递减和知识积累。

## Architecture

### Data Flow

```
User keyword + project_id
  → /api/plan (Gemini Flash → subQueries[3-5])  [unchanged]
  → /api/research/fetch (incremental flow):
      1. Per subQuery → kNN search knowledge-cache (project_id filter)
         - ⏱ 3s AbortSignal.timeout per query; timeout → treat as "uncovered"
         - similarity > 0.85 → "covered", reuse existing knowledge
         - similarity < 0.85 → "uncovered", queue for external search
      2. For uncovered subQueries:
         - Parallel: Exa + (Google, reserved)
         - Per new source → Gemini extractKnowledge() → structured JSON
           ⚠ Concurrency capped at 5 via p-limit; 429 → exponential backoff
         - Async write to knowledge-cache (deterministic _id, op_type:'create')
      3. Merge: existing knowledge + newly extracted knowledge
         → toSource() mapping → URL-level dedup (final pass)
         → formatted context → in-memory cache
  → /api/research/report  [unchanged]
  → /api/research/mindmap [unchanged]
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ES index strategy | Single `knowledge-cache` index with `project_id` field | Simple, sufficient for <100K docs, avoids index lifecycle complexity |
| Embedding | ES built-in `.multilingual-e5-small` via ingest pipeline | Zero extra API calls, already configured on ES Serverless |
| Dedup strategy | Two-layer: semantic (kNN cosine 0.85) for coverage check + URL dedup as final output pass | Semantic catches content overlap; URL dedup catches provider-level duplicates |
| Knowledge scope | Per-project isolation via `project_id` keyword filter | Clean separation without physical index overhead |
| Search sources | Exa (active) + Google (interface reserved, stub impl) | Extensible via `ISearchProvider`, Google added when ready |
| Write behavior | Fire-and-forget (`Promise.allSettled`), non-blocking | Knowledge indexing should not slow down user-facing response |
| kNN timeout | 3s `AbortSignal.timeout` per `checkCoverage()` call | Prevents slow kNN from blocking the entire request; timeout → uncovered fallback |
| Gemini concurrency | `p-limit(5)` + exponential backoff on 429 | Prevents API rate limit exhaustion when many new sources arrive simultaneously |
| Write idempotency | `op_type:'create'` + deterministic `_id = sha256(project_id + source_url)` | Eliminates TOCTOU race in check-then-write dedup pattern |
| Source origin tracking | `origin: 'exa' \| 'google' \| 'knowledge-cache'` field on `Source` | Enables BackendJudge `source_diversity` scoring without URL-pattern heuristics |

## ES Index: `knowledge-cache`

### Mapping

```json
{
  "mappings": {
    "properties": {
      "project_id":   { "type": "keyword" },
      "topic":        { "type": "text", "analyzer": "standard" },
      "facts":        { "type": "text" },
      "entities": {
        "type": "nested",
        "properties": {
          "name":        { "type": "keyword" },
          "type":        { "type": "keyword" },
          "description": { "type": "text" }
        }
      },
      "source_url":   { "type": "keyword" },
      "source_title": { "type": "text" },
      "raw_summary":  { "type": "text" },
      "embedding_text": { "type": "text" },
      "content_embedding": {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      },
      "created_at":   { "type": "date" }
    }
  }
}
```

### Ingest Pipeline

```json
{
  "id": "knowledge-embedding",
  "processors": [{
    "inference": {
      "model_id": ".multilingual-e5-small",
      "input_output": [{
        "input_field": "embedding_text",
        "output_field": "content_embedding"
      }]
    }
  }]
}
```

`embedding_text` = `topic + " " + facts.join(". ")` — combines topic and factual content for semantic representation.

## Module Design

### New Files

| File | Responsibility |
|------|---------------|
| `lib/knowledge-store.ts` | ES knowledge-cache CRUD (ensureIndex, indexKnowledge, checkCoverage, getProjectKnowledge) |
| `lib/knowledge-extractor.ts` | Gemini structured knowledge extraction from raw Source |
| `lib/search-provider.ts` | `ISearchProvider` interface + ExaProvider + GoogleProvider (stub) |
| `lib/incremental-search.ts` | Orchestrator: coverage check → external search → extract → index → merge |

### Modified Files

| File | Changes |
|------|---------|
| `lib/schemas.ts` | Add `origin` to `Source`; add `KnowledgeEntry`, `CoverageResult`, `ISearchProvider`, `SearchStats` types |
| `app/api/research/fetch/route.ts` | Accept `project_id`, replace direct Exa+ES with `incrementalSearch()` |
| `agents/evaluator/backend-judge.ts` | Migrate `source_diversity` from URL heuristic to `Source.origin` field |
| `agents/evaluator/probes/search-quality.ts` | Add `knowledgeCacheAvailable` + `knowledgeCacheHitRate` checks |

### New Dependencies

| Package | Purpose |
|---------|---------|
| `p-limit` | Concurrency limiter for Gemini API calls (lightweight, zero-dependency) |

### Unchanged Files

`lib/exa.ts`, `lib/elasticsearch.ts`, `lib/gemini.ts`, `lib/context-cache.ts`, `app/api/plan/route.ts`, `app/api/research/report/route.ts`, `app/api/research/mindmap/route.ts`

## Interface Definitions

### Types (`lib/schemas.ts`)

```typescript
// Extended from existing Source — adds origin for BackendJudge source_diversity
interface Source {
  title: string;
  url: string;
  text: string;
  origin?: 'exa' | 'google' | 'knowledge-cache';
}

interface KnowledgeEntry {
  project_id: string;
  topic: string;
  facts: string[];
  entities: Array<{
    name: string;
    type: 'person' | 'organization' | 'technology' | 'concept' | 'event' | 'location' | 'other';
    description?: string;
  }>;
  source_url: string;
  source_title: string;
  raw_summary: string;
  created_at: string;
}

interface CoverageResult {
  subQuery: string;
  covered: boolean;
  score: number;
  existingEntries: KnowledgeEntry[];
}

interface ISearchProvider {
  name: string;
  search(queries: string[]): Promise<Source[]>;
}

interface SearchStats {
  totalSubQueries: number;
  coveredByCache: number;
  fetchedFromExternal: number;
  newEntriesIndexed: number;
  cacheHitRate: number;
  extractionErrors: number;
}
```

**`origin` field rationale**: `backend-judge.ts` currently uses `url.includes('#internal')` to distinguish ES vs Exa sources. Adding `origin` directly to `Source` eliminates this fragile heuristic and correctly classifies knowledge-cache entries (whose `source_url` is the original HTTP URL, not `#internal`).

### `lib/knowledge-store.ts`

```typescript
export async function ensureKnowledgeIndex(): Promise<void>

// Uses deterministic _id = sha256(project_id + source_url) with op_type:'create'
// to guarantee idempotent writes without TOCTOU race conditions.
// Duplicate _id silently returns existing doc ID (409 → swallow).
export async function indexKnowledge(entry: KnowledgeEntry): Promise<string>

// kNN query wrapped in AbortSignal.timeout(3000).
// On timeout: returns { covered: false, score: 0, existingEntries: [] }.
export async function checkCoverage(
  projectId: string,
  subQuery: string,
  options?: { threshold?: number; timeoutMs?: number }
): Promise<CoverageResult>

export async function getProjectKnowledge(projectId: string, limit?: number): Promise<KnowledgeEntry[]>

export async function deleteKnowledge(projectId: string, sourceUrl: string): Promise<boolean>

// Maps KnowledgeEntry to the existing Source interface for downstream compatibility.
export function toSource(entry: KnowledgeEntry): Source
// Implementation: { title: entry.source_title, url: entry.source_url,
//                   text: entry.raw_summary, origin: 'knowledge-cache' }
```

### `lib/knowledge-extractor.ts`

```typescript
// Single-source extraction. Callers MUST use extractKnowledgeBatch() for
// multiple sources to respect rate limits.
export async function extractKnowledge(
  source: Source
): Promise<Omit<KnowledgeEntry, 'project_id' | 'created_at'>>

// Batch extraction with p-limit(MAX_CONCURRENT=5).
// On 429 → exponential backoff (base 1s, max 3 retries).
// On persistent failure → returns null for that source (caller skips indexing).
export async function extractKnowledgeBatch(
  sources: Source[]
): Promise<Array<Omit<KnowledgeEntry, 'project_id' | 'created_at'> | null>>
```

Zod schema for Gemini structured output:

```typescript
const KnowledgeSchema = z.object({
  topic: z.string(),
  facts: z.array(z.string()).min(1).max(10),
  entities: z.array(z.object({
    name: z.string(),
    type: z.enum(['person','organization','technology','concept','event','location','other']),
    description: z.string().optional(),
  })),
  raw_summary: z.string().max(500),
});
```

**Concurrency control**: Uses `p-limit` (npm package) to cap Gemini API calls at 5 concurrent requests. The `extractKnowledgeBatch` function is the only public entry point for batch operations, ensuring the limit is always enforced.

### `lib/search-provider.ts`

```typescript
export class ExaProvider implements ISearchProvider {
  name = 'exa';
  async search(queries: string[]): Promise<Source[]>
}

export class GoogleProvider implements ISearchProvider {
  name = 'google';
  async search(_queries: string[]): Promise<Source[]> { return []; }
}

export function getActiveProviders(): ISearchProvider[]
```

### `lib/incremental-search.ts`

```typescript
export async function incrementalSearch(
  projectId: string,
  keyword: string,
  subQueries: string[]
): Promise<{ sources: Source[]; knowledgeEntries: KnowledgeEntry[]; stats: SearchStats }>
```

**Internal pipeline** (within `incrementalSearch`):

```
1. coverageResults[] = await Promise.all(subQueries.map(q => checkCoverage(projectId, q)))
2. uncoveredQueries = coverageResults.filter(r => !r.covered).map(r => r.subQuery)
3. externalSources = await Promise.all(providers.map(p => p.search(uncoveredQueries)))
4. extracted = await extractKnowledgeBatch(flatten(externalSources))
5. Promise.allSettled(extracted.filter(Boolean).map(e => indexKnowledge({...e, project_id})))
6. cachedSources = coverageResults.filter(r => r.covered)
                     .flatMap(r => r.existingEntries.map(toSource))
7. allSources = [...cachedSources, ...flatten(externalSources)]
8. dedupedSources = urlDedup(allSources)  ← final URL-level dedup pass
9. log SearchStats at INFO level; WARN if cacheHitRate === 0 after > 1 search in project
10. return { sources: dedupedSources, knowledgeEntries, stats }
```

**URL dedup** (step 8): Ensures no duplicate URLs in final output, regardless of whether sources came from knowledge-cache or external providers. This addresses the gap where semantic dedup (cosine 0.85) catches content overlap but not URL-level duplicates from different providers returning the same page.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| ES unavailable / connection failure | Degrade to pure external search; do not write to knowledge-cache |
| kNN model not deployed | Catch exception, mark all sub-queries as "uncovered", fallback to full external search |
| kNN query timeout (>3s) | `AbortSignal.timeout(3000)` triggers; treat subQuery as "uncovered" **(P0 fix)** |
| Gemini extraction failure (per source) | Skip knowledge indexing for that source; still use raw Source for report; increment `stats.extractionErrors` |
| Gemini 429 rate limit | Exponential backoff (1s base, max 3 retries); persistent 429 → skip source **(P0 fix)** |
| Empty `project_id` | Default to `"default"` for backward compatibility |
| Duplicate source_url (concurrent) | `op_type:'create'` + deterministic `_id = sha256(project_id + source_url)` → 409 silently swallowed **(P1 fix)** |
| Stale knowledge | v1: no expiry; v2: add `created_at` range filter |
| Incorrect Gemini extraction | `deleteKnowledge(projectId, sourceUrl)` allows manual correction **(P2 fix)** |
| First search (empty index) | All sub-queries "uncovered", equivalent to current behavior |
| URL duplicates across providers | Final `urlDedup()` pass before returning sources **(P1 fix)** |

## Performance

- **Non-blocking writes**: `indexKnowledge()` via `Promise.allSettled()`, response returns immediately
- **Controlled extraction**: `extractKnowledgeBatch()` uses `p-limit(5)` to cap Gemini concurrency; prevents 429 storms
- **kNN timeout budget**: 3s per subQuery × 5 subQueries = 15s worst-case; in practice kNN returns in <500ms
- **kNN cold start**: Empty index returns empty results, automatic full external search, zero added latency
- **Incremental benefit**: Cache hit rate increases with usage; by 3rd search on same topic, most queries hit ES

## Evaluator Integration

### D2: Search Quality Probe — Extended

Extend `search-quality.ts` (D2 probe):
- Add `knowledgeCacheHitRate` metric from `stats` field in `/api/research/fetch` response
- Coverage > 80% indicates well-populated knowledge base
- Add `knowledgeCacheAvailable` check: kNN query to `knowledge-cache` with test vector must return 2xx within 3s

### Source Origin Tracking — BackendJudge Compatibility

The existing `backend-judge.ts` uses `url.includes('#internal')` to classify source diversity. With this design:
- `Source.origin` field explicitly marks provenance: `'exa' | 'google' | 'knowledge-cache'`
- `ExaProvider.search()` sets `origin: 'exa'` on returned sources
- `toSource()` sets `origin: 'knowledge-cache'` on knowledge-cache entries
- `backend-judge.ts` should migrate from URL heuristic to `origin` field check (backward-compatible: treat missing `origin` as legacy behavior)

### D4: Cache Effectiveness Probe — knowledge-cache Health

Add a sub-check to D4 or D2:
- `POST /api/research/fetch` with known `project_id` → verify `stats.coveredByCache >= 0` (field presence)
- kNN health: `GET knowledge-cache/_search` with `size:1` must succeed

## Security

### project_id Access Control (P2 — v2 scope)

In v1, `project_id` is passed directly in the request body. This is acceptable for single-user / hackathon use but introduces risks in multi-tenant scenarios:
- Any client can query or pollute another project's knowledge base
- No audit trail for who wrote what knowledge

**v1 mitigation**: Document that `project_id` is untrusted in v1. Log all writes with `project_id` + source IP.

**v2 plan**: Derive `project_id` from authenticated session/token. Add middleware-level ACL check in `knowledge-store.ts` functions.

## Observability

### Structured Logging

`incrementalSearch()` emits structured log entries at two levels:

```typescript
// INFO — every invocation
logger.info('incremental-search', {
  projectId, keyword,
  stats: { totalSubQueries, coveredByCache, fetchedFromExternal, newEntriesIndexed, cacheHitRate, extractionErrors }
});

// WARN — anomaly detection
if (stats.cacheHitRate === 0 && projectHasPriorSearches) {
  logger.warn('knowledge-cache-miss', { projectId, keyword, message: 'Zero cache hits despite existing knowledge' });
}
if (stats.extractionErrors > 0) {
  logger.warn('extraction-errors', { projectId, errorCount: stats.extractionErrors });
}
```

### Metrics Surfacing

`SearchStats` is returned in the `/api/research/fetch` response body, enabling:
- Frontend display (e.g., "3/5 sub-queries hit knowledge cache")
- Backend evaluator probe consumption
- Future: aggregate dashboards via log aggregation

## Migration

No breaking changes. The `project_id` parameter is optional with `"default"` fallback. Existing `/api/research/fetch` calls without `project_id` work identically to current behavior (all sub-queries are "uncovered" on first call → full external search → results written to knowledge-cache for future reuse).
