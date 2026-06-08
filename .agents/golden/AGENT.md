# golden/ — Agent Manifest

## Role
Append-only store for approved execution patterns (Golden Benchmarks).

## Contents
| Pattern | Description |
|---------|-------------|
| *.json | Approved trace + evaluation records |

## Boundaries
- reads: agents/evaluator (for regression comparison)
- writes: agents/evaluator (append-only on APPROVED verdict)
- schema: ../schemas/evaluation.schema.json

## Invariants
- Files are never modified after creation
- Each file ID matches a trace ID from .agents/traces/
