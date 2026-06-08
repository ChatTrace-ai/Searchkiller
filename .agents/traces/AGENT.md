# traces/ — Agent Manifest

## Role
Execution trace log for the Planner → Evaluator pipeline.

## Contents
| Pattern | Description |
|---------|-------------|
| *.json | Individual execution trace records |

## Boundaries
- reads: agents/evaluator (loads for autonomous judgment)
- writes: agents/planner (emits new traces), agents/evaluator (updates verdict)
- schema: ../schemas/trace.schema.json

## Invariants
- Traces are immutable once verdict leaves PENDING state
- Verdict field transitions: PENDING → APPROVED | REJECTED
- Each trace resolves to exactly one of golden/ or failures/
