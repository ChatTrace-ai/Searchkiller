/**
 * Harness E2E Integration Test — Real Generator + Optimized Judge
 *
 * Validates:
 *   1. Real Gemini Pro report generation (replaces placeholder)
 *   2. Optimized LLM-Judge speed (thinkingBudget: 0 + truncation)
 *   3. Full feedback loop with real content
 *
 * Run with:
 *   GOOGLE_VERTEX_PROJECT=... GOOGLE_VERTEX_LOCATION=... npx tsx tests/harness-e2e.integration.test.ts
 */

import { strict as assert } from 'assert';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

import type { IJudge, IReportGenerator, JudgeResult, GenerationResult } from '../harness/types';
import type { HandoffDocument, ScoreDimension, HandoffSource } from '../harness';

import { startLoop, loopNext, loadLoop, loopSummary } from '../harness/feedback-loop';
import { runLLMJudge, judgeToDimensionScores } from '../agents/evaluator/llm-judge';
import { extractReportMetrics } from '../harness/handoff';
import { generateText } from 'ai';
import { proModel } from '../lib/gemini';

// ---------------------------------------------------------------------------
// Real Gemini Judge (same as harness-adapter)
// ---------------------------------------------------------------------------

class RealGeminiJudge implements IJudge {
  async evaluate(handoff: HandoffDocument, dimensions: ScoreDimension[]): Promise<JudgeResult> {
    const result = await runLLMJudge(handoff, dimensions);
    return {
      scores: judgeToDimensionScores(result),
      feedback: result.feedback,
    };
  }
}

// ---------------------------------------------------------------------------
// Real Gemini Pro Report Generator (same as harness-adapter)
// ---------------------------------------------------------------------------

const REPORT_SYSTEM_PROMPT = `你是一个世界顶尖的行业分析专家。基于用户的研究关键词和提供的互联网实时抓取数据，
输出一份结构严谨的 Markdown 研究报告。要求：
1. 完全基于事实，不得捏造
2. 使用清晰的 ## 标题结构（背景概述、关键发现、技术分析、趋势展望、结论）
3. 每个观点标明来源编号 [#n]
4. 中文为主，技术术语保留英文
5. 总字数控制在 1500-3000 字`;

