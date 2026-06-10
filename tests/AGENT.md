# tests/ — Agent Manifest

## Role
Unit tests, integration tests, and E2E pipeline tests for all harness components and API endpoints.

## Contents
| File | Type | Description |
|------|------|-------------|
| handoff.unit.test.ts | unit | Handoff Protocol: create, save, load, iterate, archive, reset |
| sprint-contract.unit.test.ts | unit | Sprint Contract: propose, adjust, activate, scoring, thresholds |
| llm-judge.unit.test.ts | unit | LLM-Judge: mocked evaluation structure validation |
| llm-judge.integration.test.ts | integration | LLM-Judge: real Gemini Flash API call, validates scoring quality |
| feedback-loop.integration.test.ts | integration | Feedback Loop: 2-round iteration with real Gemini API |
| harness-e2e.integration.test.ts | e2e | Full harness: real Gemini Pro generation + optimized Flash judge |
| full-pipeline.integration.test.ts | e2e | Plan → Fetch (Exa) → Generate (Pro) → Judge (Flash) full pipeline |
| evaluate.api.test.ts | api | /api/evaluate and /api/plan endpoint tests |
| homepage.ui.test.ts | ui | Homepage rendering and navigation tests |
| agent.state.test.ts | state | .agents/ directory integrity and lifecycle tests |

## Running
```bash
# Unit tests (no API keys needed)
npx tsx tests/handoff.unit.test.ts
npx tsx tests/sprint-contract.unit.test.ts

# Integration tests (requires GOOGLE_VERTEX_PROJECT, GOOGLE_VERTEX_LOCATION)
source .env && npx tsx tests/llm-judge.integration.test.ts

# E2E pipeline (requires all API keys: Vertex AI + EXA_API_KEY)
source .env && npx tsx tests/full-pipeline.integration.test.ts
```

## Boundaries
- reads: harness/, agents/, lib/ (direct import), app/ (via HTTP)
- writes: .agents/ (created/cleaned during tests)
- invoked_by: npx tsx (standalone), agents/mcp/playwright-bridge.ts
