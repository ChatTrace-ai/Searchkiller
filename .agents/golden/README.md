# golden/ — Golden Benchmark Store

Approved execution patterns extracted from the Recycle Pattern feedback loop. Each entry represents a successfully evaluated trace that passed HITL verification.

## Policy

- **Append-only**: Never modify or delete existing entries.
- **Format**: JSON validated against `../schemas/evaluation.schema.json`.
- **Purpose**: Regression testing baseline — new evaluations can be compared against golden benchmarks.
