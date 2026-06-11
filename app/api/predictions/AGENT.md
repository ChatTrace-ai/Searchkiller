# predictions/ — Agent Manifest

## Role
Prediction API v1 orchestration and mock persistence.

## Contents
| File | Description |
|------|-------------|
| route.ts | Create or reuse a prediction |
| store.ts | Featured catalog, cursor pagination, and mutable mock records |
| responses.ts | Unified API error responses |
| popular/ | Featured prediction listing |
| [id]/ | Prediction detail and refresh routes |

## Boundaries
- reads: lib/prediction-types
- writes: process-local in-memory prediction records
- never imports from: components/, agents/
