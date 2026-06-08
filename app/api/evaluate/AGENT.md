# evaluate/ — Agent Manifest

## Role
HITL evaluation API: initiate, finalize, and query the recycle pattern.

## Contents
| File | Description |
|------|-------------|
| route.ts | POST handler: {action, ...payload} → evaluation result |

## Boundaries
- reads: agents/recycle (initiateRecycle, completeRecycle, getRecycleStats)
- writes: .agents/traces/, .agents/golden/, .agents/failures/ (via agents layer)
