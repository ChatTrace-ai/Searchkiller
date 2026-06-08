# planner/ — Planner Agent

The Planner is responsible for high-level task decomposition and execution mapping. Given a research keyword, it:

1. Decomposes the task into sub-queries via Gemini Flash
2. Maps each sub-query to an execution step
3. Emits a structured trace record to `.agents/traces/`
4. Delegates evaluation to the Evaluator agent

The Planner never self-approves — all output must be evaluated externally.
