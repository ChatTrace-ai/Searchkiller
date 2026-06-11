import { getClient } from './es-client';
import {
  seeds,
  buildDetail,
  RESULT_TTL_MS,
} from './prediction-seeds';
import { generateRealPrediction } from './prediction-generator';
import type {
  PredictionDataSource,
  PredictionDetail,
  PredictionListResponse,
  PredictionProgress,
  PredictionStatus,
  PredictionSummary,
} from './prediction-types';

const INDEX_NAME = 'predictions';
const FEATURED_EXPIRES = '2099-01-01T00:00:00.000Z';

let _seedPromise: Promise<void> | null = null;

export function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

export function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: unknown };
    if (!Number.isInteger(parsed.offset) || Number(parsed.offset) < 0) throw new Error('Invalid');
    return Number(parsed.offset);
  } catch {
    throw new Error('INVALID_CURSOR');
  }
}

function toSummary(doc: any): PredictionSummary {
  const detail = doc.detail;
  return {
    id: detail.id,
    question: detail.question,
    category: detail.category,
    icon: detail.icon,
    status: doc.status,
    dataSource: (doc.data_source as PredictionDataSource) ?? 'seed',
    topOutcomes: (detail.outcomes || []).slice(0, 3).map((o: any) => ({
      label: o.label,
      probability: o.probability,
      icon: o.icon,
    })),
    updatedAt: detail.updatedAt,
  };
}

export async function ensurePredictionIndex(): Promise<void> {
  const client = getClient();
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (exists) return;

  await client.indices.create({
    index: INDEX_NAME,
    body: {
      mappings: {
        properties: {
          normalized_question: { type: 'keyword' },
          status: { type: 'keyword' },
          featured: { type: 'boolean' },
          featured_sort: { type: 'integer' },
          ready_at: { type: 'date' },
          expires_at: { type: 'date' },
          category: { type: 'keyword' },
          data_source: { type: 'keyword' },
          detail: { type: 'object', enabled: true },
        },
      },
    },
  });
}

export async function ensureFeaturedSeeded(): Promise<void> {
  if (_seedPromise) return _seedPromise;

  _seedPromise = (async () => {
    await ensurePredictionIndex();

    const client = getClient();
    const operations: any[] = [];

    seeds.forEach((seed, index) => {
      const detail = buildDetail(seed);
      operations.push({ create: { _index: INDEX_NAME, _id: seed.id } });
      operations.push({
        normalized_question: normalizeQuestion(seed.question),
        status: 'completed',
        featured: true,
        featured_sort: index,
        expires_at: FEATURED_EXPIRES,
        category: seed.category,
        data_source: 'seed' as PredictionDataSource,
        detail,
      });
    });

    const response = await client.bulk({ operations, refresh: true });

    let created = 0;
    let duplicates = 0;
    if (response.items) {
      for (const item of response.items) {
        const status = item.create?.status ?? 0;
        if (status === 201) created++;
        else if (status === 409) duplicates++;
      }
    }
    console.info(`[prediction-store] seeded: created=${created}, duplicates=${duplicates}`);

    if (created > 0 && process.env.AUTO_REFRESH_FEATURED !== 'false') {
      scheduleBackgroundRefresh();
    }
  })();

  return _seedPromise;
}

export async function listPopularPredictions(options: {
  offset: number;
  limit: number;
  category?: string | null;
}): Promise<PredictionListResponse> {
  await ensureFeaturedSeeded();
  const client = getClient();

  const filters: any[] = [
    { term: { featured: true } },
    { term: { status: 'completed' } },
    { range: { expires_at: { gt: 'now' } } },
  ];

  if (options.category?.trim()) {
    filters.push({ term: { category: options.category.trim() } });
  }

  const response = await client.search({
    index: INDEX_NAME,
    body: {
      size: options.limit + 1,
      from: options.offset,
      query: { bool: { filter: filters } },
      sort: [{ featured_sort: 'asc' }],
    },
  });

  const hits = response.hits.hits || [];
  const allItems = hits.map((h: any) => toSummary(h._source));
  const hasMore = allItems.length > options.limit;
  const items = allItems.slice(0, options.limit);
  const nextOffset = options.offset + items.length;

  return {
    items,
    nextCursor: hasMore ? encodeCursor(nextOffset) : null,
    hasMore,
  };
}

