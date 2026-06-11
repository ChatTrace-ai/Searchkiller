# app/ — Agent Manifest

## Role
Next.js App Router layer (L2 in permission hierarchy).

## Contents
| Path | Type | Description |
|------|------|-------------|
| page.tsx | page | Landing / search entry |
| use-create-prediction.ts | client orchestration | Prediction creation and navigation |
| use-prediction-pagination.ts | client orchestration | Popular prediction pagination state and API calls |
| layout.tsx | layout | Root English HTML shell and metadata |
| globals.css | styles | Global CSS + Tailwind directives |
| research/page.tsx | page | Research orchestration dashboard |
| prediction/[id]/page.tsx | page | Prediction polling and result dashboard |
| api/plan/route.ts | API | Query planner (Gemini Flash) |
| api/research/fetch/route.ts | API | Exa + ES context retrieval |
| api/research/report/route.ts | API | Markdown report stream (Gemini Pro) |
| api/research/mindmap/route.ts | API | Mind-map JSON stream (Gemini Pro) |
| api/predictions/* | API | Prediction v1 mock endpoints |

## Boundaries
- reads: lib/ (L3)
- writes: NONE (stateless request handlers)
- NEVER imports from: agents/ (L1)
- imported_by: NONE (entry points)

## Permission Level
L2-app: routes & pages; reads L3; NEVER imports from agents/
