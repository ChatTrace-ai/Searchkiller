# lib/ — Agent Manifest

## Role
Pure shared utilities (L3 in permission hierarchy).

## Contents
| File | Exports |
|------|---------|
| gemini.ts | flashModel, proModel |
| exa.ts | exaClient, searchAndContents() |
| elasticsearch.ts | esClient, hybridSearch() |
| schemas.ts | mindMapSchema (Zod), MindMapNode, Source, ResearchContext |

## Boundaries
- reads: NONE (leaf dependency)
- writes: NONE
- imported_by: app/api/*, agents/*
- NEVER imports from: app/, components/, agents/

## Permission Level
L3-lib: pure utilities; ZERO side effects; no upward imports
