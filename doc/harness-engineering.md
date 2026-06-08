# Harness Engineering — Development Workflow

## Overview

Searchkiller uses a **harness-engineering** pattern: the repository structure itself is the agent runtime. Two agents (Planner, Evaluator) operate deterministically on traced state stored in `.agents/`.

The Evaluator is **initialized by a human via HITL**, then runs autonomously.

---

## 1. Initialize the Evaluator (HITL — one-time setup)

Before any evaluation can run, a human must define the Evaluator's criteria:

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "initialize",
    "initialized_by": "your-name",
    "criteria": {
      "require_schema_valid": true,
      "require_output_non_empty": true,
      "reject_known_failure_patterns": true,
      "custom_rules": [
        {
          "name": "latency_under_5s",
          "field": "metadata.duration_ms",
          "operator": "lt",
          "value": 5000
        }
      ]
    },
    "thresholds": {
      "max_latency_ms": 30000,
      "min_source_count": 3
    },
    "auto_approve": true,
    "notes": "Initial config for hackathon demo"
  }'
```

This writes `.agents/evaluator-config.json`. The Evaluator is now ready.

To update criteria later, call `initialize` again — it overwrites the config.

## 2. Read Current Config

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"action": "config"}'
```

## 3. Run a Full Evaluation Cycle

The `evaluate` action runs the complete pipeline: Planner emits a trace, Evaluator judges it autonomously.

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "evaluate",
    "keyword": "AI Agent architecture trends",
    "subQueries": [
      "What are the main AI agent frameworks in 2026?",
      "How do multi-agent systems handle task decomposition?",
      "What are the challenges of autonomous AI agents?"
    ]
  }'
```

Response includes:
- `traceId` — the trace record ID
- `evaluation.verdict` — `APPROVED` or `REJECTED`
- `evaluation.quality_checks` — detailed check results
- `recycledTo` — `golden` or `failures`
- `preScreenWarnings` — any matches against known failure patterns

## 4. Evaluate an Existing Trace

If a trace was already emitted by the Planner:

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"action": "evaluate_trace", "traceId": "trace-abc12345"}'
```

## 5. Check System Stats

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"action": "stats"}'
```

Returns: `evaluatorInitialized`, `totalTraces`, `goldenCount`, `failureCount`, `pendingCount`.

---

## Architecture Diagram

```
Human (HITL)
  │
  ▼
POST /api/evaluate {action: "initialize"}
  │
  ▼
.agents/evaluator-config.json  ◄── persisted criteria
  │
  │  (one-time, re-configurable)
  │
  ▼
POST /api/evaluate {action: "evaluate"}
  │
  ├── Planner.plan(keyword)
  │     └── .agents/traces/{id}.json  (verdict: PENDING)
  │
  └── Evaluator.evaluate(traceId)  [autonomous]
        │
        ├── checks pass → APPROVED → .agents/golden/{id}.json
        └── checks fail → REJECTED → .agents/failures/{id}.json
```

## Evaluator Config Schema

The config JSON follows `.agents/schemas/evaluator-config.schema.json`:

| Field | Type | Description |
|-------|------|-------------|
| `initialized_by` | string | Human identifier |
| `criteria.require_schema_valid` | bool | Reject invalid traces |
| `criteria.require_output_non_empty` | bool | Reject empty outputs |
| `criteria.reject_known_failure_patterns` | bool | Cross-check failure store |
| `criteria.custom_rules[]` | array | Field-level checks (name, field, operator, value) |
| `thresholds.max_latency_ms` | int | Max acceptable latency |
| `thresholds.min_source_count` | int | Min required sources |
| `auto_approve` | bool | Auto-approve passing traces |

## SSOT Verification

After any structural change, run:

```bash
bash scripts/verify-dual-md.sh   # All dirs have README.md + AGENT.md
python scripts/lint-agent-md.py  # AGENT.md structure valid
python scripts/uniformize.py     # Auto-fix missing stubs
```

## Git Worktree for Features

```bash
bash scripts/worktree-new.sh my-feature
cd ../Searchkiller-my-feature
npm install && npm run dev
```
