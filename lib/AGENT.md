# lib/ — Agent Manifest

## Role
Pure shared utilities (L3 in permission hierarchy).

## Contents
| File | Exports |
|------|---------|
| gemini.ts | flashModel, proModel (via `@ai-sdk/google-vertex`) |
| exa.ts | getExa() (lazy-init), searchAndContents() |
| elasticsearch.ts | getClient() (lazy-init), hybridSearch() |
| schemas.ts | mindMapSchema (Zod 4), MindMapNode, Source, ResearchContext |
| context-cache.ts | contextCache (Map\<string, ResearchContext\>) |

## Boundaries
- reads: NONE (leaf dependency)
- writes: NONE
- imported_by: app/api/*, agents/*
- NEVER imports from: app/, components/, agents/

## Permission Level
L3-lib: pure utilities; ZERO side effects; no upward imports
