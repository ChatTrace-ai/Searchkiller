# failures/ — Agent Manifest

## Role
Store for rejected execution patterns with root-cause diagnostics.

## Contents
| Pattern | Description |
|---------|-------------|
| *.json | Rejected trace + evaluation with {root_cause, lesson} |

## Boundaries
- reads: agents/evaluator (pre-evaluation pattern check)
- writes: agents/evaluator (on REJECTED verdict)
- schema: ../schemas/evaluation.schema.json

## Invariants
- Each entry includes root_cause and lesson fields
- Evaluator MUST query this store before emitting new evaluations
