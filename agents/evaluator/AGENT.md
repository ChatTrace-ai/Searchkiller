# evaluator/ — Agent Manifest

## Role
Outcome judgment with mandatory HITL verification gate.

## Contents
| File | Description |
|------|-------------|
| index.ts | Evaluator agent entry point and public API |

## Boundaries
- reads: .agents/traces/, .agents/golden/, .agents/failures/, .agents/schemas/
- writes: .agents/golden/, .agents/failures/, .agents/traces/ (verdict update)
- requires: human_approval BEFORE finalizing verdict

## Contract
- Input: trace ID referencing .agents/traces/{id}.json
- Output: Verdict (APPROVED → golden/, REJECTED → failures/)
- Constraint: NEVER auto-approve; always gate on HITL signal
