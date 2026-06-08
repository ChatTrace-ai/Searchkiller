# tests/ — Playwright Test Suites

End-to-end and integration tests for Searchkiller, executed by the Evaluator's Playwright MCP bridge.

## Test Projects

| Project | Pattern | Description |
|---------|---------|-------------|
| `api` | `*.api.test.ts` | API endpoint tests (evaluate, plan) |
| `ui` | `*.ui.test.ts` | Browser UI tests (homepage, research page) |
| `state` | `*.state.test.ts` | Agent state integrity (.agents/ filesystem) |

## Running

```bash
npx playwright test                   # All tests
npx playwright test --project=api     # API tests only
npx playwright test --project=ui      # UI tests only
npx playwright test --project=state   # State tests only
```
