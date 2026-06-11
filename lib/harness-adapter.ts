/**
 * Harness Adapter — bridges generic harness framework with application specifics
 *
 * This adapter lives in lib/ (L3), allowing app/ (L2) to use the harness
 * without directly importing from agents/ (L1) or harness/ (L0).
 *
 * Import hierarchy:
 *   app/api/evaluate/route.ts → lib/harness-adapter.ts → harness/ + agents/
 *
 * This file is the ONLY place where harness and agents are wired together.
 */

import { z } from 'zod';
import { proModel, flashModel } from '@/lib/gemini';
import { safeGenerateText, safeGenerateObject } from '@/lib/gemini-client';
import { semanticSearch } from '@/lib/exa';
import { hybridSearch } from '@/lib/elasticsearch';
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
import { BackendJudge, BACKEND_DIMENSIONS } from '@/agents/evaluator/backend-judge';
import { extractReportMetrics } from '@/harness/handoff';

// ---------------------------------------------------------------------------
// IJudge implementations
// ---------------------------------------------------------------------------

export type JudgeMode = 'llm' | 'backend' | 'composite';

class LLMJudge implements IJudge {
  async evaluate(handoff: HandoffDocument, dimensions: ScoreDimension[]): Promise<JudgeResult> {
    const result = await runLLMJudge(handoff, dimensions);
    return {
      scores: judgeToDimensionScores(result),
      feedback: result.feedback,
    };
  }
}

/**
 * Composite judge: runs both LLM-Judge (content quality) and Backend data checks
 * (infrastructure quality from handoff data), then merges scores.
 */
class CompositeJudge implements IJudge {
  private llmJudge = new LLMJudge();
  private backendJudge = new BackendJudge();

