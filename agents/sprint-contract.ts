/**
 * Sprint Contract — Negotiated Acceptance Criteria
 *
 * Implements the Anthropic "sprint contract" pattern:
 * Before the feedback loop starts, the Planner+Generator and Evaluator
 * agree on explicit, measurable acceptance criteria.
 *
 * Flow:
 *   1. User initiates a sprint with keyword + optional preferences
 *   2. System proposes a default contract based on keyword analysis
 *   3. User reviews/adjusts criteria (HITL negotiation)
 *   4. Contract is persisted and governs all iteration rounds
 *   5. Each evaluation round checks against the contract
 *   6. Sprint ends when contract is satisfied or maxRounds reached
 *
 * File store: .agents/contracts/{sprintId}.json
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export type ContractStatus = 'draft' | 'negotiating' | 'active' | 'completed' | 'expired' | 'cancelled';

export interface ScoreDimension {
  name: string;
  description: string;
  weight: number;
  hardThreshold: number;
  targetScore: number;
}

export interface SprintContract {
  id: string;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  completedAt?: string;

  keyword: string;
  sprintGoal: string;

  dimensions: ScoreDimension[];

  globalThresholds: {
    minWeightedScore: number;
    maxRounds: number;
    autoApproveScore: number;
    timeoutMinutes: number;
  };

  negotiationHistory: NegotiationEntry[];

  currentRound: number;
  roundResults: RoundResult[];
}

export interface NegotiationEntry {
  timestamp: string;
  actor: 'system' | 'user';
  action: 'propose' | 'adjust' | 'accept' | 'reject';
  changes: string;
}

export interface RoundResult {
  round: number;
  timestamp: string;
  handoffId: string;
  dimensionScores: Record<string, number>;
  weightedScore: number;
  hardThresholdsPassed: boolean;
  contractSatisfied: boolean;
  evaluatorFeedback: string;
}

// ---------------------------------------------------------------------------
// Default Contract Templates
// ---------------------------------------------------------------------------

const DEFAULT_DIMENSIONS: ScoreDimension[] = [
  {
    name: 'factual_accuracy',
    description: '事实准确性：报告中的信息是否与源数据一致，无捏造内容',
    weight: 0.30,
    hardThreshold: 5.0,
    targetScore: 7.5,
  },
  {
    name: 'structural_completeness',
    description: '结构完整性：是否包含所有必要章节（背景、发现、分析、展望、结论），逻辑连贯',
    weight: 0.25,
    hardThreshold: 5.0,
    targetScore: 7.0,
  },
  {
    name: 'analysis_depth',
    description: '分析深度：是否超越表面描述，提供有洞察力的分析和趋势判断',
    weight: 0.25,
    hardThreshold: 4.0,
    targetScore: 7.0,
  },
  {
    name: 'citation_quality',
    description: '引用质量：引用是否充分、准确、来源可靠',
    weight: 0.20,
    hardThreshold: 4.0,
    targetScore: 6.5,
  },
];

const DEFAULT_GLOBAL_THRESHOLDS = {
  minWeightedScore: 7.0,
  maxRounds: 10,
  autoApproveScore: 8.5,
  timeoutMinutes: 30,
};

// ---------------------------------------------------------------------------
// Contract Store
// ---------------------------------------------------------------------------

const AGENTS_DIR = join(process.cwd(), '.agents');
const CONTRACTS_DIR = join(AGENTS_DIR, 'contracts');

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function generateSprintId(): string {
  return `sprint-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Contract Lifecycle
// ---------------------------------------------------------------------------

/**
 * Propose a default sprint contract for a given keyword.
 * Returns a draft that the user can negotiate before activation.
 */
export function proposeContract(keyword: string, customGoal?: string): SprintContract {
  const now = new Date().toISOString();
  return {
    id: generateSprintId(),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    keyword,
    sprintGoal: customGoal ?? `生成一份关于"${keyword}"的高质量深度研究报告`,
    dimensions: [...DEFAULT_DIMENSIONS],
    globalThresholds: { ...DEFAULT_GLOBAL_THRESHOLDS },
    negotiationHistory: [{
      timestamp: now,
      actor: 'system',
      action: 'propose',
      changes: 'Proposed default contract with 4 dimensions: factual_accuracy (30%), structural_completeness (25%), analysis_depth (25%), citation_quality (20%)',
    }],
    currentRound: 0,
    roundResults: [],
  };
}

/**
 * Adjust contract dimensions or thresholds (user negotiation).
 */
export function adjustContract(
  contract: SprintContract,
  adjustments: {
    dimensions?: Partial<ScoreDimension>[];
    globalThresholds?: Partial<SprintContract['globalThresholds']>;
    sprintGoal?: string;
  },
  changeDescription: string,
): SprintContract {
  const now = new Date().toISOString();

  if (adjustments.dimensions) {
    for (const adj of adjustments.dimensions) {
      const dim = contract.dimensions.find((d) => d.name === adj.name);
      if (dim) {
        Object.assign(dim, adj);
      }
    }
    const totalWeight = contract.dimensions.reduce((s, d) => s + d.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      const factor = 1.0 / totalWeight;
      for (const d of contract.dimensions) {
        d.weight = Math.round(d.weight * factor * 100) / 100;
      }
    }
  }

  if (adjustments.globalThresholds) {
    Object.assign(contract.globalThresholds, adjustments.globalThresholds);
  }

  if (adjustments.sprintGoal) {
    contract.sprintGoal = adjustments.sprintGoal;
  }

  contract.status = 'negotiating';
  contract.updatedAt = now;
  contract.negotiationHistory.push({
    timestamp: now,
    actor: 'user',
    action: 'adjust',
    changes: changeDescription,
  });

  return contract;
}

