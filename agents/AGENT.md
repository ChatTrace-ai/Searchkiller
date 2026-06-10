# agents/ — Agent Manifest

## Role
Multi-agent orchestration layer (L1 in permission hierarchy).

## Contents
| Path | Description |
|------|-------------|
| planner/ | Task decomposition + trace emission |
| evaluator/ | HITL-initialized autonomous judgment + recycle pattern routing |
| mcp/ | MCP bridges (Playwright test runner) |
| recycle.ts | Recycle pattern engine (plan → evaluate → route) |
| handoff.ts | Structured Handoff Protocol — typed contract between Planner+Generator and Evaluator |
| sprint-contract.ts | Sprint Contract — negotiated acceptance criteria with 4-dim scoring |
| feedback-loop.ts | Feedback Loop Engine — integrates handoff, contract, and LLM-Judge into iterative HITL loop |

## Boundaries
- reads: app/, lib/, .agents/schemas/, .agents/traces/, .agents/golden/, .agents/failures/, .agents/handoffs/
- writes: .agents/traces/, .agents/golden/, .agents/failures/, .agents/handoffs/, .agents/contracts/, .agents/loops/
- imports_from: lib/ (L3)
- NEVER imported by: app/, components/

## Permission Level
L1-agents: orchestration logic; reads L2+, writes .agents/
