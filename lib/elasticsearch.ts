import { getClient } from './es-client';
import type { Source } from './schemas';

const INDEX_NAME = 'research-docs';

function mapHits(hits: any[]): Source[] {
  return (hits || []).map((hit: any) => ({
    title: hit._source?.title || 'Internal Doc',
    url: hit._source?.url || '#internal',
    text: (hit._source?.content || '').substring(0, 2000),
  }));
}

/**
 * Hybrid search: tries kNN + BM25, falls back to pure BM25 if kNN fails.
 * This handles ES Serverless environments where embedding models may not be deployed.
 */
export async function hybridSearch(query: string): Promise<Source[]> {
  try {
    const client = getClient();

    // Try hybrid (BM25 + kNN) first
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
      return mapHits(response.hits.hits);
    } catch {
      // kNN failed (model not deployed) → fall back to pure BM25
    }

    const bm25Response = await client.search({
      index: INDEX_NAME,
      body: {
        size: 5,
        query: { match: { content: { query } } },
      },
    });
    return mapHits(bm25Response.hits.hits);
  } catch (error) {
    console.error('ES search failed, continuing without internal docs:', error);
    return [];
  }
}
