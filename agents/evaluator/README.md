# evaluator/ — Evaluator Agent (HITL)

The Evaluator judges execution outcomes with mandatory Human-in-the-Loop verification. It:

1. Loads a trace from `.agents/traces/`
2. Checks `.agents/failures/` for similar past failure patterns
3. Runs automated quality checks
4. Sets verdict to `AWAITING_HUMAN` and blocks until human approval
5. On APPROVED: routes to `.agents/golden/` (Golden Benchmark)
6. On REJECTED: routes to `.agents/failures/` with root-cause analysis

**Critical constraint**: The Evaluator NEVER auto-approves. Every evaluation requires explicit human sign-off.
