# evaluate/ — Agent Manifest

## Role
Evaluator lifecycle API: HITL initialization + autonomous evaluation + feedback loop + stats.

## Contents
| File | Description |
|------|-------------|
| route.ts | POST handler: {action, ...payload} → evaluation/loop result |

## Actions
| Action | Description |
|--------|-------------|
| initialize | (HITL) Define evaluation criteria/thresholds |
| config | Read current evaluator config |
| evaluate | Single-pass autonomous evaluation |
| evaluate_trace | Evaluate existing trace |
| stats | System summary |
| start_loop | Start iterative feedback loop (generate + LLM-Judge + HITL) |
| loop_next | Next iteration round with feedback |
| loop_approve | Approve best version as golden |
| loop_cancel | Cancel active loop |
| loop_status | Get loop state and history |
| loop_list | List all loops |

## Boundaries
- reads: agents/evaluator, agents/recycle, agents/feedback-loop, agents/handoff, agents/sprint-contract
- writes: .agents/evaluator-config.json, .agents/traces/, .agents/golden/, .agents/failures/, .agents/handoffs/, .agents/contracts/, .agents/loops/
