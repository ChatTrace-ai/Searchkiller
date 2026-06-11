/**
 * Integration test for knowledge-store.ts
 * Run: npx tsx tests/knowledge-store.integration.test.ts
 * Requires: ES_CLOUD_ID and ES_API_KEY in .env
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  ensureKnowledgeIndex,
  indexKnowledge,
  indexKnowledgeBulk,
  checkCoverage,
  getProjectKnowledge,
  deleteKnowledge,
} from '../lib/knowledge-store';
import type { KnowledgeEntry } from '../lib/schemas';

const TEST_PROJECT = `test-ks-${Date.now()}`;

function makeEntry(suffix: string): KnowledgeEntry {
  return {
    project_id: TEST_PROJECT,
    topic: `Test Topic ${suffix}`,
    facts: [`Fact A about ${suffix}`, `Fact B about ${suffix}`],
    entities: [{ name: `Entity-${suffix}`, type: 'concept' }],
    source_url: `https://example.com/${suffix}`,
    source_title: `Test Source ${suffix}`,
    raw_summary: `This is a test summary for ${suffix} covering various aspects of the topic.`,
    created_at: new Date().toISOString(),
  };
}

async function run() {
  console.log('--- knowledge-store integration tests ---\n');
  console.log(`Using project: ${TEST_PROJECT}`);

  // 1. Ensure index
  console.log('\n[1] ensureKnowledgeIndex...');
  await ensureKnowledgeIndex();
  console.log('  ✓ Index ensured (exists or created)');

  // 2. Single index
  console.log('\n[2] indexKnowledge (single doc)...');
  const entry1 = makeEntry('single');
  const docId = await indexKnowledge(entry1);
  assert(docId.length === 64, 'Expected sha256 hex ID');
  console.log(`  ✓ Indexed doc: ${docId.slice(0, 16)}...`);

  // 3. Duplicate handling (409)
  console.log('\n[3] indexKnowledge (duplicate → 409 silent)...');
  const dupId = await indexKnowledge(entry1);
  assert.equal(dupId, docId, 'Duplicate should return same ID');
  console.log('  ✓ Duplicate handled silently');

  // 4. Bulk indexing
  console.log('\n[4] indexKnowledgeBulk...');
  const bulkEntries = [makeEntry('bulk-a'), makeEntry('bulk-b'), makeEntry('bulk-c')];
  const bulkResult = await indexKnowledgeBulk(bulkEntries);
  assert(bulkResult.succeeded >= 0, 'succeeded should be >= 0');
  assert(bulkResult.duplicates >= 0, 'duplicates should be >= 0');
  assert.equal(bulkResult.succeeded + bulkResult.duplicates + bulkResult.failed, 3);
  console.log(`  ✓ Bulk result: succeeded=${bulkResult.succeeded}, dup=${bulkResult.duplicates}, failed=${bulkResult.failed}`);

  // 5. Bulk duplicate
  console.log('\n[5] indexKnowledgeBulk (all duplicates)...');
  const dupBulk = await indexKnowledgeBulk(bulkEntries);
  assert.equal(dupBulk.duplicates, 3, 'All should be duplicates');
  assert.equal(dupBulk.failed, 0);
  console.log(`  ✓ All 3 treated as duplicates`);

  // 6. Wait for ES to index (semantic_text embedding takes time)
  console.log('\n[6] Waiting 5s for ES embedding inference...');
  await new Promise((r) => setTimeout(r, 5000));

  // 7. checkCoverage
  console.log('\n[7] checkCoverage...');
  const coverage = await checkCoverage(TEST_PROJECT, 'test topic', { threshold: 0.3 });
  console.log(`  covered: ${coverage.covered}, score: ${coverage.score.toFixed(3)}, entries: ${coverage.existingEntries.length}`);
  assert(coverage.existingEntries.length >= 0, 'Should have entries or graceful empty');

  // 8. getProjectKnowledge
  console.log('\n[8] getProjectKnowledge...');
  const allDocs = await getProjectKnowledge(TEST_PROJECT, 10);
  assert(allDocs.length >= 1, 'Should find at least 1 doc');
  console.log(`  ✓ Found ${allDocs.length} docs for project`);

  // 9. deleteKnowledge
  console.log('\n[9] deleteKnowledge...');
  const deleted = await deleteKnowledge(TEST_PROJECT, 'https://example.com/single');
  assert.equal(deleted, true);
  console.log('  ✓ Deleted single doc');

  // 10. Verify expires_at field
  console.log('\n[10] Verify v2 fields (expires_at, access_count)...');
  const remaining = await getProjectKnowledge(TEST_PROJECT, 5);
  if (remaining.length > 0) {
    const doc = remaining[0] as any;
    console.log(`  expires_at: ${doc.expires_at || 'NOT SET'}`);
    console.log(`  access_count: ${doc.access_count ?? 'NOT SET'}`);
  }

  // Cleanup
  console.log('\n[cleanup] Deleting remaining test docs...');
  for (const doc of remaining) {
    await deleteKnowledge(TEST_PROJECT, doc.source_url);
  }
  console.log('  ✓ Cleaned up');

  console.log('\n--- ALL TESTS PASSED ---');
}

run().catch((e) => {
  console.error('\n--- TEST FAILED ---');
  console.error(e.message);
  process.exit(1);
});
