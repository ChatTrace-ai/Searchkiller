# agents/ — Agent Manifest

## Role
Multi-agent orchestration layer (L1 in permission hierarchy). Implements harness interfaces.

## Contents
| Path | Description |
|------|-------------|
| planner/ | Task decomposition + trace emission |
| evaluator/ | HITL-initialized autonomous judgment + recycle routing |
| evaluator/llm-judge.ts | LLM-as-Judge: Gemini Flash 4-dim scoring (thinkingBudget=0, ~4s) |
| mcp/ | MCP bridges (Playwright test runner) |
| recycle.ts | Recycle pattern engine (plan → evaluate → route) |
| handoff.ts | Re-export from harness/handoff.ts |
| sprint-contract.ts | Re-export from harness/sprint-contract.ts |
| feedback-loop.ts | Legacy feedback loop (use harness/feedback-loop.ts via lib/harness-adapter.ts instead) |

## Boundaries
- reads: lib/ (L3), harness/ (L0)
- writes: .agents/traces/, .agents/golden/, .agents/failures/
- imports_from: lib/ (L3), harness/ (L0 — via re-exports)
- NEVER imported by: app/ (use lib/harness-adapter.ts instead)

## Permission Level
L1-agents: implements harness interfaces; orchestration logic
