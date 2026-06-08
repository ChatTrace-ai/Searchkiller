# research/ — Agent Manifest

## Role
Research dashboard page: pipeline orchestration + split-view rendering.

## Contents
| File | Description |
|------|-------------|
| page.tsx | Client component: plan → fetch → parallel streams → split view |

## Boundaries
- reads: components/*, lib/schemas (type imports)
- writes: NONE
- API calls: /api/plan, /api/research/fetch, /api/research/report, /api/research/mindmap
