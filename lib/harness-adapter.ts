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

import { generateText } from 'ai';
import { proModel } from '@/lib/gemini';
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
// Searchkiller IReportGenerator — real Gemini Pro generation
// ---------------------------------------------------------------------------

const REPORT_SYSTEM_PROMPT = `你是一个世界顶尖的行业分析专家。基于用户的研究关键词和提供的互联网实时抓取数据，
输出一份结构严谨的 Markdown 研究报告。要求：
1. 完全基于事实，不得捏造
2. 使用清晰的 ## 标题结构（背景概述、关键发现、技术分析、趋势展望、结论）
3. 每个观点标明来源编号 [#n]
4. 中文为主，技术术语保留英文
5. 总字数控制在 1500-3000 字`;

class SearchkillerReportGenerator implements IReportGenerator {
  async generate(input: {
    keyword: string;
    subQueries: string[];
    sources: Array<{ title: string; url: string; snippet: string }>;
    previousFeedback?: string;
    userFeedback?: string;
  }): Promise<GenerationResult> {
    const t0 = Date.now();

    const formattedContext = input.sources
      .map((s, i) => `[文献源 #${i + 1}]\n标题: ${s.title}\n链接: ${s.url}\n内容:\n${s.snippet}`)
      .join('\n\n');

    let prompt = `研究关键词: "${input.keyword}"\n\n实时抓取数据:\n${formattedContext}`;

    if (input.previousFeedback) {
      prompt += `\n\n## 上一轮评审反馈（请针对性改进）\n${input.previousFeedback}`;
    }
    if (input.userFeedback) {
      prompt += `\n\n## 用户额外要求\n${input.userFeedback}`;
    }

    const { text } = await generateText({
      model: proModel,
      system: REPORT_SYSTEM_PROMPT,
      prompt,
    });

    const reportDurationMs = Date.now() - t0;
    const reportMetrics = extractReportMetrics(text);

    return {
      report: { markdown: text, ...reportMetrics },
      metrics: {
        planDurationMs: 0,
        fetchDurationMs: 0,
        reportDurationMs,
        mindmapDurationMs: 0,
        totalDurationMs: reportDurationMs,
        sourceCount: input.sources.length,
        modelUsed: 'gemini-2.5-pro',
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
