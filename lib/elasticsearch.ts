import { Client } from '@elastic/elasticsearch';
import type { Source } from './schemas';

const client = new Client({
  cloud: { id: process.env.ES_CLOUD_ID! },
  auth: { apiKey: process.env.ES_API_KEY! },
});

const INDEX_NAME = 'research-docs';

export async function hybridSearch(query: string): Promise<Source[]> {
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
  } catch (error) {
    console.error('ES search failed, continuing without internal docs:', error);
    return [];
  }
}
