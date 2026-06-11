# api/ — Agent Manifest

## Role
REST API surface for the research pipeline.

## Contents
| Route | Method | Handler |
|-------|--------|---------|
| /api/plan | POST | plan/route.ts |
| /api/research/fetch | POST | research/fetch/route.ts |
| /api/research/report | POST | research/report/route.ts |
| /api/research/mindmap | POST | research/mindmap/route.ts |
| /api/evaluate | POST | evaluate/route.ts |
| /api/predictions | POST | predictions/route.ts |
| /api/predictions/popular | GET | predictions/popular/route.ts |
| /api/predictions/:id | GET | predictions/[id]/route.ts |
| /api/predictions/:id/refresh | POST | predictions/[id]/refresh/route.ts |

## Boundaries
- reads: lib/gemini, lib/exa, lib/elasticsearch, lib/schemas, lib/prediction-types, agents/recycle
- writes: in-memory research sessions, Elasticsearch predictions index, .agents/ evaluation state
- consumers: app pages and external API clients

## Data Flow
plan(keyword) → fetch(keyword, subQueries) → parallel(report(sid), mindmap(sid))
evaluate(initiate|finalize|stats) → agents/recycle → .agents/
predictions(popular|create|detail|refresh) → lib/prediction-store
