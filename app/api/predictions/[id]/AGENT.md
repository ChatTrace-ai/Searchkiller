# [id]/ — Agent Manifest

## Role
Prediction detail lookup and refresh routing.

## Contents
| File | Description |
|------|-------------|
| route.ts | Returns progress or completed prediction detail |
| refresh/ | Restarts prediction generation |

## Boundaries
- reads: parent prediction store and response helper
- writes: NONE directly; refresh delegates mutations to the parent store