  async evaluate(handoff: HandoffDocument, dimensions: ScoreDimension[]): Promise<JudgeResult> {
    const [llmResult, backendResult] = await Promise.all([
      this.llmJudge.evaluate(handoff, dimensions),
      this.backendJudge.evaluate(handoff, BACKEND_DIMENSIONS),
    ]);

    const mergedScores: Record<string, number> = {};

    for (const [k, v] of Object.entries(llmResult.scores)) {
      mergedScores[`content_${k}`] = v;
    }
    for (const [k, v] of Object.entries(backendResult.scores)) {
      mergedScores[`backend_${k}`] = v;
    }

    return {
      scores: mergedScores,
      feedback: {
        strengths: [
          ...llmResult.feedback.strengths.slice(0, 2).map((s) => `[内容] ${s}`),
          ...backendResult.feedback.strengths.slice(0, 2).map((s) => `[后端] ${s}`),
        ],
        weaknesses: [
          ...llmResult.feedback.weaknesses.slice(0, 2).map((w) => `[内容] ${w}`),
          ...backendResult.feedback.weaknesses.slice(0, 2).map((w) => `[后端] ${w}`),
        ],
        actionableImprovements: [
          ...llmResult.feedback.actionableImprovements.slice(0, 2).map((a) => `[内容] ${a}`),
          ...backendResult.feedback.actionableImprovements.slice(0, 2).map((a) => `[后端] ${a}`),
        ],
        overallAssessment: `Content: ${llmResult.feedback.overallAssessment} | Backend: ${backendResult.feedback.overallAssessment}`,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// IReportGenerator — real Gemini Pro generation
// ---------------------------------------------------------------------------

const REPORT_SYSTEM_PROMPT = `你是一个世界顶尖的行业分析专家。基于用户的研究关键词和提供的互联网实时抓取数据，
输出一份结构严谨的 Markdown 研究报告。要求：
1. 完全基于事实，不得捏造
2. 使用清晰的 ## 标题结构（背景概述、关键发现、技术分析、趋势展望、结论）
3. 每个观点标明来源编号 [#n]
4. 中文为主，技术术语保留英文
5. 总字数控制在 1500-3000 字`;

class ReportGenerator implements IReportGenerator {
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

    const { text } = await safeGenerateText({
      model: proModel,
      system: REPORT_SYSTEM_PROMPT,
      prompt,
    }, { timeoutMs: 180_000, label: 'harness-report' });

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
// Search Integration — Exa + Elasticsearch
// ---------------------------------------------------------------------------

/**
 * Generate sub-queries for a keyword using Gemini Flash.
 * Mirrors the production /api/plan route logic.
 */
export async function planSubQueries(keyword: string): Promise<string[]> {
  const result = await safeGenerateObject({
    model: flashModel,
    schema: z.object({
      subQueries: z.array(z.string()).min(3).max(5),
    }),
    system: `你是一个专业的查询规划器。将用户的研究关键词拆解为 3~5 个独立角度的子查询句。
每个子查询应该：
- 针对语义搜索引擎优化（完整句子而非关键字）
- 覆盖不同维度（背景、技术、应用、趋势、挑战等）
- 使用中英文混合（技术术语用英文）`,
    prompt: `研究关键词: "${keyword}"`,
    providerOptions: {
      vertex: { thinkingConfig: { thinkingBudget: 0 } },
    },
  });
  return (result.object as { subQueries: string[] }).subQueries;
}

/**
 * Fetch real sources from Exa (neural) + Elasticsearch (hybrid).
 * Maps Source (text) → HandoffSource (snippet) for the harness.
 */
export async function fetchSources(
  keyword: string,
  subQueries: string[],
): Promise<HandoffSource[]> {
  const [exaSources, esSources] = await Promise.all([
    semanticSearch(subQueries).catch((err) => {
      console.error('[harness-adapter] Exa search failed:', err?.message);
      return [];
    }),
    hybridSearch(keyword).catch((err) => {
      console.error('[harness-adapter] ES search failed:', err?.message);
      return [];
    }),
  ]);

  const seen = new Set<string>();
  const sources: HandoffSource[] = [];

  for (const s of [...exaSources, ...esSources]) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push({
      title: s.title,
      url: s.url,
      snippet: s.text.substring(0, 3000),
    });
  }

  return sources;
}

// ---------------------------------------------------------------------------
// Singleton instances
// ---------------------------------------------------------------------------

const llmJudge = new LLMJudge();
const backendJudge = new BackendJudge();
const compositeJudge = new CompositeJudge();
const generator = new ReportGenerator();

function getJudge(mode: JudgeMode = 'llm'): IJudge {
  switch (mode) {
    case 'backend': return backendJudge;
    case 'composite': return compositeJudge;
    default: return llmJudge;
  }
}

// ---------------------------------------------------------------------------
// Adapted API — app/ calls these, never agents/ or harness/ directly
// ---------------------------------------------------------------------------

export { initializeEvaluator, loadConfig, isInitialized } from '@/agents/evaluator';
export { recycle, evaluateExisting, getRecycleStats } from '@/agents/recycle';
export { loadLoop, listLoops, loopSummary } from '@/harness';

/**
 * Start a feedback loop. If sources/subQueries are not provided,
 * auto-fetches them via Plan (Gemini Flash) + Fetch (Exa + ES).
 */
export async function startLoop(params: {
  keyword: string;
  subQueries?: string[];
  sources?: HandoffSource[];
  maxRounds?: number;
  contractOverrides?: Partial<SprintContract['globalThresholds']>;
  skipSearch?: boolean;
  judgeMode?: JudgeMode;
}): Promise<LoopNextResult> {
  let { subQueries, sources } = params;
  const judge = getJudge(params.judgeMode);

  if (!params.skipSearch) {
    if (!subQueries || subQueries.length === 0) {
      subQueries = await planSubQueries(params.keyword);
    }

    if (!sources || sources.length === 0) {
      sources = await fetchSources(params.keyword, subQueries);
    }
  }

  const customDimensions = params.judgeMode === 'backend' ? BACKEND_DIMENSIONS : undefined;

  return harnessStartLoop({
    keyword: params.keyword,
    subQueries,
    sources,
    maxRounds: params.maxRounds,
    contractOverrides: params.contractOverrides,
    customDimensions,
    judge,
    generator,
  });
}

export async function loopNext(loopId: string, userFeedback?: string, judgeMode?: JudgeMode): Promise<LoopNextResult> {
  return harnessLoopNext(loopId, getJudge(judgeMode), generator, userFeedback);
}

export async function loopApprove(loopId: string): Promise<LoopState> {
  return harnessLoopApprove(loopId);
}

export async function loopCancel(loopId: string, reason?: string): Promise<LoopState> {
  return harnessLoopCancel(loopId, reason);
}