/** Status promotion is handled by generateRealPrediction writing directly to ES. */
function getDocWithStatus(_id: string, doc: any): any {
  return doc;
}

export async function createPrediction(question: string): Promise<{
  id: string;
  status: PredictionStatus;
  reused: boolean;
}> {
  await ensureFeaturedSeeded();
  const client = getClient();
  const normalized = normalizeQuestion(question);

  const existing = await client.search({
    index: INDEX_NAME,
    body: {
      size: 1,
      query: {
        bool: {
          must: [{ term: { normalized_question: normalized } }],
          filter: [{ range: { expires_at: { gt: 'now' } } }],
        },
      },
    },
  });

  if (existing.hits.hits.length > 0) {
    const hit = existing.hits.hits[0] as any;
    const doc = getDocWithStatus(hit._id!, hit._source);
    return { id: doc.detail.id, status: doc.status, reused: true };
  }

  const id = `pred_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESULT_TTL_MS).toISOString();

  const skeleton = {
    id,
    question,
    category: 'General',
    icon: 'sparkles',
    status: 'processing',
    progress: {
      stage: 'planning',
      message: 'Planning focused research queries',
    },
    outcomes: [],
    sources: [],
    summary: [],
    report: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await client.index({
    index: INDEX_NAME,
    id,
    document: {
      normalized_question: normalized,
      status: 'processing',
      featured: false,
      featured_sort: null,
      ready_at: null,
      expires_at: expiresAt,
      category: 'General',
      data_source: 'real' as PredictionDataSource,
      detail: skeleton,
    },
    refresh: true,
  });

  // Fire-and-forget: trigger real data generation via Exa + Gemini pipeline
  generateRealPrediction(id, question).catch((err) => {
    console.error(`[prediction-store] background generation failed for ${id}:`, err.message);
  });

  return { id, status: 'processing', reused: false };
}

export async function getPrediction(
  id: string,
): Promise<PredictionDetail | PredictionProgress | null> {
  const client = getClient();

  try {
    const response = await client.get({ index: INDEX_NAME, id });
    if (!response.found) return null;

    const doc = getDocWithStatus(id, response._source as any);

    if (doc.status === 'processing') {
      return {
        id: doc.detail.id,
        question: doc.detail.question,
        status: 'processing',
        progress: doc.detail.progress ?? { stage: 'planning', message: 'Planning focused research queries' },
        updatedAt: doc.detail.updatedAt,
      } as PredictionProgress;
    }

    const dataSource = doc.data_source === 'real' ? 'real' : 'seed';
    const detail = { ...doc.detail, status: doc.status, dataSource } as PredictionDetail & { dataSource: string };

    if (doc.status === 'failed') {
      const reason = doc.detail?.confidence?.explanation
        || doc.detail?.summary?.[0]
        || 'Prediction generation failed.';
      return { ...detail, error: { code: 'GENERATION_FAILED', message: reason } } as PredictionDetail & { error: { code: string; message: string }; dataSource: string };
    }

    return detail;
  } catch (error: any) {
    if (error?.statusCode === 404) return null;
    throw error;
  }
}

export async function refreshPrediction(id: string): Promise<
  { status: 'started' } | { status: 'in_progress' } | { status: 'not_found' }
> {
  const client = getClient();

  try {
    const response = await client.get({ index: INDEX_NAME, id });
    if (!response.found) return { status: 'not_found' };

    const doc = getDocWithStatus(id, response._source as any);

    if (doc.status === 'processing') return { status: 'in_progress' };

    const now = Date.now();
    const expiresAt = doc.featured ? FEATURED_EXPIRES : new Date(now + RESULT_TTL_MS).toISOString();
    const question = doc.detail?.question;

    if (!question) return { status: 'not_found' };

    await client.update({
      index: INDEX_NAME,
      id,
      body: {
        doc: {
          status: 'processing',
          ready_at: null,
          expires_at: expiresAt,
          detail: { ...doc.detail, status: 'processing', updatedAt: new Date(now).toISOString() },
        },
      },
      refresh: true,
    });

    generateRealPrediction(id, question).then(() => {
      client.update({
        index: INDEX_NAME,
        id,
        body: { doc: { data_source: 'real' } },
      }).catch(() => {});
    }).catch((err) => {
      console.error(`[prediction-store] refresh generation failed for ${id}:`, err.message);
    });

    return { status: 'started' };
  } catch (error: any) {
    if (error?.statusCode === 404) return { status: 'not_found' };
    throw error;
  }
}

/**
 * Returns featured predictions that still use seed data.
 */
export async function listStaleFeatured(limit = 33): Promise<Array<{ id: string; question: string }>> {
  await ensureFeaturedSeeded();
  const client = getClient();

  const response = await client.search({
    index: INDEX_NAME,
    body: {
      size: limit,
      query: {
        bool: {
          filter: [{ term: { featured: true } }],
          must_not: [{ term: { data_source: 'real' } }],
        },
      },
      sort: [{ featured_sort: 'asc' }],
      _source: ['detail.id', 'detail.question'],
    },
  });

  return (response.hits.hits || []).map((h: any) => ({
    id: h._id as string,
    question: h._source?.detail?.question as string,
  }));
}

const REFRESH_DELAY_MS = 6_000;

/**
 * Batch refresh featured predictions that still have seed data.
 * Returns the number of predictions queued for refresh.
 */
export async function refreshFeaturedBatch(maxConcurrent = 2): Promise<{
  queued: number;
  skipped: number;
  total: number;
}> {
  const stale = await listStaleFeatured();
  if (stale.length === 0) return { queued: 0, skipped: 0, total: 0 };

  let queued = 0;
  let skipped = 0;

  const refreshOne = async (item: { id: string; question: string }, idx: number) => {
    if (idx > 0) {
      await new Promise((r) => setTimeout(r, REFRESH_DELAY_MS));
    }
    const result = await refreshPrediction(item.id);
    if (result.status === 'started') {
      queued++;
      console.log(`[featured-refresh] ${item.id}: started (${queued}/${stale.length})`);
    } else {
      skipped++;
      console.log(`[featured-refresh] ${item.id}: ${result.status}`);
    }
  };

  const chunks: Array<{ id: string; question: string }>[] = [];
  for (let i = 0; i < stale.length; i += maxConcurrent) {
    chunks.push(stale.slice(i, i + maxConcurrent));
  }

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map((item, idx) => refreshOne(item, idx)));
  }

  return { queued, skipped, total: stale.length };
}

let _bgRefreshScheduled = false;

/**
 * Schedule background refresh of first-page featured predictions after seeding.
 * Safe to call multiple times — only runs once.
 */
export function scheduleBackgroundRefresh(delayMs = 10_000, maxItems = 16): void {
  if (_bgRefreshScheduled) return;
  _bgRefreshScheduled = true;

  setTimeout(async () => {
    try {
      const stale = await listStaleFeatured(maxItems);
      if (stale.length === 0) {
        console.log('[featured-refresh] All featured predictions already have real data');
        return;
      }
      console.log(`[featured-refresh] Starting background refresh of ${stale.length} seed predictions`);
      for (let i = 0; i < stale.length; i++) {
        const item = stale[i];
        try {
          const result = await refreshPrediction(item.id);
          console.log(`[featured-refresh] [${i + 1}/${stale.length}] ${item.id}: ${result.status}`);
          if (result.status === 'started' && i < stale.length - 1) {
            await new Promise((r) => setTimeout(r, REFRESH_DELAY_MS));
          }
        } catch (err: any) {
          console.error(`[featured-refresh] [${i + 1}/${stale.length}] ${item.id}: error - ${err.message}`);
        }
      }
      console.log('[featured-refresh] Background refresh round complete');
    } catch (err: any) {
      console.error('[featured-refresh] Background refresh failed:', err.message);
    }
  }, delayMs);
}
