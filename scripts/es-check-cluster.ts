/**
 * ES Cluster Status Check
 *
 * Checks:
 *   1. Connection health
 *   2. Available indices
 *   3. Deployed ML models (for kNN)
 *   4. research-docs index mapping
 *
 * Run with:
 *   set -a && source .env && set +a && npx tsx scripts/es-check-cluster.ts
 */

import { Client } from '@elastic/elasticsearch';

async function main() {
  const cloudId = process.env.ES_CLOUD_ID;
  const apiKey = process.env.ES_API_KEY;

  if (!cloudId || !apiKey) {
    console.error('Missing ES_CLOUD_ID or ES_API_KEY');
    process.exit(1);
  }

  const client = new Client({
    cloud: { id: cloudId },
    auth: { apiKey },
  });

  console.log('\n=== ES Cluster Check ===\n');

  // 1. Cluster health
  try {
    const health = await client.cluster.health();
    console.log(`1. Cluster Health: ${health.status} (${health.number_of_nodes} nodes, ${health.number_of_data_nodes} data nodes)`);
  } catch (err: any) {
    console.error('1. Cluster Health: FAILED', err.message);
  }

  // 2. List indices
  try {
    const indices = await client.cat.indices({ format: 'json' });
    console.log('\n2. Indices:');
    if (Array.isArray(indices) && indices.length > 0) {
      for (const idx of indices) {
        console.log(`   ${idx.index} — docs: ${idx['docs.count']}, size: ${idx['store.size']}, health: ${idx.health}`);
      }
    } else {
      console.log('   (no indices found)');
    }
  } catch (err: any) {
    console.error('2. Indices: FAILED', err.message);
  }

  // 3. Check ML models
  try {
    const models = await client.ml.getTrainedModels();
    console.log('\n3. ML Models:');
    if (models.trained_model_configs && models.trained_model_configs.length > 0) {
      for (const m of models.trained_model_configs) {
        console.log(`   ${m.model_id} — type: ${m.model_type ?? 'unknown'}`);
      }
    } else {
      console.log('   (no ML models deployed)');
    }
  } catch (err: any) {
    console.log('\n3. ML Models: Not available or error:', err.message?.substring(0, 200));
  }

  // 4. Check inference endpoints
  try {
    const resp = await client.transport.request({
      method: 'GET',
      path: '/_inference',
    });
    console.log('\n4. Inference Endpoints:');
    console.log(`   ${JSON.stringify(resp, null, 2).substring(0, 500)}`);
  } catch (err: any) {
    console.log('\n4. Inference Endpoints: Not available or error:', err.message?.substring(0, 200));
  }

  // 5. Check research-docs index
  try {
    const exists = await client.indices.exists({ index: 'research-docs' });
    if (exists) {
      const mapping = await client.indices.getMapping({ index: 'research-docs' });
      console.log('\n5. research-docs Mapping:');
      console.log(JSON.stringify(mapping, null, 2).substring(0, 1000));
    } else {
      console.log('\n5. research-docs: Index does NOT exist');
    }
  } catch (err: any) {
    console.log('\n5. research-docs: Error', err.message?.substring(0, 200));
  }

  // 6. Simple BM25 test (without kNN)
  try {
    const results = await client.search({
      index: 'research-docs',
      body: {
        size: 3,
        query: { match_all: {} },
      },
    });
    console.log(`\n6. BM25 test (match_all): ${results.hits.total} total hits`);
    for (const hit of results.hits.hits) {
      console.log(`   doc: ${(hit._source as any)?.title ?? hit._id}`);
    }
  } catch (err: any) {
    console.log('\n6. BM25 test: Error', err.message?.substring(0, 200));
  }

  console.log('\n=== Check Complete ===\n');
}

main().catch(console.error);
