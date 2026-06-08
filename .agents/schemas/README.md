# schemas/ — SSOT JSON Schemas

JSON Schema definitions that enforce structural uniformity across all agent artifacts.

## Files

| Schema | Validates |
|--------|-----------|
| `trace.schema.json` | Execution trace records in `.agents/traces/` |
| `evaluation.schema.json` | HITL evaluation verdicts attached to traces |
| `agent-md.schema.json` | Structural format of all `AGENT.md` files |

## Usage

```bash
python scripts/lint-agent-md.py   # Validate AGENT.md files
```

Schemas follow JSON Schema Draft 2020-12.
