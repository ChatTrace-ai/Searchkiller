import { createHash } from 'crypto';
import { getClient } from './es-client';
import type { KnowledgeEntry, KnowledgeDocument, CoverageResult, BulkResult, Source } from './schemas';

const INDEX_NAME = 'knowledge-cache';
const DEFAULT_THRESHOLD = 0.85;
const DEFAULT_TIMEOUT_MS = 3000;
const TTL_DAYS = 30;

function deterministicId(projectId: string, sourceUrl: string): string {
  return createHash('sha256').update(`${projectId}:${sourceUrl}`).digest('hex');
}

function buildKnowledgeDocument(entry: KnowledgeEntry): KnowledgeDocument {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);

  return {
    ...entry,
    embedding_text: `${entry.topic} ${entry.facts.join('. ')}`,
    expires_at: expiresAt.toISOString(),
    access_count: 0,
  };
}

export async function ensureKnowledgeIndex(): Promise<void> {
  const client = getClient();
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (exists) return;

  await client.indices.create({
    index: INDEX_NAME,
    body: {
      mappings: {
        properties: {
          project_id: { type: 'keyword' },
          topic: { type: 'text', analyzer: 'standard' },
          facts: { type: 'text' },
          entities: {
            type: 'nested',
            properties: {
              name: { type: 'keyword' },
              type: { type: 'keyword' },
              description: { type: 'text' },
            },
          },
          source_url: { type: 'keyword' },
          source_title: { type: 'text' },
          raw_summary: { type: 'text' },
          embedding_text: {
            type: 'semantic_text',
            inference_id: '.multilingual-e5-small-elasticsearch',
          },
          created_at: { type: 'date' },
          expires_at: { type: 'date' },
          access_count: { type: 'integer' },
          last_accessed_at: { type: 'date' },
        },
      },
    },
  });
}

export async function indexKnowledge(entry: KnowledgeEntry): Promise<string> {
  const client = getClient();
  const docId = deterministicId(entry.project_id, entry.source_url);
  const doc = buildKnowledgeDocument(entry);

  try {
    await client.index({
      index: INDEX_NAME,
      id: docId,
      op_type: 'create',
      document: doc,
    });
  } catch (error: any) {
    if (error?.statusCode === 409) {
      return docId;
    }
    throw error;
  }

  return docId;
}

export async function indexKnowledgeBulk(entries: KnowledgeEntry[]): Promise<BulkResult> {
  if (entries.length === 0) {
    return { succeeded: 0, failed: 0, duplicates: 0 };
  }

  const client = getClient();
  const operations: any[] = [];

  for (const entry of entries) {
    const docId = deterministicId(entry.project_id, entry.source_url);
    const doc = buildKnowledgeDocument(entry);
    operations.push({ create: { _index: INDEX_NAME, _id: docId } });
    operations.push(doc);
  }

  const response = await client.bulk({ operations, refresh: false });

  let succeeded = 0;
  let failed = 0;
  let duplicates = 0;
  const errors: BulkResult['errors'] = [];

  if (response.items) {
    for (const item of response.items) {
      const action = item.create;
      if (!action) continue;
      const status = action.status ?? 0;
      if (status === 201 || status === 200) {
        succeeded++;
      } else if (status === 409) {
        duplicates++;
      } else {
        failed++;
        errors.push({
          id: action._id || 'unknown',
          status,
          error: action.error?.reason ?? undefined,
        });
      }
    }
  }

  const result: BulkResult = { succeeded, failed, duplicates };
  if (errors.length > 0) result.errors = errors;

  console.info('[knowledge-store] bulk result:', { succeeded, failed, duplicates });
  return result;
}

async function trackAccess(docId: string): Promise<void> {
  const client = getClient();
  await client.update({
    index: INDEX_NAME,
    id: docId,
    body: {
      script: {
        source: 'ctx._source.access_count = (ctx._source.access_count == null ? 0 : ctx._source.access_count) + 1; ctx._source.last_accessed_at = params.now;',
        lang: 'painless',
        params: { now: new Date().toISOString() },
      },
    },
  });
}

export async function checkCoverage(
  projectId: string,
  subQuery: string,
  options?: { threshold?: number; timeoutMs?: number },
): Promise<CoverageResult> {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const client = getClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await client.search(
      {
        index: INDEX_NAME,
        body: {
          size: 5,
          query: {
            bool: {
              must: [
                {
                  semantic: {
                    field: 'embedding_text',
                    query: subQuery,
                  },
                },
              ],
              filter: [
                { term: { project_id: projectId } },
                { range: { expires_at: { gte: 'now' } } },
              ],
            },
          },
        },
      },
      { signal: controller.signal as any },
    );

    clearTimeout(timer);

    const hits = response.hits.hits || [];
    if (hits.length === 0) {
      return { subQuery, covered: false, score: 0, existingEntries: [] };
    }

    const topScore = (hits[0] as any)._score ?? 0;
    const normalizedScore = Math.min(topScore, 1);

    const existingEntries: KnowledgeEntry[] = hits
      .filter((h: any) => (h._score ?? 0) >= threshold * topScore)
      .map((h: any) => {
        const src = h._source;
        return {
          project_id: src.project_id,
          topic: src.topic,
          facts: src.facts || [],
          entities: src.entities || [],
          source_url: src.source_url,
          source_title: src.source_title,
          raw_summary: src.raw_summary,
          created_at: src.created_at,
        };
      });

    const covered = normalizedScore >= threshold;

    if (covered && (hits[0] as any)._id) {
      void trackAccess((hits[0] as any)._id).catch(() => {});
    }

    return { subQuery, covered, score: normalizedScore, existingEntries };
  } catch {
    return { subQuery, covered: false, score: 0, existingEntries: [] };
  }
}

export async function getProjectKnowledge(
  projectId: string,
  limit = 100,
): Promise<KnowledgeEntry[]> {
  try {
    const client = getClient();
    const response = await client.search({
      index: INDEX_NAME,
      body: {
        size: limit,
        query: { term: { project_id: projectId } },
        sort: [{ created_at: 'desc' }],
      },
    });

    return (response.hits.hits || []).map((h: any) => h._source as KnowledgeEntry);
  } catch {
    return [];
  }
}

export async function deleteKnowledge(
  projectId: string,
  sourceUrl: string,
): Promise<boolean> {
  try {
    const client = getClient();
    const docId = deterministicId(projectId, sourceUrl);
    await client.delete({ index: INDEX_NAME, id: docId });
    return true;
  } catch {
    return false;
  }
}

export function toSource(entry: KnowledgeEntry): Source {
  return {
    title: entry.source_title,
    url: entry.source_url,
    text: entry.raw_summary,
    origin: 'knowledge-cache',
  };
}
