import { randomBytes, createHash } from 'crypto';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

export interface TraceRecord {
  id: string;
  agent: 'planner' | 'evaluator';
  action: string;
  input_hash: string;
  output_hash: string;
  timestamp: string;
  verdict: 'PENDING' | 'APPROVED' | 'REJECTED';
  metadata?: Record<string, unknown>;
  handoffId?: string;
}

export interface PlanResult {
  traceId: string;
  subQueries: string[];
  action: string;
  handoffId?: string;
}

const TRACES_DIR = join(process.cwd(), '.agents', 'traces');

function generateTraceId(): string {
  return `trace-${randomBytes(8).toString('hex')}`;
}

function sha256(data: string): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

export function createTrace(
  action: string,
  input: unknown,
  output: unknown,
  metadata?: Record<string, unknown>,
): TraceRecord {
  return {
    id: generateTraceId(),
    agent: 'planner',
    action,
    input_hash: sha256(JSON.stringify(input)),
    output_hash: sha256(JSON.stringify(output)),
    timestamp: new Date().toISOString(),
    verdict: 'PENDING',
    metadata,
  };
}

export async function emitTrace(trace: TraceRecord): Promise<string> {
  const filepath = join(TRACES_DIR, `${trace.id}.json`);
  await writeFile(filepath, JSON.stringify(trace, null, 2), 'utf-8');
  return trace.id;
}

export async function loadTrace(traceId: string): Promise<TraceRecord> {
  const filepath = join(TRACES_DIR, `${traceId}.json`);
  const raw = await readFile(filepath, 'utf-8');
  return JSON.parse(raw) as TraceRecord;
}

export async function listTraces(): Promise<string[]> {
  const files = await readdir(TRACES_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

/**
 * Core planner function: decomposes a keyword into a traced execution plan.
 * Emits a trace with verdict=PENDING for the Evaluator to pick up.
 * Optionally links to a HandoffDocument for structured context passing.
 */
export async function plan(
  keyword: string,
  subQueries: string[],
  meta?: Record<string, unknown>,
): Promise<PlanResult> {
  const action = `plan:decompose:${keyword.slice(0, 50)}`;
  const input = { keyword };
  const output = { subQueries };

  const handoffId = meta?.handoffId as string | undefined;

  const trace = createTrace(action, input, output, {
    keyword,
    sub_queries: subQueries,
    source_count: 0,
    ...meta,
  });

  if (handoffId) {
    trace.handoffId = handoffId;
  }

  await emitTrace(trace);

  return {
    traceId: trace.id,
    subQueries,
    action,
    handoffId,
  };
}
