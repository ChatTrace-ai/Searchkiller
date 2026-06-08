# evaluate/ — Evaluator Lifecycle Route

`POST /api/evaluate` — Manages the Evaluator's lifecycle: HITL initialization + autonomous evaluation.

## Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `initialize` | `{initialized_by, criteria, thresholds, auto_approve?, notes?}` | (HITL) Human defines evaluation criteria → persisted config |
| `config` | `{}` | Read current evaluator configuration |
| `evaluate` | `{keyword, subQueries, meta?}` | Full cycle: plan + autonomous evaluation → golden/failures |
| `evaluate_trace` | `{traceId}` | Evaluate an existing trace autonomously |
| `stats` | `{}` | Return recycle system summary counts |

## Architecture

The human initializes the Evaluator once (or re-initializes to update criteria). After that, all `evaluate` and `evaluate_trace` calls run autonomously using the persisted config.
