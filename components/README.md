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

All components use `'use client'` directive and Framer Motion for animations.
