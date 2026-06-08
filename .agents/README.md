# .agents/ — Agent Runtime State

This directory is the **trace store** backing the repository-as-state-machine pattern. It holds:

- **schemas/**: JSON Schema definitions that enforce SSOT across all agent artifacts
- **traces/**: Execution trace records emitted by the Planner and judged by the Evaluator
- **golden/**: Approved execution patterns (Golden Benchmark store, append-only)
- **failures/**: Rejected patterns with root-cause analysis (Failure Management engine)

## Conventions

- All JSON files in subdirectories must validate against their corresponding schema in `schemas/`.
- `golden/` is append-only — never delete or modify existing entries.
- `failures/` entries are queryable by `root_cause` field for pattern matching.
- Trace lifecycle: `PENDING → AWAITING_HUMAN → APPROVED | REJECTED`.
