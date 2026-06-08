/**
 * Playwright MCP Bridge
 *
 * Provides a programmatic interface for the Evaluator to invoke Playwright tests
 * and consume structured results. Acts as the "MCP server" that translates between
 * the agent evaluation pipeline and the Playwright test runner.
 *
 * Usage by Evaluator:
 *   import { runTestSuite, runSingleTest } from './mcp/playwright-bridge';
 *   const result = await runTestSuite('api');
 */

import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const REPORT_PATH = join(PROJECT_ROOT, '.agents', 'test-report.json');

export interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  failures: FailedTest[];
  raw_report_path: string;
}

export interface FailedTest {
  title: string;
  file: string;
  error: string;
}

function runPlaywright(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = execFile(
      'npx',
      ['playwright', 'test', ...args],
      { cwd: PROJECT_ROOT, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: error?.code ?? (proc.exitCode ?? 0),
        });
      },
    );
  });
}

async function parseReport(): Promise<TestResult> {
  if (!existsSync(REPORT_PATH)) {
    return {
      suite: 'unknown',
      passed: 0,
      failed: 0,
      skipped: 0,
      duration_ms: 0,
      failures: [],
      raw_report_path: REPORT_PATH,
    };
  }

  const raw = await readFile(REPORT_PATH, 'utf-8');
  const report = JSON.parse(raw);

  const suites = report.suites ?? [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures: FailedTest[] = [];

  function walkSpecs(specs: any[], file: string) {
    for (const spec of specs) {
      for (const test of spec.tests ?? []) {
        const status = test.status ?? test.expectedStatus;
        if (status === 'passed' || status === 'expected') passed++;
        else if (status === 'skipped') skipped++;
        else {
          failed++;
          const errorMsg = test.results?.[0]?.error?.message ?? 'Unknown error';
          failures.push({ title: spec.title, file, error: errorMsg });
        }
      }
    }
  }

  for (const suite of suites) {
    walkSpecs(suite.specs ?? [], suite.file ?? 'unknown');
    for (const child of suite.suites ?? []) {
      walkSpecs(child.specs ?? [], child.file ?? suite.file ?? 'unknown');
    }
  }

  return {
    suite: suites[0]?.title ?? 'all',
    passed,
    failed,
    skipped,
    duration_ms: Math.round((report.stats?.duration ?? 0) * 1000),
    failures,
    raw_report_path: REPORT_PATH,
  };
}

/**
 * Run a specific Playwright test project (api, ui, state).
 */
export async function runTestSuite(project: 'api' | 'ui' | 'state' | 'all'): Promise<TestResult> {
  const args = project === 'all'
    ? ['--reporter=json']
    : [`--project=${project}`, '--reporter=json'];

  const { exitCode } = await runPlaywright(args);
  const result = await parseReport();
  result.suite = project;
  return result;
}

/**
 * Run a single test file.
 */
export async function runSingleTest(testFile: string): Promise<TestResult> {
  const { exitCode } = await runPlaywright([testFile, '--reporter=json']);
  const result = await parseReport();
  result.suite = testFile;
  return result;
}

/**
 * Health check: verify Playwright is installed and can run.
 */
export async function healthCheck(): Promise<{ ok: boolean; version: string; error?: string }> {
  try {
    const { stdout, exitCode } = await runPlaywright(['--version']);
    return { ok: exitCode === 0, version: stdout.trim() };
  } catch (err: unknown) {
    return { ok: false, version: '', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
