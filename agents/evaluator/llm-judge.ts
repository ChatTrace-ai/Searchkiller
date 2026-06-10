/**
 * LLM-as-Judge — Gemini-powered quality evaluation
 *
 * Uses Gemini Flash to score research reports on 4 dimensions,
 * providing structured scores and actionable feedback.
 *
 * Dimensions (aligned with SprintContract defaults):
 *   1. factual_accuracy (30%) — facts consistent with sources, no fabrication
 *   2. structural_completeness (25%) — all required sections, logical flow
 *   3. analysis_depth (25%) — beyond surface description, insightful analysis
 *   4. citation_quality (20%) — sufficient, accurate, reliable citations
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { flashModel } from '@/lib/gemini';
import type { ScoreDimension } from '../sprint-contract';
import type { HandoffDocument } from '../handoff';

// ---------------------------------------------------------------------------
// Schema for structured evaluation output
// ---------------------------------------------------------------------------

const evaluationOutputSchema = z.object({
  scores: z.object({
    factual_accuracy: z.number().min(0).max(10).describe('事实准确性评分 (0-10)'),
    structural_completeness: z.number().min(0).max(10).describe('结构完整性评分 (0-10)'),
    analysis_depth: z.number().min(0).max(10).describe('分析深度评分 (0-10)'),
    citation_quality: z.number().min(0).max(10).describe('引用质量评分 (0-10)'),
  }),
  feedback: z.object({
    strengths: z.array(z.string()).describe('报告的优点 (2-3 条)'),
    weaknesses: z.array(z.string()).describe('报告的不足 (2-3 条)'),
    actionableImprovements: z.array(z.string()).describe('具体可执行的改进建议 (2-4 条)'),
    overallAssessment: z.string().describe('一句话总体评价'),
  }),
});

export type LLMJudgeResult = z.infer<typeof evaluationOutputSchema>;

// ---------------------------------------------------------------------------
// Judge Prompt Construction
// ---------------------------------------------------------------------------

function buildJudgePrompt(handoff: HandoffDocument, dimensions: ScoreDimension[]): string {
  const reportText = handoff.output.report?.markdown ?? '(No report generated)';
  const sourcesSummary = handoff.output.sources
    .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`)
    .join('\n');

  const dimensionGuide = dimensions
    .map((d) => `- **${d.name}** (权重 ${(d.weight * 100).toFixed(0)}%, 硬阈值 ${d.hardThreshold}, 目标 ${d.targetScore}): ${d.description}`)
    .join('\n');

  return `你是一位严格的研究报告质量评审专家。请对以下研究报告进行多维度评分。

## 研究主题
${handoff.input.keyword}

## 子查询
${handoff.input.subQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## 报告全文
${reportText}

## 参考来源
${sourcesSummary || '(无来源数据)'}

## 评分维度
${dimensionGuide}

## 评分规则
1. 每个维度独立评分，范围 0-10（可使用小数，如 7.5）
2. 评分必须基于实际内容，不能"全给高分"或"全给低分"
3. 如果报告为空或无实质内容，所有维度应评为 0-2 分
4. 反馈必须具体、可执行，不能是泛泛的"需要改进"
5. 改进建议必须明确到"在哪个章节做什么修改"的粒度

${handoff.input.userFeedback ? `## 用户额外反馈\n${handoff.input.userFeedback}` : ''}`;
}

// ---------------------------------------------------------------------------
// Main Judge Function
// ---------------------------------------------------------------------------

/**
 * Run LLM-as-Judge evaluation on a HandoffDocument.
 *
 * Uses Gemini Flash for cost efficiency. Returns structured scores
 * and actionable feedback for each quality dimension.
 */
export async function runLLMJudge(
  handoff: HandoffDocument,
  dimensions: ScoreDimension[],
): Promise<LLMJudgeResult> {
  const prompt = buildJudgePrompt(handoff, dimensions);

  const { object } = await generateObject({
    model: flashModel,
    schema: evaluationOutputSchema,
    system: `You are a research report quality evaluator. Score strictly and provide actionable feedback. Respond with structured JSON matching the schema exactly. All text content should be in Chinese (Simplified).`,
    prompt,
  });

  return object;
}

/**
 * Convert LLM Judge result to dimension scores map (compatible with SprintContract).
 */
export function judgeToDimensionScores(result: LLMJudgeResult): Record<string, number> {
  return {
    factual_accuracy: result.scores.factual_accuracy,
    structural_completeness: result.scores.structural_completeness,
    analysis_depth: result.scores.analysis_depth,
    citation_quality: result.scores.citation_quality,
  };
}

/**
 * Format evaluation result as human-readable feedback string.
 */
export function formatJudgeFeedback(result: LLMJudgeResult): string {
  const lines: string[] = [
    `**总评**: ${result.feedback.overallAssessment}`,
    '',
    `**评分**: 准确性=${result.scores.factual_accuracy} | 完整性=${result.scores.structural_completeness} | 深度=${result.scores.analysis_depth} | 引用=${result.scores.citation_quality}`,
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
