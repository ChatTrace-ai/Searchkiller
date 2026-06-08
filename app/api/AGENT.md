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

## Boundaries
- reads: lib/gemini, lib/exa, lib/elasticsearch, lib/schemas, agents/recycle
- writes: in-memory session cache (research/fetch), .agents/ (evaluate route via agents layer)
- consumers: app/research/page.tsx (client-side fetch)

## Data Flow
plan(keyword) → fetch(keyword, subQueries) → parallel(report(sid), mindmap(sid))
evaluate(initiate|finalize|stats) → agents/recycle → .agents/
