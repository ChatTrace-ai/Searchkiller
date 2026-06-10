/**
 * Unit tests for Sprint Contract
 *
 * Run with: npx tsx tests/sprint-contract.unit.test.ts
 */

import { strict as assert } from 'assert';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

import {
  proposeContract,
  adjustContract,
  activateContract,
  saveContract,
  loadContract,
  listContracts,
  calculateWeightedScore,
  checkHardThresholds,
  recordRoundResult,
  getBestRound,
  contractSummary,
  type SprintContract,
} from '../agents/sprint-contract';

const CONTRACTS_DIR = join(process.cwd(), '.agents', 'contracts');

function cleanContracts() {
  if (existsSync(CONTRACTS_DIR)) {
    rmSync(CONTRACTS_DIR, { recursive: true, force: true });
  }
}

async function testProposeContract() {
  const contract = proposeContract('AI Agent 架构趋势');

  assert.ok(contract.id.startsWith('sprint-'));
  assert.equal(contract.status, 'draft');
  assert.equal(contract.keyword, 'AI Agent 架构趋势');
  assert.equal(contract.dimensions.length, 4);
  assert.equal(contract.currentRound, 0);
  assert.equal(contract.roundResults.length, 0);
  assert.equal(contract.negotiationHistory.length, 1);

  const totalWeight = contract.dimensions.reduce((s, d) => s + d.weight, 0);
  assert.ok(Math.abs(totalWeight - 1.0) < 0.01, `Weights should sum to 1.0, got ${totalWeight}`);

  console.log('  PASS: proposeContract');
  return contract;
}

async function testAdjustContract(contract: SprintContract) {
  const adjusted = adjustContract(
    contract,
    {
      dimensions: [{ name: 'factual_accuracy', weight: 0.40, hardThreshold: 6.0 }],
      globalThresholds: { maxRounds: 15 },
    },
    'Increased factual_accuracy weight to 40% and raised hard threshold to 6.0',
  );

  assert.equal(adjusted.status, 'negotiating');
  assert.equal(adjusted.globalThresholds.maxRounds, 15);
  assert.equal(adjusted.negotiationHistory.length, 2);
  assert.equal(adjusted.negotiationHistory[1].actor, 'user');

  const factDim = adjusted.dimensions.find((d) => d.name === 'factual_accuracy')!;
  assert.equal(factDim.hardThreshold, 6.0);

  const reNormalizedTotal = adjusted.dimensions.reduce((s, d) => s + d.weight, 0);
  assert.ok(Math.abs(reNormalizedTotal - 1.0) < 0.02, `Re-normalized weights should sum to ~1.0, got ${reNormalizedTotal}`);

  console.log('  PASS: adjustContract');
  return adjusted;
}

async function testActivateContract(contract: SprintContract) {
  const activated = activateContract(contract);

  assert.equal(activated.status, 'active');
  assert.ok(activated.activatedAt);
  assert.equal(activated.negotiationHistory.length, 3);
  assert.equal(activated.negotiationHistory[2].action, 'accept');

  console.log('  PASS: activateContract');
  return activated;
}

async function testSaveAndLoad(contract: SprintContract) {
  await saveContract(contract);
  const loaded = await loadContract(contract.id);

  assert.equal(loaded.id, contract.id);
  assert.equal(loaded.keyword, contract.keyword);
  assert.equal(loaded.status, contract.status);
  assert.equal(loaded.dimensions.length, contract.dimensions.length);

  console.log('  PASS: saveAndLoad');
}

async function testListContracts() {
  const ids = await listContracts();
  assert.ok(ids.length >= 1);
  console.log(`  PASS: listContracts (${ids.length} found)`);
}

function testCalculateWeightedScore() {
  const dims = [
    { name: 'a', description: '', weight: 0.5, hardThreshold: 5, targetScore: 7 },
    { name: 'b', description: '', weight: 0.5, hardThreshold: 5, targetScore: 7 },
  ];
  const scores = { a: 8, b: 6 };
  const weighted = calculateWeightedScore(dims, scores);
  assert.equal(weighted, 7.0);

  console.log('  PASS: calculateWeightedScore');
}

