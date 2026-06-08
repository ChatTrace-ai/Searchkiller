# evaluator/ — Evaluator Agent (HITL-Initialized, Autonomous)

The Evaluator is **initialized by a human** via HITL and then **runs autonomously**.

## HITL Initialization (one-time or re-configurable)

The human defines evaluation criteria by calling `POST /api/evaluate {action: "initialize"}`:
- **Criteria**: schema validation, output non-empty, known failure pattern rejection
- **Thresholds**: max latency, min source count, min quality score
- **Custom rules**: field-level checks (e.g., `metadata.duration_ms < 5000`)
- **Auto-approve**: whether passing traces are auto-approved

The config is persisted to `.agents/evaluator-config.json`.

## Autonomous Evaluation (every trace)

Once initialized, the Evaluator processes traces without human intervention:

1. Loads trace from `.agents/traces/`
2. Loads persisted config from `.agents/evaluator-config.json`
3. Runs all quality checks against the human-defined criteria
4. All pass → APPROVED → `.agents/golden/`
5. Any fail → REJECTED → `.agents/failures/` with auto-generated root cause

The human can re-initialize at any time to update criteria.
