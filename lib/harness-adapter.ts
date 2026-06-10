/**
 * Harness Adapter — bridges generic harness framework with Searchkiller specifics
 *
 * This adapter lives in lib/ (L3), allowing app/ (L2) to use the harness
 * without directly importing from agents/ (L1) or harness/ (L0).
 *
 * Import hierarchy:
 *   app/api/evaluate/route.ts → lib/harness-adapter.ts → harness/ + agents/
 *
 * This file is the ONLY place where harness and agents are wired together.
 */

import type { IJudge, IReportGenerator, JudgeResult, GenerationResult } from '@/harness/types';
import type { HandoffDocument, ScoreDimension, HandoffSource } from '@/harness';

import {
  startLoop as harnessStartLoop,
  loopNext as harnessLoopNext,
  loopApprove as harnessLoopApprove,
  loopCancel as harnessLoopCancel,
  loadLoop,
  listLoops,
  loopSummary,
  type LoopNextResult,
  type LoopState,
  type SprintContract,
} from '@/harness';

import { initializeEvaluator, loadConfig, isInitialized } from '@/agents/evaluator';
import { recycle, evaluateExisting, getRecycleStats } from '@/agents/recycle';

import { runLLMJudge, judgeToDimensionScores, formatJudgeFeedback } from '@/agents/evaluator/llm-judge';
import { extractReportMetrics } from '@/harness/handoff';

// ---------------------------------------------------------------------------
// Searchkiller IJudge implementation
// ---------------------------------------------------------------------------

class SearchkillerJudge implements IJudge {
  async evaluate(handoff: HandoffDocument, dimensions: ScoreDimension[]): Promise<JudgeResult> {
    const result = await runLLMJudge(handoff, dimensions);
    return {
      scores: judgeToDimensionScores(result),
      feedback: result.feedback,
    };
  }
}

// ---------------------------------------------------------------------------
// Searchkiller IReportGenerator implementation (placeholder)
// ---------------------------------------------------------------------------

class SearchkillerReportGenerator implements IReportGenerator {
  async generate(input: {
    keyword: string;
    subQueries: string[];
    sources: Array<{ title: string; url: string; snippet: string }>;
    previousFeedback?: string;
    userFeedback?: string;
  }): Promise<GenerationResult> {
    const markdown = `## 关于"${input.keyword}"的研究报告

> 此为反馈循环引擎生成的占位报告。

### 背景概述
基于 ${input.sources.length} 个来源的分析。

### 关键发现
${input.subQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

### 结论
待生成。

${input.previousFeedback ? `\n### 基于评估反馈的改进\n${input.previousFeedback}` : ''}
${input.userFeedback ? `\n### 基于用户反馈的改进\n${input.userFeedback}` : ''}`;

    const reportMetrics = extractReportMetrics(markdown);

    return {
      report: { markdown, ...reportMetrics },
      metrics: {
        planDurationMs: 0,
        fetchDurationMs: 0,
        reportDurationMs: 0,
        mindmapDurationMs: 0,
        totalDurationMs: 0,
        sourceCount: input.sources.length,
        modelUsed: 'placeholder',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton instances
// ---------------------------------------------------------------------------

const judge = new SearchkillerJudge();
const generator = new SearchkillerReportGenerator();

// ---------------------------------------------------------------------------
// Adapted API — app/ calls these, never agents/ or harness/ directly
// ---------------------------------------------------------------------------

export { initializeEvaluator, loadConfig, isInitialized } from '@/agents/evaluator';
export { recycle, evaluateExisting, getRecycleStats } from '@/agents/recycle';
export { loadLoop, listLoops, loopSummary } from '@/harness';

export async function startLoop(params: {
  keyword: string;
  subQueries?: string[];
  sources?: HandoffSource[];
  maxRounds?: number;
  contractOverrides?: Partial<SprintContract['globalThresholds']>;
}): Promise<LoopNextResult> {
  return harnessStartLoop({ ...params, judge, generator });
}

export async function loopNext(loopId: string, userFeedback?: string): Promise<LoopNextResult> {
  return harnessLoopNext(loopId, judge, generator, userFeedback);
}

export async function loopApprove(loopId: string): Promise<LoopState> {
  return harnessLoopApprove(loopId);
}

export async function loopCancel(loopId: string, reason?: string): Promise<LoopState> {
  return harnessLoopCancel(loopId, reason);
}
