# AGENTS.md — Searchkiller System Manifest

## Identity
system: searchkiller
version: 0.2.0
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

### Evaluator (HITL-Initialized, Autonomous)
role: Autonomous outcome judgment using human-defined criteria
entry: agents/evaluator/index.ts
reads: [.agents/traces/, .agents/golden/, .agents/failures/, .agents/evaluator-config.json]
writes: [.agents/golden/, .agents/failures/, .agents/traces/]
initialization: Human configures criteria/thresholds via HITL → persisted to .agents/evaluator-config.json
runtime: Evaluator judges traces autonomously against the persisted config
constraint: MUST be initialized via HITL before first evaluation

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
lifecycle: planner.emit() -> evaluator.evaluate() -> golden|failure routing
fields: {id, agent, action, input_hash, output_hash, timestamp, verdict}
verdicts: PENDING | APPROVED | REJECTED

## Evaluation Protocol
1. Human initializes Evaluator via HITL (POST /api/evaluate {action:"initialize"})
   → defines criteria, thresholds, custom rules → persisted to .agents/evaluator-config.json
2. Planner emits trace with verdict=PENDING
3. Evaluator loads trace + config, runs autonomous quality checks
4. All checks pass → APPROVED → .agents/golden/{id}.json
5. Any check fails → REJECTED → .agents/failures/{id}.json with {root_cause, lesson}
6. Human may re-initialize Evaluator at any time to update criteria

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
pattern: git worktree add ../Searchkiller-{feature} -b feat/{name}
