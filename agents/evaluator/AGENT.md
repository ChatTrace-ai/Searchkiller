# evaluator/ — Agent Manifest

## Role
Autonomous outcome judgment using HITL-initialized criteria.

## Contents
| File | Description |
|------|-------------|
| index.ts | Evaluator: initializeEvaluator (HITL), evaluate (autonomous), query utilities |

## Boundaries
- reads: .agents/traces/, .agents/golden/, .agents/failures/, .agents/evaluator-config.json
- writes: .agents/golden/, .agents/failures/, .agents/traces/ (verdict update), .agents/evaluator-config.json
- initialization: Human defines criteria via HITL → persisted config
- runtime: Autonomous judgment against persisted config

## Contract
- Initialization: Human calls initializeEvaluator({criteria, thresholds}) via HITL
- Evaluation: evaluate(traceId) → autonomous verdict → route to golden/failures
- Constraint: MUST be initialized before first evaluation
