import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const AGENTS_DIR = join(process.cwd(), '.agents');
const TRACES_DIR = join(AGENTS_DIR, 'traces');
const GOLDEN_DIR = join(AGENTS_DIR, 'golden');
const FAILURES_DIR = join(AGENTS_DIR, 'failures');
const CONFIG_PATH = join(AGENTS_DIR, 'evaluator-config.json');

test.describe('Agent state: .agents/ directory integrity', () => {
  test('required directories exist', () => {
    expect(existsSync(TRACES_DIR)).toBe(true);
    expect(existsSync(GOLDEN_DIR)).toBe(true);
    expect(existsSync(FAILURES_DIR)).toBe(true);
    expect(existsSync(join(AGENTS_DIR, 'schemas'))).toBe(true);
  });

  test('schemas are valid JSON', () => {
    const schemaDir = join(AGENTS_DIR, 'schemas');
    const files = readdirSync(schemaDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const raw = readFileSync(join(schemaDir, f), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
      const schema = JSON.parse(raw);
      expect(schema.$schema).toContain('json-schema.org');
    }
  });
});

test.describe('Agent state: evaluator config lifecycle', () => {
  test('initialize via API creates config file', async ({ request }) => {
    const res = await request.post('/api/evaluate', {
      data: {
        action: 'initialize',
        initialized_by: 'state-test',
        criteria: {
          require_schema_valid: true,
          require_output_non_empty: true,
          reject_known_failure_patterns: false,
        },
        thresholds: { max_latency_ms: 50000 },
        auto_approve: true,
      },
    });
    expect(res.ok()).toBeTruthy();
    expect(existsSync(CONFIG_PATH)).toBe(true);

    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.initialized_by).toBe('state-test');
  });

  test('evaluate creates trace + routes to store', async ({ request }) => {
    const res = await request.post('/api/evaluate', {
      data: {
        action: 'evaluate',
        keyword: 'state test keyword',
        subQueries: ['query a', 'query b'],
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const traceId = body.traceId;

    const tracePath = join(TRACES_DIR, `${traceId}.json`);
    expect(existsSync(tracePath)).toBe(true);

    const trace = JSON.parse(readFileSync(tracePath, 'utf-8'));
    expect(trace.verdict).toMatch(/^(APPROVED|REJECTED)$/);

    const storePath = body.recycledTo === 'golden'
      ? join(GOLDEN_DIR, `${traceId}.json`)
      : join(FAILURES_DIR, `${traceId}.json`);
    expect(existsSync(storePath)).toBe(true);
  });

  test('re-initialize overwrites config', async ({ request }) => {
    await request.post('/api/evaluate', {
      data: {
        action: 'initialize',
        initialized_by: 'overwrite-test',
        criteria: {
          require_schema_valid: false,
          require_output_non_empty: false,
          reject_known_failure_patterns: false,
        },
        thresholds: {},
        auto_approve: true,
      },
    });

    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.initialized_by).toBe('overwrite-test');
    expect(config.criteria.require_schema_valid).toBe(false);
  });
});
