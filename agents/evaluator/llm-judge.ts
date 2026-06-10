/**
 * LLM-as-Judge — Gemini-powered quality evaluation
 *
 * Uses Gemini Flash to score research reports on 4 dimensions,
 * providing structured scores and actionable feedback.
 *
 * Speed optimizations:
 *   - thinkingBudget: 0 disables Flash's reasoning loop (not needed for scoring)
 *   - Report text capped at MAX_REPORT_CHARS to bound token usage
 *   - Compact system prompt reduces overhead
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

const MAX_REPORT_CHARS = 12_000;

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

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n\n…（报告已截断，以上为前 ' + maxLen + ' 字符）';
}

function buildJudgePrompt(handoff: HandoffDocument, dimensions: ScoreDimension[]): string {
  const rawReport = handoff.output.report?.markdown ?? '(No report generated)';
  const reportText = truncate(rawReport, MAX_REPORT_CHARS);
  const sourcesSummary = handoff.output.sources
    .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`)
    .join('\n');

  const dimensionGuide = dimensions
    .map((d) => `- ${d.name} (w=${(d.weight * 100).toFixed(0)}%, min=${d.hardThreshold}, target=${d.targetScore}): ${d.description}`)
    .join('\n');

  return `评审以下研究报告，主题: "${handoff.input.keyword}"

子查询:
${handoff.input.subQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

报告:
${reportText}

来源:
${sourcesSummary || '(无)'}

维度:
${dimensionGuide}

规则: 独立评分0-10(可小数)；空报告评0-2；反馈要具体可执行。${handoff.input.userFeedback ? `\n用户反馈: ${handoff.input.userFeedback}` : ''}`;
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
  const t0 = Date.now();

  const { object } = await generateObject({
    model: flashModel,
    schema: evaluationOutputSchema,
    system: 'Research report quality evaluator. Score strictly, provide actionable feedback in Chinese (Simplified). Output structured JSON.',
    prompt,
    providerOptions: {
      vertex: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
  });

  const elapsed = Date.now() - t0;
  if (typeof globalThis !== 'undefined') {
    (globalThis as Record<string, unknown>).__lastJudgeMs = elapsed;
  }

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
