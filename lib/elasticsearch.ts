import { Client } from '@elastic/elasticsearch';
import type { Source } from './schemas';

const INDEX_NAME = 'research-docs';

let client: Client | null | undefined;

function getClient(): Client | null {
  const cloudId = process.env.ES_CLOUD_ID;
  const apiKey = process.env.ES_API_KEY;
  if (!cloudId || !apiKey) return null;

  return new Client({
    cloud: { id: cloudId },
    auth: { apiKey },
  });
}

export async function hybridSearch(query: string): Promise<Source[]> {
  if (client === undefined) client = getClient();
  if (!client) return [];

  try {
    const response = await client.search({
      index: INDEX_NAME,
      body: {
        size: 5,
        query: {
          bool: {
            should: [
              { match: { content: { query, boost: 1.0 } } },
              {
                knn: {
                  field: 'content_embedding',
                  query_vector_builder: {
                    text_embedding: {
                      model_id: '.multilingual-e5-small',
                      model_text: query,
                    },
                  },
                  num_candidates: 50,
                  boost: 2.0,
                },
              },
            ],
          },
        },
      },
    });

    return (response.hits.hits || []).map((hit: any) => ({
      title: hit._source?.title || 'Internal Doc',
      url: hit._source?.url || '#internal',
      text: (hit._source?.content || '').substring(0, 2000),
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('index_not_found_exception')) {
      console.warn(
        `ES index "${INDEX_NAME}" not found — run: node --env-file=.env scripts/setup-elasticsearch-index.mjs`,
      );
    } else {
      console.error('ES search failed, continuing without internal docs:', error);
    }
    return [];
  }
}
