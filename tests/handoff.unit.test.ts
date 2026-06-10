/**
 * Unit tests for the Handoff Protocol
 *
 * Run with: npx tsx tests/handoff.unit.test.ts
 * (standalone, no server required)
 */

import { strict as assert } from 'assert';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import {
  createHandoffDocument,
  saveHandoff,
  loadHandoff,
  listHandoffs,
  recordEvaluation,
  createIterationHandoff,
  approveHandoff,
  rejectHandoff,
  resetContext,
  archiveHandoff,
  extractReportMetrics,
  extractMindMapMetrics,
  type HandoffDocument,
  type HandoffReport,
  type HandoffMetrics,
} from '../agents/handoff';

const HANDOFFS_DIR = join(process.cwd(), '.agents', 'handoffs');

function cleanHandoffs() {
  if (existsSync(HANDOFFS_DIR)) {
    rmSync(HANDOFFS_DIR, { recursive: true, force: true });
  }
}

const sampleMetrics: HandoffMetrics = {
  planDurationMs: 100,
  fetchDurationMs: 500,
  reportDurationMs: 2000,
  mindmapDurationMs: 1500,
  totalDurationMs: 4100,
  sourceCount: 5,
  modelUsed: 'gemini-2.5-pro',
};

const sampleReport: HandoffReport = {
  markdown: '## Background\nSome content.\n## Key Findings\nMore content [#1].\n## Conclusion\nDone [#2].',
  wordCount: 8,
  sectionHeadings: ['Background', 'Key Findings', 'Conclusion'],
  citationCount: 2,
};

async function testCreateAndLoad() {
  const doc = createHandoffDocument({
    keyword: 'AI Agent',
    subQueries: ['q1', 'q2'],
    report: sampleReport,
    mindmap: null,
    sources: [{ title: 'Source 1', url: 'https://example.com', snippet: 'text' }],
    metrics: sampleMetrics,
  });

  assert.ok(doc.id.startsWith('hoff-'), `ID should start with hoff-, got: ${doc.id}`);
  assert.equal(doc.version, 1);
  assert.equal(doc.phase, 'created');
  assert.equal(doc.input.keyword, 'AI Agent');
  assert.equal(doc.output.sources.length, 1);
  assert.equal(doc.history.length, 1);

  await saveHandoff(doc);
  const loaded = await loadHandoff(doc.id);
  assert.equal(loaded.id, doc.id);
  assert.equal(loaded.input.keyword, 'AI Agent');

  console.log('  PASS: createAndLoad');
  return doc;
}

async function testListHandoffs(expectedMinCount: number) {
  const ids = await listHandoffs();
  assert.ok(ids.length >= expectedMinCount, `Expected at least ${expectedMinCount} handoffs, got ${ids.length}`);
  console.log(`  PASS: listHandoffs (${ids.length} found)`);
}

async function testRecordEvaluation(handoffId: string) {
  const doc = await recordEvaluation(handoffId, {
    round: 1,
    score: 6.5,
    dimensionScores: { accuracy: 7, completeness: 6, depth: 7, citations: 6 },
    feedback: 'Report is good but citations could be stronger.',
    passesThreshold: false,
  });

  assert.equal(doc.phase, 'evaluated');
  assert.equal(doc.evaluation!.round, 1);
  assert.equal(doc.evaluation!.score, 6.5);
  assert.equal(doc.history.length, 2);
  assert.ok(doc.history[1].summary.includes('score 6.50'));

  console.log('  PASS: recordEvaluation');
  return doc;
}

async function testCreateIteration(parentId: string) {
  const newDoc = await createIterationHandoff(
    parentId,
    {
      report: { ...sampleReport, markdown: '## Improved\nBetter content [#1] [#2] [#3].' },
      mindmap: null,
      sources: [{ title: 'Source 1', url: 'https://example.com', snippet: 'text' }],
    },
    { ...sampleMetrics, reportDurationMs: 2500 },
    'Please add more citations.',
  );

  assert.equal(newDoc.version, 2);
  assert.equal(newDoc.parentId, parentId);
  assert.equal(newDoc.input.userFeedback, 'Please add more citations.');
  assert.ok(newDoc.history.length >= 3);

  const parent = await loadHandoff(parentId);
  assert.equal(parent.phase, 'iterated');

  console.log('  PASS: createIteration');
  return newDoc;
}

async function testApproveHandoff(handoffId: string) {
  await recordEvaluation(handoffId, {
    round: 2,
    score: 8.5,
    dimensionScores: { accuracy: 9, completeness: 8, depth: 8, citations: 9 },
    feedback: 'Meets quality threshold.',
    passesThreshold: true,
  });

  const doc = await approveHandoff(handoffId);
  assert.equal(doc.phase, 'approved');
  assert.ok(doc.history.some((h) => h.action === 'approved'));

  console.log('  PASS: approveHandoff');
}

async function testRejectHandoff() {
  const doc = createHandoffDocument({
    keyword: 'Reject Test',
    subQueries: ['q1'],
    report: null,
    mindmap: null,
    sources: [],
    metrics: sampleMetrics,
  });
  await saveHandoff(doc);

  const rejected = await rejectHandoff(doc.id, 'Empty report, no content generated.');
  assert.equal(rejected.phase, 'rejected');
  assert.ok(rejected.history.some((h) => h.action === 'rejected'));

  console.log('  PASS: rejectHandoff');
}

async function testResetContext() {
  const before = await listHandoffs();
  const result = await resetContext();
  const after = await listHandoffs();

  assert.ok(result.archived >= 0);
  assert.equal(after.length, 0);

  console.log(`  PASS: resetContext (archived ${result.archived} items)`);
}

async function testExtractMetrics() {
  const md = '## Title\nContent here [#1].\n### Sub\nMore [#2] and [#3].';
  const metrics = extractReportMetrics(md);
  assert.equal(metrics.sectionHeadings.length, 2);
  assert.equal(metrics.citationCount, 3);
  assert.ok(metrics.wordCount > 0);

  const tree = { name: 'root', children: [{ name: 'a', children: [{ name: 'a1' }] }, { name: 'b' }] };
  const treeMetrics = extractMindMapMetrics(tree as Record<string, unknown>);
  assert.equal(treeMetrics.nodeCount, 4);
  assert.equal(treeMetrics.maxDepth, 2);

  console.log('  PASS: extractMetrics');
}

async function main() {
  console.log('\n=== Handoff Protocol Unit Tests ===\n');

  cleanHandoffs();

  const doc = await testCreateAndLoad();
  await testListHandoffs(1);
  await testRecordEvaluation(doc.id);
  const iterDoc = await testCreateIteration(doc.id);
  await testApproveHandoff(iterDoc.id);
  await testRejectHandoff();
  await testExtractMetrics();
  await testResetContext();

  cleanHandoffs();

  console.log('\n=== All tests passed ===\n');
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
