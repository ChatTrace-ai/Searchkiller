# components/ — Agent Manifest

## Role
Presentation layer (L4 in permission hierarchy). UI-only React components.

## Contents
| File | Renders |
|------|---------|
| StreamingReport.tsx | Live Markdown report panel |
| MindMap.tsx | react-d3-tree visualization |
| SourceCard.tsx | Reference source links |
| LoadingStates.tsx | Phase-aware loading animation |
| BrandMark.tsx | Shared Searchkiller brand link |
| PredictionSearch.tsx | Prediction question form |
| PredictionHeader.tsx | Detail-page header and search |
| PredictionCard.tsx | Popular prediction summary card |
| PaginatedPredictionGrid.tsx | Props-driven paginated card grid |
| PredictionProgressView.tsx | Fixed-height stage timeline and scrollable stream output panel |
| PredictionDetailView.tsx | Probability layout with bounded source and report scroll panels |

## Boundaries
- reads: lib/schemas and lib/prediction-types (type imports only)
- writes: NONE
- NEVER imports from: agents/, app/api/
- no direct API calls (data flows via props from page components)

## Permission Level
L4-components: UI only; reads lib/ types; no API calls
