# mindmap/ — Agent Manifest

## Role
Mind-map JSON streaming via Gemini Pro.

## Contents
| File | Description |
|------|-------------|
| route.ts | POST handler: {sessionId} → streaming tree-JSON |

## Boundaries
- reads: lib/gemini (proModel), lib/schemas (mindMapSchema), in-memory session store
- writes: NONE (streaming response)
