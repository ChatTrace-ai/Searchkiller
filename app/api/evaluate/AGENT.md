# evaluate/ — Agent Manifest

## Role
Evaluator lifecycle API: HITL initialization + autonomous evaluation + stats.

## Contents
| File | Description |
|------|-------------|
| route.ts | POST handler: {action, ...payload} → evaluation result |

## Boundaries
- reads: agents/evaluator (initializeEvaluator, loadConfig, isInitialized), agents/recycle (recycle, evaluateExisting, getRecycleStats)
- writes: .agents/evaluator-config.json (initialize), .agents/traces/, .agents/golden/, .agents/failures/ (via agents layer)
