# tests/ — Agent Manifest

## Role
Playwright test suites invoked by the Evaluator's MCP bridge.

## Contents
| File | Project | Description |
|------|---------|-------------|
| evaluate.api.test.ts | api | /api/evaluate and /api/plan endpoint tests |
| homepage.ui.test.ts | ui | Homepage rendering and navigation tests |
| agent.state.test.ts | state | .agents/ directory integrity and lifecycle tests |

## Boundaries
- reads: app/ (via HTTP), .agents/ (filesystem checks)
- writes: NONE (read-only assertions)
- invoked_by: agents/mcp/playwright-bridge.ts, npx playwright test
