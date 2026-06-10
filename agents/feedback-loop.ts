/**
 * Feedback Loop Engine
 *
 * Integrates Handoff Protocol, Sprint Contract, and LLM-as-Judge into
 * a complete iterative feedback loop with HITL checkpoints.
 *
 * Flow:
 *   1. startLoop(keyword) → propose contract + generate v1 + evaluate → LoopState
 *   2. loopNext(loopId, userFeedback?) → regenerate + evaluate → updated LoopState
 *   3. loopApprove(loopId) → finalize as golden
 *   4. loopStatus(loopId) → read current state
 *
 * File store: .agents/loops/{loopId}.json
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

import {
  createHandoffDocument,
  saveHandoff,
  loadHandoff,
  recordEvaluation,
  createIterationHandoff,
  approveHandoff,
  extractReportMetrics,
  type HandoffDocument,
  type HandoffReport,
  type HandoffMetrics,
  type HandoffSource,
} from './handoff';

import {
  proposeContract,
  activateContract,
  saveContract,
  loadContract,
  recordRoundResult,
  getBestRound,
  contractSummary,
  type SprintContract,
} from './sprint-contract';

import {
  runLLMJudge,
  judgeToDimensionScores,
  formatJudgeFeedback,
} from './evaluator/llm-judge';

// ---------------------------------------------------------------------------
// Loop State Types
// ---------------------------------------------------------------------------

export type LoopStatus = 'active' | 'approved' | 'expired' | 'cancelled';

export interface LoopRound {
  round: number;
  handoffId: string;
  score: number;
  dimensionScores: Record<string, number>;
  feedback: string;
  contractSatisfied: boolean;
  timestamp: string;
}

export interface LoopState {
  id: string;
  status: LoopStatus;
  keyword: string;
  contractId: string;
  currentRound: number;
  maxRounds: number;
  rounds: LoopRound[];
  bestRound: number | null;
  bestScore: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completionReason?: string;
}

export interface LoopNextResult {
  loop: LoopState;
  latestRound: LoopRound;
  sprintComplete: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Loop Store
// ---------------------------------------------------------------------------

const AGENTS_DIR = join(process.cwd(), '.agents');
const LOOPS_DIR = join(AGENTS_DIR, 'loops');

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function generateLoopId(): string {
  return `loop-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

export async function saveLoop(loop: LoopState): Promise<void> {
  await ensureDir(LOOPS_DIR);
  loop.updatedAt = new Date().toISOString();
  const filepath = join(LOOPS_DIR, `${loop.id}.json`);
  await writeFile(filepath, JSON.stringify(loop, null, 2), 'utf-8');
}

export async function loadLoop(loopId: string): Promise<LoopState> {
  const filepath = join(LOOPS_DIR, `${loopId}.json`);
  if (!existsSync(filepath)) {
    throw new Error(`Feedback loop not found: ${loopId}`);
  }
  const raw = await readFile(filepath, 'utf-8');
  return JSON.parse(raw) as LoopState;
}

export async function listLoops(): Promise<string[]> {
  await ensureDir(LOOPS_DIR);
  const files = await readdir(LOOPS_DIR);
  return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
}

// ---------------------------------------------------------------------------
// Report Generation (delegates to existing pipeline)
// ---------------------------------------------------------------------------

/**
 * Generate a research report. This is a pluggable function that
 * callers can override. Default implementation returns a placeholder.
 *
 * In production, this would call the report generation API or
 * directly invoke Gemini with the research context.
 */
export type ReportGenerator = (
  keyword: string,
  subQueries: string[],
  sources: HandoffSource[],
  previousFeedback?: string,
  userFeedback?: string,
) => Promise<{ report: HandoffReport; metrics: HandoffMetrics }>;

let _reportGenerator: ReportGenerator | null = null;

export function setReportGenerator(gen: ReportGenerator): void {
  _reportGenerator = gen;
}

