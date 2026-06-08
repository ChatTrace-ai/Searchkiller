# schemas/ — Agent Manifest

## Role
SSOT schema definitions for all structured agent artifacts.

## Contents
| File | Validates |
|------|-----------|
| trace.schema.json | .agents/traces/*.json |
| evaluation.schema.json | .agents/golden/*.json and .agents/failures/*.json |
| evaluator-config.schema.json | .agents/evaluator-config.json (HITL-initialized config) |
| agent-md.schema.json | All AGENT.md files project-wide |

## Boundaries
- reads: scripts/ (lint-agent-md.py consumes these)
- writes: NONE (schemas are authoritative; change requires review)
- consumers: agents/planner, agents/evaluator, scripts/*
