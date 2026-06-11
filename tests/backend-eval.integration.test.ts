/**
 * Backend Evaluator Integration Test
 *
 * Runs all 5 probes against a running dev server.
 *
 * Prerequisites:
 *   npm run dev  (server must be running on localhost:3000)
 *   EXA_API_KEY set in .env
 *
 * Run with:
 *   source .env && npx tsx tests/backend-eval.integration.test.ts
 */

import { BackendEvaluator, DEFAULT_BACKEND_EVAL_CONFIG } from '../agents/evaluator/backend-evaluator';
import type { BackendEvalConfig } from '../agents/evaluator/probes/types';

async function main() {
  console.log('\n=== Backend Evaluator — Full MVP Test ===\n');

  const baseUrl = process.env.BACKEND_EVAL_BASE_URL || 'http://localhost:3000';

  const config: BackendEvalConfig = {
    ...DEFAULT_BACKEND_EVAL_CONFIG,
    dimensions: [
      { name: 'api_reliability',      weight: 0.25, hardThreshold: 5, enabled: true },
      { name: 'search_quality',       weight: 0.25, hardThreshold: 3, enabled: true },
      { name: 'data_integrity',       weight: 0.20, hardThreshold: 5, enabled: true },
      { name: 'cache_effectiveness',  weight: 0.15, hardThreshold: 0, enabled: true },
      { name: 'graceful_degradation', weight: 0.15, hardThreshold: 5, enabled: true },
    ],
    baseUrl,
    searchTestQueries: ['AI Agent 安全性研究', 'World Cup 2026 champion prediction'],
  };

  // Quick health check — is the server running?
  try {
    const resp = await fetch(`${config.baseUrl}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stats' }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    console.log('  Server health: ✓ running on', config.baseUrl);
  } catch {
    console.error('  ERROR: Dev server not running. Start with: npm run dev');
    process.exit(1);
  }

  const evaluator = new BackendEvaluator(config);
  const result = await evaluator.run();

  console.log(evaluator.formatReport(result));

  // Summary
  console.log('=== Summary ===');
  console.log(`  Weighted Score: ${result.weightedScore.toFixed(2)} / 10`);
  console.log(`  All Passed: ${result.allPassed ? '✓' : '✗'}`);
  console.log(`  Total Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Probes Run: ${result.probes.length}`);

  for (const probe of result.probes) {
    const passedDetails = probe.details.filter((d) => d.passed).length;
    console.log(`    ${probe.passed ? '✓' : '✗'} ${probe.dimension}: ${probe.score.toFixed(1)}/10 (${passedDetails}/${probe.details.length} checks)`);
  }

  console.log('\n=== Backend Evaluation Complete ===\n');
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
