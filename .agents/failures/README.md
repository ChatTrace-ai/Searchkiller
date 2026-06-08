# failures/ — Failure Management Store

Rejected execution patterns with root-cause analysis. Each entry represents a trace that failed HITL verification, annotated with diagnostic metadata to prevent recurring errors.

## Policy

- **Queryable**: Entries are indexed by `root_cause` for pattern matching before new evaluations.
- **Format**: JSON validated against `../schemas/evaluation.schema.json` with additional `root_cause` and `lesson` fields.
- **Purpose**: Before evaluating a new trace, the Evaluator checks this store for similar failure patterns.
