# lib/ — Shared Utilities

Pure utility modules consumed by the application and agent layers.

## Modules

| Module | Description |
|--------|-------------|
| `gemini.ts` | Gemini Flash / Pro model instances via `@ai-sdk/google-vertex` (Vertex AI) |
| `exa.ts` | Exa.ai semantic search client (lazy-initialized to avoid build-time key access) |
| `elasticsearch.ts` | Elasticsearch Serverless hybrid search, BM25 + kNN (lazy-initialized) |
| `schemas.ts` | Zod 4 schemas (`mindMapSchema`) and TypeScript interfaces (`Source`, `ResearchContext`, `MindMapNode`) |
| `context-cache.ts` | In-memory session cache (`Map<string, ResearchContext>`) shared by research API routes |

## Design Constraints

- **Zero side effects**: modules export pure functions and lazy-initialized client getters.
- **No upward imports**: lib/ never imports from app/, components/, or agents/.
- **Lazy initialization**: Exa and Elasticsearch clients use getter functions to defer API key reads to runtime (prevents Next.js build failures when keys are absent).
