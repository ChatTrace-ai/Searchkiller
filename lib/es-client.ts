import { Client } from '@elastic/elasticsearch';

let _client: Client | null = null;

export function getClient(): Client {
  if (!_client) {
    const apiKey = process.env.ES_API_KEY;
    if (!apiKey) {
      throw new Error('ES_API_KEY must be set');
    }

    const esUrl = process.env.ES_URL;
    const cloudId = process.env.ES_CLOUD_ID;

    if (esUrl) {
      _client = new Client({
        node: esUrl,
        auth: { apiKey },
      });
    } else if (cloudId) {
      _client = new Client({
        cloud: { id: cloudId },
        auth: { apiKey },
      });
    } else {
      throw new Error('Either ES_URL or ES_CLOUD_ID must be set');
    }
  }
  return _client;
}
