# app/ — Agent Manifest

## Role
Next.js App Router layer (L2 in permission hierarchy).

## Contents
| Path | Type | Description |
|------|------|-------------|
| page.tsx | page | Landing / search entry |
| layout.tsx | layout | Root HTML shell (dark mode, zh-CN) |
| globals.css | styles | Global CSS + Tailwind directives |
| research/page.tsx | page | Research orchestration dashboard |
| api/plan/route.ts | API | Query planner (Gemini Flash) |
| api/research/fetch/route.ts | API | Exa + ES context retrieval |
| api/research/report/route.ts | API | Markdown report stream (Gemini Pro) |
| api/research/mindmap/route.ts | API | Mind-map JSON stream (Gemini Pro) |

## Boundaries
- reads: lib/ (L3)
- writes: NONE (stateless request handlers)
- NEVER imports from: agents/ (L1)
- imported_by: NONE (entry points)

## Permission Level
L2-app: routes & pages; reads L3; NEVER imports from agents/
