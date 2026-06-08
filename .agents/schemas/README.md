# schemas/ — SSOT JSON Schemas

JSON Schema definitions that enforce structural uniformity across all agent artifacts.

## Files

| Schema | Validates |
|--------|-----------|
| `trace.schema.json` | Execution trace records in `.agents/traces/` |
| `evaluation.schema.json` | Evaluation verdicts stored in `golden/` and `failures/` |
| `evaluator-config.schema.json` | HITL-initialized Evaluator configuration |
| `agent-md.schema.json` | Structural format of all `AGENT.md` files |

## Usage

```bash
python scripts/lint-agent-md.py   # Validate AGENT.md files
```

Schemas follow JSON Schema Draft 2020-12.
