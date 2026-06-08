# .agents/ — Agent Manifest

## Role
Runtime state store for the multi-agent trace system.

## Contents
| Path | Type | Description |
|------|------|-------------|
| schemas/ | dir | JSON Schema definitions for SSOT enforcement |
| traces/ | dir | Execution trace records (planner → evaluator) |
| golden/ | dir | Approved patterns (append-only benchmark store) |
| failures/ | dir | Rejected patterns with root-cause metadata |
| evaluator-config.json | file | HITL-initialized Evaluator config (created at runtime) |

## Boundaries
- reads: agents/, scripts/
- writes: agents/ (via planner.emit, evaluator.evaluate, evaluator.initializeEvaluator)
- owner: L1-agents layer

## Invariants
- Every JSON file validates against its corresponding schema
- golden/ is append-only; deletions require manual override
- Each trace resolves to exactly one store (golden XOR failures)
- evaluator-config.json must exist before any evaluation runs
