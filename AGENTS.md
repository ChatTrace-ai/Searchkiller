# AGENTS.md — G-RapidAgent System Manifest

## Identity
system: g-rapid-agent
version: 0.1.0
agents: [planner, evaluator]
runtime: next.js-15-edge

## Agent Definitions

### Planner
role: Task decomposition, execution mapping, sub-query generation
entry: agents/planner/index.ts
reads: [app/, lib/, .agents/schemas/, .agents/traces/]
writes: [.agents/traces/]
delegates_to: evaluator
constraint: MUST produce structured trace before delegating

### Evaluator (HITL)
role: Outcome judgment with mandatory human verification
entry: agents/evaluator/index.ts
reads: [.agents/traces/, .agents/golden/, .agents/failures/]
writes: [.agents/golden/, .agents/failures/, .agents/traces/]
requires: human_approval BEFORE finalizing any evaluation state
constraint: NEVER auto-approve; always gate on HITL signal

## Permission Hierarchy (top-down, no upward leakage)
L0-root:    AGENTS.md, README.md, package.json, next.config.ts
L1-agents:  agents/*  — orchestration logic; reads L2, writes .agents/
L2-app:     app/*     — routes & pages; reads L3; NEVER imports from agents/
L3-lib:     lib/*     — pure utilities; ZERO side effects; no upward imports
L4-components: components/* — UI only; reads lib/ types; no API calls
L5-scripts: scripts/* — verification tooling; reads everything; writes nothing

Rule: Ln may import from Lm where m > n. Reverse is FORBIDDEN.

## Trace System Contract
location: .agents/traces/
format: JSON per .agents/schemas/trace.schema.json
lifecycle: planner.emit() -> evaluator.judge() -> golden|failure routing
fields: {id, agent, action, input_hash, output_hash, timestamp, verdict}

## Evaluation Protocol
1. Planner emits trace with verdict=PENDING
2. Evaluator loads trace, runs quality checks
3. Evaluator sets verdict=AWAITING_HUMAN
4. Human reviews via HITL interface -> APPROVED | REJECTED
5. If APPROVED -> .agents/golden/{id}.json
6. If REJECTED -> .agents/failures/{id}.json with {root_cause, lesson}

## Recycle Pattern
golden_store: .agents/golden/     — regression benchmark; append-only
failure_store: .agents/failures/  — failure patterns; queryable by root_cause
policy: Every evaluation MUST route to exactly one store

## SSOT Enforcement
schema_dir: .agents/schemas/
verify: bash scripts/verify-dual-md.sh
lint:   python scripts/lint-agent-md.py
fix:    python scripts/uniformize.py

## Dual-Markdown Rule
scope: ALL directories EXCEPT doc/
required_files: [README.md, AGENT.md]
README.md: human-only (onboarding, intent, context)
AGENT.md: machine-only (files, boundaries, state)

## Boundaries
read_only: [doc/]
gitignored: [node_modules/, .next/, .env*]
no_agent_rewrite: [doc/*, .github/*, Dockerfile]

## Worktree Policy
branching: git worktree for parallel feature work
main: protected; merge only via evaluated traces
pattern: git worktree add ../G-RapidAgent-{feature} -b feat/{name}
