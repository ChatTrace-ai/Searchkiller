import { Client } from '@elastic/elasticsearch';

let _client: Client | null = null;

export function getClient(): Client {
  if (!_client) {
    if (!process.env.ES_CLOUD_ID || !process.env.ES_API_KEY) {
      throw new Error('ES_CLOUD_ID and ES_API_KEY must be set');
    }
    _client = new Client({
      cloud: { id: process.env.ES_CLOUD_ID },
      auth: { apiKey: process.env.ES_API_KEY },
    });
  }
  return _client;
}
