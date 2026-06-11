# lib/ — Shared Utilities & Harness Adapter

Pure utility modules consumed by the application and agent layers, plus the harness adapter that bridges them.

## Modules

| Module | Description |
|--------|-------------|
| `gemini.ts` | Gemini Flash / Pro model instances via `@ai-sdk/google-vertex` (Vertex AI) |
| `exa.ts` | Exa.ai semantic search client (lazy-initialized) |
| `elasticsearch.ts` | Elasticsearch Serverless hybrid search, BM25 + kNN (lazy-initialized) |
| `schemas.ts` | Zod 4 schemas (`mindMapSchema`) and TypeScript interfaces (`Source`, `ResearchContext`, `MindMapNode`) |
| `context-cache.ts` | In-memory session cache (`Map<string, ResearchContext>`) shared by research API routes |
| `prediction-types.ts` | Prediction API v1 request and response contracts |
| `prediction-generator.ts` | Real prediction pipeline: Plan (Gemini Flash) → Exa search → Analyze (Flash) → Report (Gemini Pro) → Elasticsearch |
| `prediction-store.ts` | Elasticsearch-backed prediction CRUD, featured seeding, cursor pagination; triggers `generateRealPrediction()` fire-and-forget |
| `prediction-seeds.ts` | Static featured prediction seed catalog and `buildDetail()` helpers |
| `es-client.ts` | Lazy-initialized Elasticsearch Serverless client for the predictions index |
| `search-provider.ts` | Pluggable search providers (`ExaProvider`, `GoogleProvider`) used by the prediction generator |
| `harness-adapter.ts` | **Sole bridge** between `harness/` (L0) and `agents/` (L1). Implements `IJudge` and `IReportGenerator`, provides `planSubQueries`, `fetchSources`, and loop management functions |

## Prediction Pipeline

```
generateRealPrediction(id, question)
  → Plan sub-queries       (Gemini Flash)
  → Fetch sources          (Exa via search-provider)
  → Analyze probabilities  (Gemini Flash)
  → Stream report          (Gemini Pro)
  → Persist detail         (Elasticsearch predictions index)
```

`createPrediction` / `refreshPrediction` in `prediction-store.ts` write a processing record to ES and invoke `generateRealPrediction()` asynchronously.

## Harness Adapter Pipeline

```
planSubQueries(keyword)     → Gemini Flash → sub-queries
fetchSources(kw, queries)   → Exa.ai + ES  → HandoffSource[]
startLoop({keyword})        → Gen (Pro) + Judge (Flash) → LoopState
loopNext(loopId, feedback)  → Iteration → improved score
```

## Design Constraints

- **Zero side effects**: most utility modules export pure functions and lazy-initialized client getters; prediction-store/generator write to Elasticsearch.
- **No upward imports**: lib/ never imports from app/ or components/.
- **Lazy initialization**: Exa and Elasticsearch clients defer API key reads to runtime.
- **harness-adapter.ts** is the ONLY file that imports from both `harness/` and `agents/` — all other lib modules are leaf dependencies.
