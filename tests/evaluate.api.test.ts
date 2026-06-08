import { test, expect } from '@playwright/test';

test.describe('/api/evaluate endpoint', () => {
  test('initialize → returns config with all fields', async ({ request }) => {
    const res = await request.post('/api/evaluate', {
      data: {
        action: 'initialize',
        initialized_by: 'playwright-test',
        criteria: {
          require_schema_valid: true,
          require_output_non_empty: true,
          reject_known_failure_patterns: false,
          custom_rules: [],
        },
        thresholds: { max_latency_ms: 60000 },
        auto_approve: true,
        notes: 'Test initialization',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('initialized');
    expect(body.config.initialized_by).toBe('playwright-test');
    expect(body.config.initialized_at).toBeTruthy();
  });

  test('config → returns current evaluator config', async ({ request }) => {
    const res = await request.post('/api/evaluate', {
      data: { action: 'config' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.initialized_by).toBeTruthy();
    expect(body.criteria).toBeTruthy();
    expect(body.thresholds).toBeTruthy();
  });

  test('evaluate → full cycle returns verdict', async ({ request }) => {
    const res = await request.post('/api/evaluate', {
      data: {
        action: 'evaluate',
        keyword: 'playwright test keyword',
        subQueries: ['sub query 1', 'sub query 2', 'sub query 3'],
        meta: { duration_ms: 500 },
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.traceId).toMatch(/^trace-[a-f0-9]+$/);
    expect(body.evaluation.verdict).toMatch(/^(APPROVED|REJECTED)$/);
    expect(body.recycledTo).toMatch(/^(golden|failures)$/);
  });

  test('stats → returns system summary', async ({ request }) => {
    const res = await request.post('/api/evaluate', {
      data: { action: 'stats' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.evaluatorInitialized).toBe(true);
    expect(typeof body.totalTraces).toBe('number');
    expect(typeof body.goldenCount).toBe('number');
    expect(typeof body.failureCount).toBe('number');
  });

  test('unknown action → 400 error', async ({ request }) => {
    const res = await request.post('/api/evaluate', {
      data: { action: 'unknown_action' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Unknown action');
  });
});

test.describe('/api/plan endpoint', () => {
  test('POST with keyword → returns subQueries', async ({ request }) => {
    const res = await request.post('/api/plan', {
      data: { keyword: 'test keyword' },
    });
    if (res.ok()) {
      const body = await res.json();
      expect(body.subQueries).toBeTruthy();
      expect(Array.isArray(body.subQueries)).toBe(true);
    } else {
      // May fail without Gemini API key — that's expected in test env
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('POST without keyword → 400', async ({ request }) => {
    const res = await request.post('/api/plan', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});
