# mcp/ — Model Context Protocol Bridges

Bridges between the agent evaluation pipeline and external tools.

## Bridges

| Module | Tool | Description |
|--------|------|-------------|
| `playwright-bridge.ts` | Playwright | Runs Playwright test suites (api, ui, state) and returns structured results for the Evaluator's quality checks |

## Usage

The Evaluator invokes these bridges when `config.playwright.enabled` is true. Test results feed directly into the `playwright_checks` field of quality checks.
