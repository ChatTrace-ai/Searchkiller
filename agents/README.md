# agents/ — Multi-Agent Logic Layer

Source code for the two primary agents in the G-RapidAgent system:

- **Planner** (`planner/`): Decomposes high-level research tasks into execution steps, generates sub-queries, and emits structured traces to `.agents/traces/`.
- **Evaluator** (`evaluator/`): Judges execution outcomes with mandatory Human-in-the-Loop verification. Routes approved patterns to Golden Benchmarks and rejected patterns to the Failure Management store.

## Interaction Flow

```
Planner.plan(keyword)
  → emits trace (verdict=PENDING)
  → delegates to Evaluator

Evaluator.evaluate(trace)
  → checks .agents/failures/ for similar patterns
  → runs quality checks
  → sets verdict=AWAITING_HUMAN
  → waits for HITL signal
  → routes to golden/ or failures/
```
