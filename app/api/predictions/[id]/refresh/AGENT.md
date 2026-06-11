# refresh/ — Agent Manifest

## Role
Restart mock prediction generation.

## Contents
| File | Description |
|------|-------------|
| route.ts | Starts refresh or returns not-found/in-progress errors |

## Boundaries
- reads: prediction store
- writes: prediction state through the store API
