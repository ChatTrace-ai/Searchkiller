# mcp/ — Agent Manifest

## Role
Model Context Protocol bridges connecting the Evaluator to external tools.

## Contents
| File | Description |
|------|-------------|
| playwright-bridge.ts | Playwright test runner: runTestSuite, runSingleTest, healthCheck |

## Boundaries
- reads: tests/ (Playwright test files), .agents/test-report.json (generated report)
- writes: .agents/test-report.json (via Playwright JSON reporter)
- invoked_by: agents/evaluator (during quality checks when playwright.enabled)
