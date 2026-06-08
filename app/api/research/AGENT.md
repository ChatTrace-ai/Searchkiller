# research/ — Agent Manifest

## Role
Research pipeline routes: fetch context, stream report, stream mind-map.

## Contents
| Path | Description |
|------|-------------|
| fetch/route.ts | Exa + ES retrieval → sessionId + sources |
| report/route.ts | Gemini Pro Markdown stream by sessionId |
| mindmap/route.ts | Gemini Pro mind-map JSON stream by sessionId |

## Boundaries
- reads: lib/gemini, lib/exa, lib/elasticsearch, lib/schemas
- writes: in-memory session cache (fetch route only)
