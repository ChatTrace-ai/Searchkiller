# planner/ — Agent Manifest

## Role
Task decomposition, execution mapping, trace emission.

## Contents
| File | Description |
|------|-------------|
| index.ts | Planner agent entry point and public API |

## Boundaries
- reads: app/, lib/, .agents/schemas/, .agents/traces/
- writes: .agents/traces/ (emits new traces with verdict=PENDING)
- delegates_to: agents/evaluator/

## Contract
- Input: keyword (string) + optional config
- Output: Trace record written to .agents/traces/{id}.json
- Constraint: MUST produce structured trace before delegating
