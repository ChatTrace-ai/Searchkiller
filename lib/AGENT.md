# lib/ — Agent Manifest

## Role
Shared utilities and harness adapter (L3 in permission hierarchy).

## Contents
| File | Exports |
|------|---------|
| gemini.ts | flashModel, proModel (via `@ai-sdk/google-vertex`) |
| exa.ts | getExa() (lazy-init), semanticSearch() |
| elasticsearch.ts | getClient() (lazy-init), hybridSearch() |
| schemas.ts | mindMapSchema (Zod 4), MindMapNode, Source, ResearchContext |
| context-cache.ts | contextCache (Map\<string, ResearchContext\>) |
| prediction-types.ts | PredictionStatus, PredictionSummary, PredictionDetail, API response types |
| prediction-generator.ts | generateRealPrediction() — Plan (Flash) → Exa → Analyze (Flash) → Report (Pro) → ES |
| prediction-store.ts | ES-backed CRUD, featured seeding, cursor pagination, fire-and-forget generation |
| prediction-seeds.ts | Featured prediction seed catalog, buildDetail(), RESULT_TTL_MS |
| es-client.ts | getClient() (lazy-init Elasticsearch Serverless) |
| search-provider.ts | ISearchProvider implementations (Exa, Google), getActiveProviders() |
| harness-adapter.ts | SearchkillerJudge, SearchkillerReportGenerator, planSubQueries, fetchSources, startLoop, loopNext, loopApprove, loopCancel |

## Boundaries
- reads: NONE (leaf dependency, except harness-adapter which bridges L0+L1)
- writes: NONE (except harness-adapter → .agents/, prediction-store/generator → Elasticsearch predictions index)
- imported_by: app/api/*, agents/*
- harness-adapter.ts: ONLY file that imports from both harness/ and agents/
- NEVER imports from: app/, components/

## Permission Level
L3-lib: pure utilities; harness-adapter is the sole bridge between L0 (harness) and L1 (agents)
