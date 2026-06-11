# predictions/ — Agent Manifest

## Role
Prediction API v1 orchestration and Elasticsearch-backed persistence via lib/prediction-store.

## Contents
| File | Description |
|------|-------------|
| route.ts | Create or reuse a prediction |
| responses.ts | Unified API error responses |
| popular/ | Featured prediction listing |
| [id]/ | Prediction detail and refresh routes |
| README.md | Frozen `/events` SSE contract for parallel frontend/backend work |

## Boundaries
- reads: lib/prediction-types, lib/prediction-store
- writes: Elasticsearch predictions index (via lib/prediction-store)
- never imports from: components/, agents/
- `/api/predictions/:id/events` is contract-only in phase one; no route exists yet
