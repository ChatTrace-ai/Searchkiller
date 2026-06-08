# lib/ — Shared Utilities

Pure utility modules consumed by the application and agent layers.

## Modules

| Module | Description |
|--------|-------------|
| `gemini.ts` | Gemini Flash / Pro model instances via `@ai-sdk/google` |
| `exa.ts` | Exa.ai semantic search client |
| `elasticsearch.ts` | Elasticsearch Serverless hybrid search (BM25 + kNN) |
| `schemas.ts` | Zod schemas (`mindMapSchema`) and TypeScript interfaces (`Source`, `ResearchContext`, `MindMapNode`) |

## Design Constraints

- **Zero side effects**: modules export pure functions and client instances.
- **No upward imports**: lib/ never imports from app/, components/, or agents/.
