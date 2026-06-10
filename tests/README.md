# tests/ — Test Suites

Unit, integration, and E2E tests for the Searchkiller harness and API.

## Test Categories

| Category | Pattern | Requirements | Runner |
|----------|---------|-------------|--------|
| Unit | `*.unit.test.ts` | None | `npx tsx` |
| Integration | `*.integration.test.ts` | Vertex AI keys | `npx tsx` |
| E2E Pipeline | `full-pipeline.*` | All API keys | `npx tsx` |
| API | `*.api.test.ts` | Running server | Playwright |
| UI | `*.ui.test.ts` | Running server | Playwright |
| State | `*.state.test.ts` | None | Playwright |

## Quick Start

```bash
# Unit tests (no external dependencies)
npx tsx tests/handoff.unit.test.ts
npx tsx tests/sprint-contract.unit.test.ts
npx tsx tests/llm-judge.unit.test.ts

# Integration tests (Gemini API required)
source .env
npx tsx tests/llm-judge.integration.test.ts    # Single judge call (~4s)
npx tsx tests/feedback-loop.integration.test.ts # 2-round loop (~40s)
npx tsx tests/harness-e2e.integration.test.ts   # Real gen + judge (~150s)

# Full pipeline (Gemini + Exa required)
source .env
npx tsx tests/full-pipeline.integration.test.ts # Plan→Fetch→Gen→Judge (~150s)

# Playwright suites (server must be running)
npx playwright test --project=api
npx playwright test --project=ui
```

## Verified Performance

| Test | Duration | Key Metric |
|------|----------|------------|
| LLM-Judge (optimized) | ~4s | thinkingBudget=0, 50x vs baseline |
| Full pipeline | ~84s | Plan 6s + Fetch 1s + Gen 72s + Judge 5s |
| Feedback loop 2 rounds | ~150s | Score improves R1→R2 |
