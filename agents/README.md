# agents/ — Multi-Agent Logic Layer

Source code for the two primary agents in the Searchkiller system:

- **Planner** (`planner/`): Decomposes high-level research tasks into execution steps, generates sub-queries, and emits structured traces to `.agents/traces/`.
- **Evaluator** (`evaluator/`): Initialized by a human via HITL (defining criteria, thresholds, and rules), then runs autonomously to judge execution outcomes. Routes approved patterns to Golden Benchmarks and rejected patterns to the Failure Management store.

## Interaction Flow

```
Human initializes Evaluator (HITL)
  → defines criteria, thresholds, custom rules
  → persisted to .agents/evaluator-config.json

Planner.plan(keyword)
  → emits trace (verdict=PENDING)

Evaluator.evaluate(traceId)  [autonomous]
  → loads config + trace
  → runs quality checks against human-defined criteria
  → routes to golden/ or failures/
```
