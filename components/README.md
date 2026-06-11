# components/ — React UI Components

Client-side React components for the research dashboard interface.

## Components

| Component | Description |
|-----------|-------------|
| `StreamingReport.tsx` | Live Markdown report panel with typing cursor animation |
| `SourceCard.tsx` | Clickable reference source chips/cards |
| `LoadingStates.tsx` | Animated loading indicators (pulsing dots + status text) |
| `BrandMark.tsx` | Shared Searchkiller brand treatment |
| `PredictionSearch.tsx` | Reusable prediction search form |
| `PredictionHeader.tsx` | Detail-page navigation and search |
| `PredictionCard.tsx` | Popular prediction card with leading outcomes |
| `PaginatedPredictionGrid.tsx` | Displays 16 paginated cards from page-owned data |
| `PredictionProgressView.tsx` | Fixed-height progress workspace with independently scrolling live output |
| `PredictionDetailView.tsx` | Responsive probability table with independently scrolling source and report panels |

Interactive components use `'use client'` where browser state is required.
Legacy research components use Framer Motion; prediction components use CSS
transitions and Tailwind animations.