async function generateReport(
  keyword: string,
  subQueries: string[],
  sources: HandoffSource[],
  previousFeedback?: string,
  userFeedback?: string,
): Promise<{ report: HandoffReport; metrics: HandoffMetrics }> {
  if (_reportGenerator) {
    return _reportGenerator(keyword, subQueries, sources, previousFeedback, userFeedback);
  }

  const markdown = `## 关于"${keyword}"的研究报告

> 此为反馈循环引擎生成的占位报告。在生产环境中，此处将由 Gemini Pro 生成完整报告。

### 背景概述
基于 ${sources.length} 个来源的分析。

### 关键发现
${subQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

### 结论
待生成。

${previousFeedback ? `\n### 基于评估反馈的改进\n${previousFeedback}` : ''}
${userFeedback ? `\n### 基于用户反馈的改进\n${userFeedback}` : ''}`;

  const reportMetrics = extractReportMetrics(markdown);

  return {
    report: {
      markdown,
      ...reportMetrics,
    },
    metrics: {
      planDurationMs: 0,
      fetchDurationMs: 0,
      reportDurationMs: 0,
      mindmapDurationMs: 0,
      totalDurationMs: 0,
      sourceCount: sources.length,
      modelUsed: 'placeholder',
    },
  };
}

// ---------------------------------------------------------------------------
// Core Loop Functions
// ---------------------------------------------------------------------------

/**
 * Start a new feedback loop.
 *
 * 1. Proposes and activates a SprintContract
 * 2. Generates the first report version
 * 3. Evaluates it with LLM-as-Judge
 * 4. Returns the initial LoopState
 */
export async function startLoop(params: {
  keyword: string;
  subQueries?: string[];
  sources?: HandoffSource[];
  maxRounds?: number;
  contractOverrides?: Partial<SprintContract['globalThresholds']>;
}): Promise<LoopNextResult> {
  const {
    keyword,
    subQueries = [],
    sources = [],
    maxRounds = 10,
    contractOverrides,
  } = params;

  const contract = proposeContract(keyword);
  if (contractOverrides) {
    Object.assign(contract.globalThresholds, contractOverrides);
  }
  contract.globalThresholds.maxRounds = maxRounds;
  activateContract(contract);
  await saveContract(contract);

  const { report, metrics } = await generateReport(keyword, subQueries, sources);

  const handoff = createHandoffDocument({
    keyword,
    subQueries,
    report,
    mindmap: null,
    sources,
    metrics,
  });
  await saveHandoff(handoff);

  const judgeResult = await runLLMJudge(handoff, contract.dimensions);
  const dimensionScores = judgeToDimensionScores(judgeResult);
  const feedback = formatJudgeFeedback(judgeResult);

  const { contract: updatedContract, result: roundResult, sprintComplete, reason } =
    recordRoundResult(contract, handoff.id, dimensionScores, feedback);
  await saveContract(updatedContract);

  await recordEvaluation(handoff.id, {
    round: 1,
    score: roundResult.weightedScore,
    dimensionScores,
    feedback,
    passesThreshold: roundResult.contractSatisfied,
  });

  const loopRound: LoopRound = {
    round: 1,
    handoffId: handoff.id,
    score: roundResult.weightedScore,
    dimensionScores,
    feedback,
    contractSatisfied: roundResult.contractSatisfied,
    timestamp: new Date().toISOString(),
  };

  const loop: LoopState = {
    id: generateLoopId(),
    status: sprintComplete ? (reason?.includes('Auto-approved') ? 'approved' : 'expired') : 'active',
    keyword,
    contractId: contract.id,
    currentRound: 1,
    maxRounds,
    rounds: [loopRound],
    bestRound: 1,
    bestScore: roundResult.weightedScore,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: sprintComplete ? new Date().toISOString() : undefined,
    completionReason: reason,
  };

  await saveLoop(loop);

  return { loop, latestRound: loopRound, sprintComplete, reason };
}

/**
 * Execute the next iteration round.
 *
 * 1. Loads the current loop state and contract
 * 2. Regenerates report with evaluator + user feedback
 * 3. Re-evaluates with LLM-as-Judge
 * 4. Checks contract satisfaction
 */
export async function loopNext(
  loopId: string,
  userFeedback?: string,
): Promise<LoopNextResult> {
  const loop = await loadLoop(loopId);

  if (loop.status !== 'active') {
    throw new Error(`Loop ${loopId} is not active (status: ${loop.status})`);
  }

  const contract = await loadContract(loop.contractId);
  const previousRound = loop.rounds[loop.rounds.length - 1];
  const previousHandoff = await loadHandoff(previousRound.handoffId);

  const { report, metrics } = await generateReport(
    loop.keyword,
    previousHandoff.input.subQueries,
    previousHandoff.output.sources,
    previousRound.feedback,
    userFeedback,
  );

  const newHandoff = await createIterationHandoff(
    previousRound.handoffId,
    { report, mindmap: null, sources: previousHandoff.output.sources },
    metrics,
    userFeedback,
  );

  const judgeResult = await runLLMJudge(newHandoff, contract.dimensions);
  const dimensionScores = judgeToDimensionScores(judgeResult);
  const feedback = formatJudgeFeedback(judgeResult);

  const { contract: updatedContract, result: roundResult, sprintComplete, reason } =
    recordRoundResult(contract, newHandoff.id, dimensionScores, feedback);
  await saveContract(updatedContract);

  await recordEvaluation(newHandoff.id, {
    round: loop.currentRound + 1,
    score: roundResult.weightedScore,
    dimensionScores,
    feedback,
    passesThreshold: roundResult.contractSatisfied,
  });

  const loopRound: LoopRound = {
    round: loop.currentRound + 1,
    handoffId: newHandoff.id,
    score: roundResult.weightedScore,
    dimensionScores,
    feedback,
    contractSatisfied: roundResult.contractSatisfied,
    timestamp: new Date().toISOString(),
  };

  loop.currentRound++;
  loop.rounds.push(loopRound);

  if (roundResult.weightedScore > loop.bestScore) {
    loop.bestScore = roundResult.weightedScore;
    loop.bestRound = loop.currentRound;
  }

  if (sprintComplete) {
    loop.status = reason?.includes('Auto-approved') ? 'approved' : 'expired';
    loop.completedAt = new Date().toISOString();
    loop.completionReason = reason;
  }

  await saveLoop(loop);

  return { loop, latestRound: loopRound, sprintComplete, reason };
}

/**
 * Manually approve the current best version — end the loop.
 */
export async function loopApprove(loopId: string): Promise<LoopState> {
  const loop = await loadLoop(loopId);

  if (loop.status !== 'active') {
    throw new Error(`Loop ${loopId} is not active (status: ${loop.status})`);
  }

  const bestRound = loop.rounds.reduce((best, r) =>
    r.score > best.score ? r : best,
  );

  await approveHandoff(bestRound.handoffId);

  loop.status = 'approved';
  loop.completedAt = new Date().toISOString();
  loop.completionReason = `User approved round ${bestRound.round} (score: ${bestRound.score})`;

  await saveLoop(loop);
  return loop;
}

/**
 * Cancel an active loop.
 */
export async function loopCancel(loopId: string, reason?: string): Promise<LoopState> {
  const loop = await loadLoop(loopId);
  loop.status = 'cancelled';
  loop.completedAt = new Date().toISOString();
  loop.completionReason = reason ?? 'Cancelled by user';
  await saveLoop(loop);
  return loop;
}

/**
 * Get a human-readable summary of the loop's progress.
 */
export function loopSummary(loop: LoopState): string {
  const lines: string[] = [
    `=== Feedback Loop: ${loop.id} ===`,
    `Keyword: ${loop.keyword}`,
    `Status: ${loop.status}`,
    `Round: ${loop.currentRound} / ${loop.maxRounds}`,
    `Best: round ${loop.bestRound ?? '-'} (score: ${loop.bestScore.toFixed(2)})`,
    '',
    'Round History:',
  ];

  for (const round of loop.rounds) {
    const marker = round.contractSatisfied ? 'PASS' : 'FAIL';
    const isBest = round.round === loop.bestRound ? ' ★' : '';
    lines.push(`  R${round.round}: ${round.score.toFixed(2)} [${marker}]${isBest}`);
    const dims = Object.entries(round.dimensionScores)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    lines.push(`       ${dims}`);
  }

  if (loop.completionReason) {
    lines.push('');
    lines.push(`Outcome: ${loop.completionReason}`);
  }

  return lines.join('\n');
}