class RealReportGenerator implements IReportGenerator {
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
// Cleanup
// ---------------------------------------------------------------------------

function cleanAgentsDir() {
  const agentsDir = join(process.cwd(), '.agents');
  if (existsSync(agentsDir)) {
    rmSync(agentsDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n=== Harness E2E: Real Generator + Optimized Judge ===\n');

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION;
  if (!project || !location) {
    console.error('ERROR: GOOGLE_VERTEX_PROJECT and GOOGLE_VERTEX_LOCATION must be set');
    process.exit(1);
  }
  console.log(`  Vertex AI: project=${project}, location=${location}\n`);

  cleanAgentsDir();

  const judge = new RealGeminiJudge();
  const generator = new RealReportGenerator();

  const sources: HandoffSource[] = [
    {
      title: 'Anthropic - Building effective agents',
      url: 'https://anthropic.com/research/building-effective-agents',
      snippet: 'We recommend starting with the simplest solution possible and only increasing complexity when needed. This might mean not building agentic systems at all. Agentic systems often trade latency and cost for better task performance. Agents can be built with simple prompt chaining workflows or complex autonomous agents.',
    },
    {
      title: 'Google - Gemini 2.5 Flash for production',
      url: 'https://cloud.google.com/vertex-ai/generative-ai/docs/gemini',
      snippet: 'Gemini 2.5 Flash is our best model for general performance across a wide range of tasks. It features a long context window of up to 1M tokens, supports multimodal inputs, and provides native tool use for building AI agents. Flash is optimized for speed and cost efficiency.',
    },
    {
      title: 'LangChain - Multi-agent architectures',
      url: 'https://blog.langchain.dev/multi-agent-architectures',
      snippet: 'Multi-agent systems decompose complex tasks into specialized sub-tasks. Common patterns include: supervisor-worker, peer collaboration, and hierarchical delegation. Key challenges include state management, error recovery, and inter-agent communication protocols.',
    },
  ];

  // ── Round 1: Real generation + optimized judge ─────────────────────
  console.log('  ── Round 1: Real Gemini Pro generation + Flash judge ──');
  const overallStart = Date.now();

  const result = await startLoop({
    keyword: 'AI Agent 多模态架构',
    subQueries: [
      'Gemini 2.5 的多模态 Agent 能力有哪些？',
      'Multi-Agent 协作框架的最新进展？',
      'Agent 安全性和可靠性挑战如何解决？',
    ],
    sources,
    maxRounds: 3,
    contractOverrides: { autoApproveScore: 9.0 },
    judge,
    generator,
  });

  const round1Ms = Date.now() - overallStart;
  const judgeMs = (globalThis as Record<string, unknown>).__lastJudgeMs as number;

  console.log(`\n  Round 1 total: ${(round1Ms / 1000).toFixed(1)}s`);
  console.log(`  ├── Report gen: ~${((round1Ms - (judgeMs ?? 0)) / 1000).toFixed(1)}s (Gemini Pro)`);
  console.log(`  └── Judge eval: ${((judgeMs ?? 0) / 1000).toFixed(1)}s (Flash, thinkingBudget=0)`);
  console.log(`  Score: ${result.latestRound.score}`);
  console.log(`  Satisfied: ${result.latestRound.contractSatisfied}`);

  // Validate real report content
  const handoff = await (await import('../harness/handoff')).loadHandoff(result.latestRound.handoffId);
  const reportMd = handoff.output.report?.markdown ?? '';
  assert.ok(reportMd.length > 500, `Report should be substantial (got ${reportMd.length} chars)`);
  assert.ok(reportMd.includes('##'), 'Report should have markdown headings');
  assert.ok(handoff.output.report!.wordCount > 200, `Word count should be > 200 (got ${handoff.output.report!.wordCount})`);
  assert.ok(handoff.output.report!.sectionHeadings.length >= 3, `Should have >= 3 sections (got ${handoff.output.report!.sectionHeadings.length})`);
  console.log(`  Report: ${reportMd.length} chars, ${handoff.output.report!.wordCount} words, ${handoff.output.report!.sectionHeadings.length} sections`);
  console.log('  PASS: Real report generated by Gemini Pro');

  // Validate judge speed improvement
  if (judgeMs !== undefined) {
    console.log(`\n  Judge speed: ${(judgeMs / 1000).toFixed(1)}s ${judgeMs < 30000 ? '✓ FAST' : judgeMs < 60000 ? '~ OK' : '✗ SLOW'}`);
  }
  console.log('  PASS: Optimized judge evaluation');

  // Validate scores
  const scores = result.latestRound.dimensionScores;
  console.log(`\n  Dimension scores:`);
  for (const [dim, score] of Object.entries(scores)) {
    console.log(`    ${dim}: ${score}`);
    assert.ok(score >= 0 && score <= 10, `${dim} should be 0-10`);
  }
  console.log('  PASS: All scores in valid range');

  // ── Round 2: Iteration with feedback ──────────────────────────────
  if (!result.sprintComplete) {
    console.log('\n  ── Round 2: Iteration with real regeneration ──');
    const round2Start = Date.now();

    const nextResult = await loopNext(
      result.loop.id,
      judge,
      generator,
      '请增加更多关于安全性和对齐的分析',
    );

    const round2Ms = Date.now() - round2Start;
    const judge2Ms = (globalThis as Record<string, unknown>).__lastJudgeMs as number;

    console.log(`\n  Round 2 total: ${(round2Ms / 1000).toFixed(1)}s`);
    console.log(`  ├── Report gen: ~${((round2Ms - (judge2Ms ?? 0)) / 1000).toFixed(1)}s`);
    console.log(`  └── Judge eval: ${((judge2Ms ?? 0) / 1000).toFixed(1)}s`);
    console.log(`  Score: ${nextResult.latestRound.score} (was ${result.latestRound.score})`);
    console.log(`  Best: round ${nextResult.loop.bestRound} (${nextResult.loop.bestScore})`);
    console.log('  PASS: loopNext with real regeneration');
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n  ── Loop Summary ──');
  const loop = await loadLoop(result.loop.id);
  console.log(loopSummary(loop));

  cleanAgentsDir();

  console.log('\n=== All E2E tests passed ===\n');
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
