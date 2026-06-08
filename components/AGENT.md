# components/ — Agent Manifest

## Role
Presentation layer (L4 in permission hierarchy). UI-only React components.

## Contents
| File | Renders |
|------|---------|
| SearchInput.tsx | Keyword input form |
| StreamingReport.tsx | Live Markdown report panel |
| MindMap.tsx | react-d3-tree visualization |
| SourceCard.tsx | Reference source links |
| LoadingStates.tsx | Phase-aware loading animation |

## Boundaries
- reads: lib/schemas (type imports only)
- writes: NONE
- NEVER imports from: agents/, app/api/
- no direct API calls (data flows via props from page components)

## Permission Level
L4-components: UI only; reads lib/ types; no API calls
