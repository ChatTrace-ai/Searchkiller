# traces/ — Execution Trace Store

Runtime execution traces emitted by the Planner agent and judged by the Evaluator agent. Each trace records a discrete unit of agent work.

## Trace Lifecycle

```
PENDING → AWAITING_HUMAN → APPROVED → golden/
                         → REJECTED → failures/
```

## Format

JSON validated against `../schemas/trace.schema.json`. Key fields:
- `id`: Unique trace identifier
- `agent`: Which agent emitted the trace
- `action`: What was performed
- `input_hash` / `output_hash`: Content-addressable references
- `timestamp`: ISO 8601
- `verdict`: Current evaluation state
