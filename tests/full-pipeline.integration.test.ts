/**
 * Full Pipeline Integration Test — Plan → Fetch → Generate → Judge
 *
 * Tests the complete Searchkiller harness pipeline with real APIs:
 *   1. Plan: Gemini Flash generates sub-queries
 *   2. Fetch: Exa.ai semantic search fetches real sources
 *   3. Generate: Gemini Pro creates the report
 *   4. Judge: Gemini Flash (optimized) evaluates quality
 *
 * Requires: GOOGLE_VERTEX_PROJECT, GOOGLE_VERTEX_LOCATION, EXA_API_KEY
 *
 * Run with:
 *   source .env && npx tsx tests/full-pipeline.integration.test.ts
 */

import { strict as assert } from 'assert';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

import { planSubQueries, fetchSources, startLoop, loopNext, loadLoop, loopSummary } from '../lib/harness-adapter';

function cleanAgentsDir() {
  const agentsDir = join(process.cwd(), '.agents');
  if (existsSync(agentsDir)) {
    rmSync(agentsDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log('\n=== Full Pipeline Test: Plan → Fetch → Generate → Judge ===\n');

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION;
  const exaKey = process.env.EXA_API_KEY;

  if (!project || !location) {
    console.error('ERROR: GOOGLE_VERTEX_PROJECT and GOOGLE_VERTEX_LOCATION must be set');
    process.exit(1);
  }
  if (!exaKey) {
    console.error('WARNING: EXA_API_KEY not set, Exa search will fail (ES may still work)');
  }

  console.log(`  Vertex AI: project=${project}, location=${location}`);
  console.log(`  Exa API: ${exaKey ? 'configured' : 'MISSING'}\n`);

  cleanAgentsDir();

  const keyword = 'LLM Agent 安全性与对齐';

  // ── Step 1: Plan ──────────────────────────────────────────────────
  console.log('  ── Step 1: Plan (Gemini Flash → sub-queries) ──');
  const planStart = Date.now();
  const subQueries = await planSubQueries(keyword);
  const planMs = Date.now() - planStart;

  assert.ok(subQueries.length >= 3, `Should generate >= 3 sub-queries (got ${subQueries.length})`);
  assert.ok(subQueries.length <= 5, `Should generate <= 5 sub-queries (got ${subQueries.length})`);
  console.log(`  Time: ${(planMs / 1000).toFixed(1)}s`);
  console.log(`  Sub-queries (${subQueries.length}):`);
  subQueries.forEach((q, i) => console.log(`    ${i + 1}. ${q}`));
  console.log('  PASS: planSubQueries\n');

  // ── Step 2: Fetch ─────────────────────────────────────────────────
  console.log('  ── Step 2: Fetch (Exa + ES → real sources) ──');
  const fetchStart = Date.now();
  const sources = await fetchSources(keyword, subQueries);
  const fetchMs = Date.now() - fetchStart;

  console.log(`  Time: ${(fetchMs / 1000).toFixed(1)}s`);
  console.log(`  Sources found: ${sources.length}`);
  sources.forEach((s, i) =>
    console.log(`    [${i + 1}] ${s.title.substring(0, 60)}... (${s.snippet.length} chars)`),
  );

  if (sources.length === 0) {
    console.log('  WARNING: No sources found — report quality will be lower');
    console.log('  Continuing with empty sources...');
  } else {
    assert.ok(sources.every((s) => s.title && s.url), 'All sources should have title and url');
    assert.ok(sources.every((s) => s.snippet.length > 0), 'All sources should have snippet content');
  }
  console.log('  PASS: fetchSources\n');

  // ── Step 3+4: Generate + Judge (via startLoop) ────────────────────
  console.log('  ── Step 3+4: startLoop (Generate + Judge, skipSearch=true) ──');
  const loopStart = Date.now();

  const result = await startLoop({
    keyword,
    subQueries,
    sources,
    maxRounds: 2,
    contractOverrides: { autoApproveScore: 9.5 },
    skipSearch: true,
  });

  const loopMs = Date.now() - loopStart;
  const judgeMs = (globalThis as Record<string, unknown>).__lastJudgeMs as number;

  console.log(`  Time: ${(loopMs / 1000).toFixed(1)}s total`);
  if (judgeMs) {
    console.log(`    ├── Report gen: ~${((loopMs - judgeMs) / 1000).toFixed(1)}s (Gemini Pro)`);
    console.log(`    └── Judge eval: ${(judgeMs / 1000).toFixed(1)}s (Flash, thinkingBudget=0)`);
  }

  console.log(`  Score: ${result.latestRound.score}`);
  console.log(`  Satisfied: ${result.latestRound.contractSatisfied}`);

  const scores = result.latestRound.dimensionScores;
  console.log(`  Dimensions:`);
  for (const [dim, score] of Object.entries(scores)) {
    console.log(`    ${dim}: ${score}`);
    assert.ok(score >= 0 && score <= 10, `${dim} should be 0-10`);
  }
  console.log('  PASS: startLoop with real sources\n');

  // ── Full-auto startLoop (auto plan + fetch) ──────────────────────
  console.log('  ── Bonus: Full-auto startLoop (auto plan + fetch) ──');
  const autoStart = Date.now();

  const autoResult = await startLoop({
    keyword: 'Retrieval Augmented Generation 最新进展',
    maxRounds: 1,
  });

  const autoMs = Date.now() - autoStart;

  console.log(`  Time: ${(autoMs / 1000).toFixed(1)}s (plan + fetch + gen + judge)`);
  console.log(`  Score: ${autoResult.latestRound.score}`);
  console.log(`  Loop ID: ${autoResult.loop.id}`);

  const autoLoop = await loadLoop(autoResult.loop.id);
  const autoScores = autoResult.latestRound.dimensionScores;
  console.log(`  Dimensions:`);
  for (const [dim, score] of Object.entries(autoScores)) {
    console.log(`    ${dim}: ${score}`);
  }
  console.log('  PASS: Full-auto startLoop\n');

  // ── Summary ──────────────────────────────────────────────────────
  console.log('  ── Pipeline Timing Summary ──');
  console.log(`  Plan:     ${(planMs / 1000).toFixed(1)}s`);
  console.log(`  Fetch:    ${(fetchMs / 1000).toFixed(1)}s`);
  console.log(`  Gen+Judge: ${(loopMs / 1000).toFixed(1)}s`);
  console.log(`  Full-auto: ${(autoMs / 1000).toFixed(1)}s`);
  console.log(`  Total:    ${((planMs + fetchMs + loopMs) / 1000).toFixed(1)}s`);

  cleanAgentsDir();

  console.log('\n=== All full pipeline tests passed ===\n');
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
