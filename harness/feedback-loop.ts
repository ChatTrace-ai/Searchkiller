/**
 * Harness Feedback Loop Engine — Generic Iterative Quality Loop
 *
 * This module is FULLY DECOUPLED from any specific application.
 * It operates through interfaces (IJudge, IReportGenerator) defined
 * in harness/types.ts. Applications provide concrete implementations.
 *
 * Flow:
 *   1. startLoop(keyword, judge, generator) → LoopState
 *   2. loopNext(loopId, judge, generator, userFeedback?) → updated LoopState
 *   3. loopApprove(loopId) → finalize
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
  type HandoffSource,
} from './handoff';

import {
  proposeContract,
  activateContract,
  saveContract,
  loadContract,
  recordRoundResult,
  type SprintContract,
} from './sprint-contract';

import type { IJudge, IReportGenerator, JudgeResult } from './types';

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
// Helper: format judge result as readable feedback string
// ---------------------------------------------------------------------------

function formatJudgeResult(result: JudgeResult): string {
  const scoreEntries = Object.entries(result.scores)
    .map(([k, v]) => `${k}=${v}`)
    .join(' | ');

  const lines: string[] = [
    `**总评**: ${result.feedback.overallAssessment}`,
    '',
    `**评分**: ${scoreEntries}`,
    '',
    '**优点**:',
    ...result.feedback.strengths.map((s) => `  + ${s}`),
    '',
    '**不足**:',
    ...result.feedback.weaknesses.map((w) => `  - ${w}`),
    '',
    '**改进建议**:',
    ...result.feedback.actionableImprovements.map((a, i) => `  ${i + 1}. ${a}`),
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Core Loop Functions
// ---------------------------------------------------------------------------

/**
 * Start a new feedback loop.
 *
 * Requires injected IJudge and IReportGenerator — no hardcoded dependencies.
 */
export async function startLoop(params: {
  keyword: string;
  subQueries?: string[];
  sources?: HandoffSource[];
  maxRounds?: number;
  contractOverrides?: Partial<SprintContract['globalThresholds']>;
  judge: IJudge;
  generator: IReportGenerator;
}): Promise<LoopNextResult> {
  const {
    keyword,
    subQueries = [],
    sources = [],
    maxRounds = 10,
    contractOverrides,
    judge,
    generator,
  } = params;

  const contract = proposeContract(keyword);
  if (contractOverrides) {
    Object.assign(contract.globalThresholds, contractOverrides);
  }
  contract.globalThresholds.maxRounds = maxRounds;
  activateContract(contract);
  await saveContract(contract);

  const { report, metrics } = await generator.generate({
    keyword,
    subQueries,
    sources,
  });

  const handoff = createHandoffDocument({
    keyword,
    subQueries,
    report,
    mindmap: null,
    sources,
    metrics,
  });
  await saveHandoff(handoff);

  const judgeResult = await judge.evaluate(handoff, contract.dimensions);
  const dimensionScores = judgeResult.scores;
  const feedback = formatJudgeResult(judgeResult);

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
 * Requires injected IJudge and IReportGenerator.
 */
export async function loopNext(
  loopId: string,
  judge: IJudge,
  generator: IReportGenerator,
  userFeedback?: string,
): Promise<LoopNextResult> {
  const loop = await loadLoop(loopId);

  if (loop.status !== 'active') {
    throw new Error(`Loop ${loopId} is not active (status: ${loop.status})`);
  }

  const contract = await loadContract(loop.contractId);
  const previousRound = loop.rounds[loop.rounds.length - 1];
  const previousHandoff = await loadHandoff(previousRound.handoffId);

  const { report, metrics } = await generator.generate({
    keyword: loop.keyword,
    subQueries: previousHandoff.input.subQueries,
    sources: previousHandoff.output.sources,
    previousFeedback: previousRound.feedback,
    userFeedback,
  });

  const newHandoff = await createIterationHandoff(
    previousRound.handoffId,
    { report, mindmap: null, sources: previousHandoff.output.sources },
    metrics,
    userFeedback,
  );

  const judgeResult = await judge.evaluate(newHandoff, contract.dimensions);
  const dimensionScores = judgeResult.scores;
  const feedback = formatJudgeResult(judgeResult);

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
 * Manually approve the current best version.
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
 * Human-readable loop progress summary.
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
