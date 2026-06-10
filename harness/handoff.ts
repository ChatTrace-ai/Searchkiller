/**
 * Structured Handoff Protocol
 *
 * Defines the typed contract between Planner+Generator and Evaluator.
 * Uses file-based communication via .agents/handoffs/ directory.
 *
 * Flow:
 *   Planner+Generator creates HandoffDocument → writes to .agents/handoffs/{id}.json
 *   Evaluator reads HandoffDocument → has full context for quality assessment
 *   Reset clears/archives handoff state between iteration cycles
 */

import { readFile, writeFile, readdir, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Handoff Document — the typed contract
// ---------------------------------------------------------------------------

export interface HandoffSource {
  title: string;
  url: string;
  snippet: string;
}

export interface HandoffReport {
  markdown: string;
  wordCount: number;
  sectionHeadings: string[];
  citationCount: number;
}

export interface HandoffMindMap {
  json: Record<string, unknown>;
  nodeCount: number;
  maxDepth: number;
}

export interface HandoffMetrics {
  planDurationMs: number;
  fetchDurationMs: number;
  reportDurationMs: number;
  mindmapDurationMs: number;
  totalDurationMs: number;
  sourceCount: number;
  modelUsed: string;
}

export type HandoffPhase = 'created' | 'evaluated' | 'iterated' | 'approved' | 'rejected' | 'archived';

/**
 * The structured contract passed from Planner+Generator to Evaluator.
 * Contains everything the Evaluator needs — no implicit dependencies.
 */
export interface HandoffDocument {
  id: string;
  version: number;
  phase: HandoffPhase;
  createdAt: string;
  updatedAt: string;

  input: {
    keyword: string;
    subQueries: string[];
    userFeedback?: string;
  };

  output: {
    report: HandoffReport | null;
    mindmap: HandoffMindMap | null;
    sources: HandoffSource[];
  };

  metrics: HandoffMetrics;

  evaluation?: {
    round: number;
    score: number;
    dimensionScores: Record<string, number>;
    feedback: string;
    passesThreshold: boolean;
  };

  history: HandoffHistoryEntry[];

  parentId?: string;
  traceId?: string;
}

export interface HandoffHistoryEntry {
  round: number;
  timestamp: string;
  action: 'created' | 'evaluated' | 'regenerated' | 'approved' | 'rejected';
  summary: string;
  score?: number;
}

// ---------------------------------------------------------------------------
// Handoff Store — file-based communication layer
// ---------------------------------------------------------------------------

const AGENTS_DIR = join(process.cwd(), '.agents');
const HANDOFFS_DIR = join(AGENTS_DIR, 'handoffs');
const ARCHIVE_DIR = join(AGENTS_DIR, 'handoffs', '_archive');

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function generateHandoffId(): string {
  return `hoff-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * Create a new HandoffDocument from Planner+Generator output.
 */
export function createHandoffDocument(params: {
  keyword: string;
  subQueries: string[];
  report: HandoffReport | null;
  mindmap: HandoffMindMap | null;
  sources: HandoffSource[];
  metrics: HandoffMetrics;
  parentId?: string;
  traceId?: string;
}): HandoffDocument {
  const now = new Date().toISOString();
  return {
    id: generateHandoffId(),
    version: 1,
    phase: 'created',
    createdAt: now,
    updatedAt: now,
    input: {
      keyword: params.keyword,
      subQueries: params.subQueries,
    },
    output: {
      report: params.report,
      mindmap: params.mindmap,
      sources: params.sources,
    },
    metrics: params.metrics,
    history: [{
      round: 1,
      timestamp: now,
      action: 'created',
      summary: `Initial generation for "${params.keyword}"`,
    }],
    parentId: params.parentId,
    traceId: params.traceId,
  };
}

/**
 * Save a HandoffDocument to the file store.
 */
export async function saveHandoff(doc: HandoffDocument): Promise<string> {
  await ensureDir(HANDOFFS_DIR);
  const filepath = join(HANDOFFS_DIR, `${doc.id}.json`);
  doc.updatedAt = new Date().toISOString();
  await writeFile(filepath, JSON.stringify(doc, null, 2), 'utf-8');
  return doc.id;
}

/**
 * Load a HandoffDocument by ID.
 */
export async function loadHandoff(handoffId: string): Promise<HandoffDocument> {
  const filepath = join(HANDOFFS_DIR, `${handoffId}.json`);
  if (!existsSync(filepath)) {
    throw new Error(`Handoff not found: ${handoffId}`);
  }
  const raw = await readFile(filepath, 'utf-8');
  return JSON.parse(raw) as HandoffDocument;
}

/**
 * List all active (non-archived) handoff IDs.
 */
export async function listHandoffs(): Promise<string[]> {
  await ensureDir(HANDOFFS_DIR);
  const files = await readdir(HANDOFFS_DIR);
  return files
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => f.replace('.json', ''));
}

// ---------------------------------------------------------------------------
// Context Reset — clean slate between iteration cycles
// ---------------------------------------------------------------------------

/**
 * Archive a specific handoff (move to _archive/).
 * Used when a cycle completes (approved/rejected) or on explicit reset.
 */
export async function archiveHandoff(handoffId: string): Promise<void> {
  await ensureDir(ARCHIVE_DIR);
  const src = join(HANDOFFS_DIR, `${handoffId}.json`);
  if (!existsSync(src)) return;

  const doc = await loadHandoff(handoffId);
  doc.phase = 'archived';
  doc.updatedAt = new Date().toISOString();

  const dest = join(ARCHIVE_DIR, `${handoffId}.json`);
  await writeFile(dest, JSON.stringify(doc, null, 2), 'utf-8');

  const { unlink } = await import('fs/promises');
  await unlink(src);
}

/**
 * Reset all active handoffs — archive everything and start fresh.
 * Call this at the beginning of a new evaluation cycle.
 */
export async function resetContext(): Promise<{ archived: number }> {
  const ids = await listHandoffs();
  let archived = 0;
  for (const id of ids) {
    await archiveHandoff(id);
    archived++;
  }
  return { archived };
}

// ---------------------------------------------------------------------------
// Handoff Mutation — for iteration rounds
// ---------------------------------------------------------------------------

/**
 * Record an evaluation result on a HandoffDocument.
 */
export async function recordEvaluation(
  handoffId: string,
  evaluation: NonNullable<HandoffDocument['evaluation']>,
): Promise<HandoffDocument> {
  const doc = await loadHandoff(handoffId);
  doc.evaluation = evaluation;
  doc.phase = 'evaluated';
  doc.history.push({
    round: evaluation.round,
    timestamp: new Date().toISOString(),
    action: 'evaluated',
    summary: `Round ${evaluation.round}: score ${evaluation.score.toFixed(2)} — ${evaluation.passesThreshold ? 'PASS' : 'FAIL'}`,
    score: evaluation.score,
  });
  await saveHandoff(doc);
  return doc;
}

/**
 * Create a new version of a HandoffDocument for the next iteration round.
 * Carries forward the evaluation feedback and user input.
 */
export async function createIterationHandoff(
  parentId: string,
  newOutput: {
    report: HandoffReport | null;
    mindmap: HandoffMindMap | null;
    sources: HandoffSource[];
  },
  metrics: HandoffMetrics,
  userFeedback?: string,
): Promise<HandoffDocument> {
  const parent = await loadHandoff(parentId);
  const round = (parent.evaluation?.round ?? 0) + 1;
  const now = new Date().toISOString();

  const newDoc: HandoffDocument = {
    id: generateHandoffId(),
    version: parent.version + 1,
    phase: 'created',
    createdAt: now,
    updatedAt: now,
    input: {
      keyword: parent.input.keyword,
      subQueries: parent.input.subQueries,
      userFeedback,
    },
    output: newOutput,
    metrics,
    history: [
      ...parent.history,
      {
        round,
        timestamp: now,
        action: 'regenerated',
        summary: `Regenerated (round ${round})${userFeedback ? ` with user feedback: "${userFeedback.slice(0, 80)}"` : ' based on evaluator feedback'}`,
      },
    ],
    parentId,
    traceId: parent.traceId,
  };

  await saveHandoff(newDoc);

  parent.phase = 'iterated';
  await saveHandoff(parent);

  return newDoc;
}

/**
 * Mark a handoff as approved — final version promoted to golden.
 */
export async function approveHandoff(handoffId: string): Promise<HandoffDocument> {
  const doc = await loadHandoff(handoffId);
  doc.phase = 'approved';
  doc.history.push({
    round: doc.evaluation?.round ?? doc.version,
    timestamp: new Date().toISOString(),
    action: 'approved',
    summary: `Approved at round ${doc.version} with score ${doc.evaluation?.score?.toFixed(2) ?? 'N/A'}`,
    score: doc.evaluation?.score,
  });
  await saveHandoff(doc);
  return doc;
}

/**
 * Mark a handoff as rejected — route to failures.
 */
export async function rejectHandoff(handoffId: string, reason: string): Promise<HandoffDocument> {
  const doc = await loadHandoff(handoffId);
  doc.phase = 'rejected';
  doc.history.push({
    round: doc.evaluation?.round ?? doc.version,
    timestamp: new Date().toISOString(),
    action: 'rejected',
    summary: `Rejected: ${reason}`,
    score: doc.evaluation?.score,
  });
  await saveHandoff(doc);
  return doc;
}

// ---------------------------------------------------------------------------
// Utility — extract report metrics from raw markdown
// ---------------------------------------------------------------------------

export function extractReportMetrics(markdown: string): Pick<HandoffReport, 'wordCount' | 'sectionHeadings' | 'citationCount'> {
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const sectionHeadings = (markdown.match(/^#{1,3}\s+.+$/gm) ?? [])
    .map((h) => h.replace(/^#+\s+/, ''));
  const citationCount = (markdown.match(/\[#?\d+\]/g) ?? []).length;
  return { wordCount, sectionHeadings, citationCount };
}

export function extractMindMapMetrics(node: Record<string, unknown>): Pick<HandoffMindMap, 'nodeCount' | 'maxDepth'> {
  let count = 0;
  let maxDepth = 0;

  function walk(n: Record<string, unknown>, depth: number) {
    count++;
    if (depth > maxDepth) maxDepth = depth;
    const children = n.children as Record<string, unknown>[] | undefined;
    if (children && Array.isArray(children)) {
      for (const child of children) {
        walk(child, depth + 1);
      }
    }
  }

  walk(node, 0);
  return { nodeCount: count, maxDepth };
}
