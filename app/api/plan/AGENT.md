# plan/ — Agent Manifest

## Role
Query planner route: keyword → sub-queries via Gemini Flash.

## Contents
| File | Description |
|------|-------------|
| route.ts | POST handler: {keyword} → {subQueries: string[]} |

## Boundaries
- reads: lib/gemini (flashModel)
- writes: NONE (stateless)
