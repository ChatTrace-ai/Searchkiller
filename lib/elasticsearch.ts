import type { Source } from './schemas';

const INDEX_NAME = 'research-docs';

let esBaseUrl: string | null | undefined;
let esApiKey: string | null | undefined;

function parseCloudId(cloudId: string): string | null {
  const separator = cloudId.indexOf(':');
  if (separator === -1) return null;

  const encoded = cloudId.slice(separator + 1);
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const [host] = decoded.split('$');
  if (!host) return null;

  return `https://${host}`;
}

function getEsConfig(): { baseUrl: string; apiKey: string } | null {
  if (esBaseUrl === undefined) {
    const cloudId = process.env.ES_CLOUD_ID;
    const apiKey = process.env.ES_API_KEY;
    if (!cloudId || !apiKey) {
      esBaseUrl = null;
      esApiKey = null;
      return null;
    }

    esBaseUrl = parseCloudId(cloudId);
    esApiKey = apiKey;
  }

  if (!esBaseUrl || !esApiKey) return null;
  return { baseUrl: esBaseUrl, apiKey: esApiKey };
}

export async function hybridSearch(query: string): Promise<Source[]> {
  const config = getEsConfig();
  if (!config) return [];

  try {
    const response = await fetch(`${config.baseUrl}/${INDEX_NAME}/_search`, {
      method: 'POST',
      headers: {
        Authorization: `ApiKey ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (body.includes('index_not_found_exception')) {
        console.warn(
          `ES index "${INDEX_NAME}" not found — run: node --env-file=.env scripts/setup-elasticsearch-index.mjs`,
        );
      } else {
        console.error('ES search failed:', response.status, body);
      }
      return [];
    }

    const data = (await response.json()) as {
      hits?: { hits?: Array<{ _source?: Record<string, string> }> };
    };

    return (data.hits?.hits || []).map((hit) => ({
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
