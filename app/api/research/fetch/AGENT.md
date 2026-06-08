# fetch/ — Agent Manifest

## Role
Context retrieval: Exa + Elasticsearch parallel fetch, session caching.

## Contents
| File | Description |
|------|-------------|
| route.ts | POST handler: {keyword, subQueries} → {sessionId, sources} |

## Boundaries
- reads: lib/exa, lib/elasticsearch
- writes: in-memory session store (keyed by sessionId)