/**
 * Activate a contract — lock in the acceptance criteria and begin the sprint.
 */
export function activateContract(contract: SprintContract): SprintContract {
  const now = new Date().toISOString();
  contract.status = 'active';
  contract.activatedAt = now;
  contract.updatedAt = now;
  contract.negotiationHistory.push({
    timestamp: now,
    actor: 'user',
    action: 'accept',
    changes: 'Contract accepted and activated',
  });
  return contract;
}

/**
 * Save contract to file store.
 */
export async function saveContract(contract: SprintContract): Promise<string> {
  await ensureDir(CONTRACTS_DIR);
  contract.updatedAt = new Date().toISOString();
  const filepath = join(CONTRACTS_DIR, `${contract.id}.json`);
  await writeFile(filepath, JSON.stringify(contract, null, 2), 'utf-8');
  return contract.id;
}

/**
 * Load a contract by ID.
 */
export async function loadContract(sprintId: string): Promise<SprintContract> {
  const filepath = join(CONTRACTS_DIR, `${sprintId}.json`);
  if (!existsSync(filepath)) {
    throw new Error(`Sprint contract not found: ${sprintId}`);
  }
  const raw = await readFile(filepath, 'utf-8');
  return JSON.parse(raw) as SprintContract;
}

/**
 * List all contract IDs.
 */
export async function listContracts(): Promise<string[]> {
  await ensureDir(CONTRACTS_DIR);
  const files = await readdir(CONTRACTS_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

// ---------------------------------------------------------------------------
// Contract Evaluation — check round results against acceptance criteria
// ---------------------------------------------------------------------------

/**
 * Calculate the weighted score from dimension scores.
 */
export function calculateWeightedScore(
  dimensions: ScoreDimension[],
  scores: Record<string, number>,
): number {
  let weighted = 0;
  for (const dim of dimensions) {
    const score = scores[dim.name] ?? 0;
    weighted += score * dim.weight;
  }
  return Math.round(weighted * 100) / 100;
}

/**
 * Check if all hard thresholds are met.
 */
export function checkHardThresholds(
  dimensions: ScoreDimension[],
  scores: Record<string, number>,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const dim of dimensions) {
    const score = scores[dim.name] ?? 0;
    if (score < dim.hardThreshold) {
      failures.push(`${dim.name}: ${score} < ${dim.hardThreshold} (hard threshold)`);
    }
  }
  return { passed: failures.length === 0, failures };
}

/**
 * Record a round result and check contract satisfaction.
 */
export function recordRoundResult(
  contract: SprintContract,
  handoffId: string,
  dimensionScores: Record<string, number>,
  evaluatorFeedback: string,
): { contract: SprintContract; result: RoundResult; sprintComplete: boolean; reason?: string } {
  const weightedScore = calculateWeightedScore(contract.dimensions, dimensionScores);
  const thresholdCheck = checkHardThresholds(contract.dimensions, dimensionScores);

  const contractSatisfied =
    thresholdCheck.passed &&
    weightedScore >= contract.globalThresholds.minWeightedScore;

  contract.currentRound++;

  const result: RoundResult = {
    round: contract.currentRound,
    timestamp: new Date().toISOString(),
    handoffId,
    dimensionScores,
    weightedScore,
    hardThresholdsPassed: thresholdCheck.passed,
    contractSatisfied,
    evaluatorFeedback,
  };

  contract.roundResults.push(result);
  contract.updatedAt = result.timestamp;

  let sprintComplete = false;
  let reason: string | undefined;

  if (weightedScore >= contract.globalThresholds.autoApproveScore && thresholdCheck.passed) {
    sprintComplete = true;
    reason = `Auto-approved: weighted score ${weightedScore} >= ${contract.globalThresholds.autoApproveScore}`;
    contract.status = 'completed';
    contract.completedAt = result.timestamp;
  } else if (contract.currentRound >= contract.globalThresholds.maxRounds) {
    sprintComplete = true;
    reason = `Max rounds reached (${contract.globalThresholds.maxRounds}). Best score: ${weightedScore}`;
    contract.status = 'expired';
    contract.completedAt = result.timestamp;
  }

  return { contract, result, sprintComplete, reason };
}

/**
 * Get the best round result from a contract's history.
 */
export function getBestRound(contract: SprintContract): RoundResult | null {
  if (contract.roundResults.length === 0) return null;
  return contract.roundResults.reduce((best, r) =>
    r.weightedScore > best.weightedScore ? r : best,
  );
}

/**
 * Generate a human-readable summary of the contract's current state.
 */
export function contractSummary(contract: SprintContract): string {
  const lines: string[] = [
    `Sprint: ${contract.id}`,
    `Status: ${contract.status}`,
    `Goal: ${contract.sprintGoal}`,
    `Round: ${contract.currentRound} / ${contract.globalThresholds.maxRounds}`,
    '',
    'Dimensions:',
  ];

  for (const dim of contract.dimensions) {
    const latest = contract.roundResults.length > 0
      ? contract.roundResults[contract.roundResults.length - 1].dimensionScores[dim.name]
      : undefined;
    const scoreStr = latest !== undefined ? `current=${latest}` : 'pending';
    lines.push(`  ${dim.name} (w=${dim.weight}, min=${dim.hardThreshold}, target=${dim.targetScore}): ${scoreStr}`);
  }

  lines.push('');
  lines.push(`Min weighted score: ${contract.globalThresholds.minWeightedScore}`);
  lines.push(`Auto-approve at: ${contract.globalThresholds.autoApproveScore}`);

  const best = getBestRound(contract);
  if (best) {
    lines.push(`Best round: #${best.round} (score=${best.weightedScore})`);
  }

  return lines.join('\n');
}
