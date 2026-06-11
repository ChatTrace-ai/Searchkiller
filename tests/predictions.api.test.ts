import { test, expect } from '@playwright/test';

test.describe('/api/predictions/popular', () => {
  test('returns 16 predictions and a cursor for the next batch', async ({ request }) => {
    const first = await request.get('/api/predictions/popular?limit=16');
    expect(first.status()).toBe(200);

    const firstBody = await first.json();
    expect(firstBody.items).toHaveLength(16);
    expect(firstBody.hasMore).toBe(true);
    expect(typeof firstBody.nextCursor).toBe('string');

    const second = await request.get(
      `/api/predictions/popular?limit=16&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
    );
    expect(second.status()).toBe(200);

    const secondBody = await second.json();
    expect(secondBody.items).toHaveLength(16);
    expect(secondBody.hasMore).toBe(false);
    expect(secondBody.nextCursor).toBeNull();
  });

  test('supports category filtering', async ({ request }) => {
    const response = await request.get(
      '/api/predictions/popular?limit=32&category=Crypto',
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item: { category: string }) => item.category === 'Crypto')).toBe(true);
  });

  test('rejects invalid pagination parameters', async ({ request }) => {
    const invalidLimit = await request.get('/api/predictions/popular?limit=33');
    expect(invalidLimit.status()).toBe(400);
    expect((await invalidLimit.json()).error.code).toBe('INVALID_REQUEST');

    const invalidCursor = await request.get(
      '/api/predictions/popular?cursor=not-a-cursor',
    );
    expect(invalidCursor.status()).toBe(400);
    expect((await invalidCursor.json()).error.code).toBe('INVALID_REQUEST');
  });
});

test.describe('/api/predictions', () => {
  test('reuses a completed prediction with the same normalized question', async ({ request }) => {
    const response = await request.post('/api/predictions', {
      data: { question: '  WHO will win the 2026 FIFA World Cup?  ' },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      id: 'world-cup-2026',
      status: 'completed',
      reused: true,
      pollAfterMs: null,
    });
  });

  test('creates, completes, and refreshes a mock prediction', async ({ request }) => {
    const question = `Will the API mock complete successfully ${Date.now()}?`;
    const create = await request.post('/api/predictions', {
      data: { question },
    });

    expect(create.status()).toBe(202);
    const created = await create.json();
    expect(created.id).toMatch(/^pred_[a-f0-9]{12}$/);
    expect(created.status).toBe('processing');
    expect(created.reused).toBe(false);
    expect(created.pollAfterMs).toBe(2000);

    const processing = await request.get(`/api/predictions/${created.id}`);
    expect(processing.status()).toBe(200);
    expect((await processing.json()).status).toBe('processing');

    await new Promise((resolve) => setTimeout(resolve, 2_100));

    const completed = await request.get(`/api/predictions/${created.id}`);
    expect(completed.status()).toBe(200);
    const detail = await completed.json();
    expect(detail.status).toBe('completed');
    expect(detail.question).toBe(question);
    const probabilityTotal = detail.outcomes.reduce(
      (total: number, outcome: { probability: number }) =>
        total + outcome.probability,
      0,
    );
    expect(probabilityTotal).toBeCloseTo(100, 1);

    const refresh = await request.post(
      `/api/predictions/${created.id}/refresh`,
    );
    expect(refresh.status()).toBe(202);
    expect((await refresh.json()).status).toBe('processing');

    const duplicateRefresh = await request.post(
      `/api/predictions/${created.id}/refresh`,
    );
    expect(duplicateRefresh.status()).toBe(409);
    expect((await duplicateRefresh.json()).error.code).toBe(
      'PREDICTION_IN_PROGRESS',
    );
  });

  test('returns consistent validation and not-found errors', async ({ request }) => {
    const invalid = await request.post('/api/predictions', {
      data: { question: 'no' },
    });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).error.code).toBe('INVALID_REQUEST');

    const missing = await request.get('/api/predictions/does-not-exist');
    expect(missing.status()).toBe(404);
    expect((await missing.json()).error.code).toBe('PREDICTION_NOT_FOUND');
  });
});
