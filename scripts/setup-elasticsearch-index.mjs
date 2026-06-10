/**
 * Create the research-docs index on Elastic Cloud Serverless.
 * Usage: node --env-file=.env scripts/setup-elasticsearch-index.mjs
 */
const INDEX = 'research-docs';
const cloudId = process.env.ES_CLOUD_ID;
const apiKey = process.env.ES_API_KEY;

if (!cloudId || !apiKey) {
  console.error('Set ES_CLOUD_ID and ES_API_KEY in .env');
  process.exit(1);
}

const [, encoded] = cloudId.split(':');
const decoded = Buffer.from(encoded, 'base64').toString('utf8');
const [, esUuid] = decoded.split('$');
const [regionHost] = decoded.split('$');
const region = regionHost.replace('.gcp.elastic.cloud', '').replace('.elastic.cloud', '');
const host = `https://${esUuid}.es.${region}.gcp.elastic.cloud`;

const headers = {
  Authorization: `ApiKey ${apiKey}`,
  'Content-Type': 'application/json',
};

const existsRes = await fetch(`${host}/${INDEX}`, { method: 'HEAD', headers });
if (existsRes.status === 200) {
  console.log(`Index "${INDEX}" already exists.`);
  process.exit(0);
}

const createRes = await fetch(`${host}/${INDEX}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    mappings: {
      properties: {
        title: { type: 'text' },
        url: { type: 'keyword' },
        content: { type: 'text' },
      },
    },
  }),
});

if (!createRes.ok) {
  console.error(await createRes.text());
  process.exit(1);
}

console.log(`Created index "${INDEX}" on ${host}`);
