/**
 * Batch refresh all featured seed predictions with real data.
 * Uses the shared prediction-generator pipeline (Exa + Gemini).
 *
 * Usage:
 *   npx tsx scripts/refresh-all-predictions.ts [--start N] [--delay MS]
 */
import { Client } from '@elastic/elasticsearch';
import { generateRealPrediction } from '../lib/prediction-generator';

const INDEX_NAME = 'predictions';
const DEFAULT_DELAY_MS = 5000;

function getClient(): Client {
  return new Client({
    cloud: { id: process.env.ES_CLOUD_ID! },
    auth: { apiKey: process.env.ES_API_KEY! },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const startArg = process.argv.indexOf('--start');
  const startIndex = startArg >= 0 ? parseInt(process.argv[startArg + 1], 10) : 0;
  const delayArg = process.argv.indexOf('--delay');
  const delayMs = delayArg >= 0 ? parseInt(process.argv[delayArg + 1], 10) : DEFAULT_DELAY_MS;

  const client = getClient();

  const response = await client.search({
    index: INDEX_NAME,
    body: {
      size: 100,
      query: { bool: { filter: [{ term: { featured: true } }] } },
      sort: [{ featured_sort: 'asc' }],
    },
  });

  const hits = response.hits.hits as any[];
  console.log(`Found ${hits.length} featured predictions`);

  let success = 0;
  let failed = 0;

  for (let i = startIndex; i < hits.length; i++) {
    const hit = hits[i];
    const id = hit._id as string;
    const question = hit._source?.detail?.question as string;

    if (!question) {
      console.warn(`[${i}] ${id}: no question found, skipping`);
      failed++;
      continue;
    }

    console.log(`\n[${i + 1}/${hits.length}] ${id}: "${question}"`);
    console.log('  → Starting real data pipeline...');

    try {
      await generateRealPrediction(id, question);
      success++;
      console.log(`  ✓ Completed successfully`);
    } catch (err: any) {
      failed++;
      console.error(`  ✗ Failed: ${err.message}`);
    }

    if (i < hits.length - 1) {
      console.log(`  ⏳ Waiting ${delayMs}ms before next...`);
      await sleep(delayMs);
    }
  }

  console.log(`\n=== Batch Refresh Complete ===`);
  console.log(`Success: ${success}, Failed: ${failed}, Total: ${hits.length}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
