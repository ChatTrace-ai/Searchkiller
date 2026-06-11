# components/ — React UI Components

Client-side React components for the research dashboard interface.

## Components

| Component | Description |
|-----------|-------------|
| `SearchInput.tsx` | Controlled keyword input form with submit handler |
| `StreamingReport.tsx` | Live Markdown report panel with typing cursor animation |
| `MindMap.tsx` | Interactive D3 tree visualization with custom node rendering |
| `SourceCard.tsx` | Clickable reference source chips/cards |
| `LoadingStates.tsx` | Animated loading indicators (pulsing dots + status text) |
| `BrandMark.tsx` | Shared Searchkiller brand treatment |
| `PredictionSearch.tsx` | Reusable prediction search form |
| `PredictionHeader.tsx` | Detail-page navigation and search |
| `PredictionCard.tsx` | Popular prediction card with leading outcomes |
| `PaginatedPredictionGrid.tsx` | Displays 16 cursor-paginated cards per page |
| `PredictionDetailView.tsx` | Responsive probability table and analysis panels |

Interactive components use `'use client'` where browser state is required.
Legacy research components use Framer Motion; prediction components use CSS
transitions and Tailwind animations.
