# evaluator/ — Agent Manifest

## Role
Autonomous outcome judgment using HITL-initialized criteria and LLM-as-Judge.

## Contents
| File | Description |
|------|-------------|
| index.ts | Evaluator: initializeEvaluator (HITL), evaluate (autonomous), query utilities |
| llm-judge.ts | LLM-as-Judge: Gemini Flash 4-dim scoring (implements IJudge interface) |

## LLM-Judge Speed Optimizations
- `thinkingBudget: 0` — disables Flash reasoning loop (not needed for scoring)
- Report text capped at 12K chars — bounds token usage
- Compact system prompt — reduces overhead
- Result: **186s → 3.7s** (50x faster)

## Boundaries
- reads: .agents/traces/, .agents/golden/, .agents/failures/, .agents/evaluator-config.json, .agents/handoffs/
- writes: .agents/golden/, .agents/failures/, .agents/traces/ (verdict update)
- imports: lib/gemini.ts (flashModel), harness/sprint-contract (ScoreDimension), harness/handoff (HandoffDocument)

## Contract
- Initialization: Human calls initializeEvaluator({criteria, thresholds}) via HITL
- Evaluation: evaluate(traceId) → autonomous verdict → route to golden/failures
- LLM-Judge: runLLMJudge(handoff, dimensions) → structured 4-dim scores + feedback