function testCheckHardThresholds() {
  const dims = [
    { name: 'a', description: '', weight: 0.5, hardThreshold: 5, targetScore: 7 },
    { name: 'b', description: '', weight: 0.5, hardThreshold: 5, targetScore: 7 },
  ];

  const passResult = checkHardThresholds(dims, { a: 6, b: 7 });
  assert.equal(passResult.passed, true);
  assert.equal(passResult.failures.length, 0);

  const failResult = checkHardThresholds(dims, { a: 4, b: 7 });
  assert.equal(failResult.passed, false);
  assert.equal(failResult.failures.length, 1);
  assert.ok(failResult.failures[0].includes('a'));

  console.log('  PASS: checkHardThresholds');
}

async function testRecordRoundResult(contract: SprintContract) {
  const round1 = recordRoundResult(
    contract,
    'hoff-test-1',
    { factual_accuracy: 6, structural_completeness: 5, analysis_depth: 6, citation_quality: 5 },
    'Report needs stronger citations and deeper analysis.',
  );

  assert.equal(round1.result.round, 1);
  assert.equal(round1.sprintComplete, false);
  assert.equal(round1.result.contractSatisfied, false);
  assert.equal(contract.currentRound, 1);
  assert.ok(round1.result.weightedScore > 0);

  const round2 = recordRoundResult(
    contract,
    'hoff-test-2',
    { factual_accuracy: 8, structural_completeness: 8, analysis_depth: 7, citation_quality: 7 },
    'Much improved. Meets most criteria.',
  );

  assert.equal(round2.result.round, 2);
  assert.ok(round2.result.weightedScore > round1.result.weightedScore);

  console.log('  PASS: recordRoundResult');
  return contract;
}

function testAutoApprove() {
  const contract = proposeContract('Auto Test');
  activateContract(contract);

  const result = recordRoundResult(
    contract,
    'hoff-auto',
    { factual_accuracy: 9, structural_completeness: 9, analysis_depth: 9, citation_quality: 8 },
    'Excellent quality.',
  );

  assert.equal(result.sprintComplete, true);
  assert.ok(result.reason!.includes('Auto-approved'));
  assert.equal(contract.status, 'completed');

  console.log('  PASS: autoApprove');
}

function testMaxRounds() {
  const contract = proposeContract('Max Round Test');
  contract.globalThresholds.maxRounds = 2;
  activateContract(contract);

  recordRoundResult(contract, 'hoff-1', { factual_accuracy: 5, structural_completeness: 5, analysis_depth: 5, citation_quality: 5 }, 'Round 1');
  const r2 = recordRoundResult(contract, 'hoff-2', { factual_accuracy: 6, structural_completeness: 6, analysis_depth: 6, citation_quality: 6 }, 'Round 2');

  assert.equal(r2.sprintComplete, true);
  assert.ok(r2.reason!.includes('Max rounds'));
  assert.equal(contract.status, 'expired');

  console.log('  PASS: maxRounds');
}

function testGetBestRound() {
  const contract = proposeContract('Best Round Test');
  activateContract(contract);

  recordRoundResult(contract, 'hoff-a', { factual_accuracy: 6, structural_completeness: 6, analysis_depth: 6, citation_quality: 6 }, 'R1');
  recordRoundResult(contract, 'hoff-b', { factual_accuracy: 8, structural_completeness: 8, analysis_depth: 8, citation_quality: 8 }, 'R2');
  recordRoundResult(contract, 'hoff-c', { factual_accuracy: 7, structural_completeness: 7, analysis_depth: 7, citation_quality: 7 }, 'R3');

  const best = getBestRound(contract);
  assert.ok(best);
  assert.equal(best.round, 2);

  console.log('  PASS: getBestRound');
}

function testContractSummary() {
  const contract = proposeContract('Summary Test');
  activateContract(contract);
  recordRoundResult(contract, 'hoff-s', { factual_accuracy: 7, structural_completeness: 7, analysis_depth: 7, citation_quality: 7 }, 'R1');

  const summary = contractSummary(contract);
  assert.ok(summary.includes('Summary Test'));
  assert.ok(summary.includes('factual_accuracy'));
  assert.ok(summary.includes('Round: 1'));

  console.log('  PASS: contractSummary');
}

async function main() {
  console.log('\n=== Sprint Contract Unit Tests ===\n');

  cleanContracts();

  let contract = await testProposeContract();
  contract = await testAdjustContract(contract);
  contract = await testActivateContract(contract);
  await testSaveAndLoad(contract);
  await testListContracts();
  testCalculateWeightedScore();
  testCheckHardThresholds();
  contract = await testRecordRoundResult(contract);
  testAutoApprove();
  testMaxRounds();
  testGetBestRound();
  testContractSummary();

  cleanContracts();

  console.log('\n=== All tests passed ===\n');
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
