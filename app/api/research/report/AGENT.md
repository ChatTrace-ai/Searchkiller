# report/ — Agent Manifest

## Role
Markdown report streaming via Gemini Pro.

## Contents
| File | Description |
|------|-------------|
| route.ts | POST handler: {sessionId} → streaming Markdown text |

## Boundaries
- reads: lib/gemini (proModel), in-memory session store
- writes: NONE (streaming response)
