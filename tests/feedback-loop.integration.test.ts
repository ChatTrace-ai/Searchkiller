/**
 * Feedback Loop Engine Integration Test — End-to-End with Real Gemini API
 *
 * Tests the full loop: startLoop → evaluate → loopNext → evaluate → ...
 * Uses real Gemini API (LLM-as-Judge) with placeholder report generator.
 *
 * Run with:
 *   GOOGLE_VERTEX_PROJECT=... GOOGLE_VERTEX_LOCATION=... npx tsx tests/feedback-loop.integration.test.ts
 */

import { strict as assert } from 'assert';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

import type { IJudge, IReportGenerator, JudgeResult, GenerationResult } from '../harness/types';
import type { HandoffDocument, ScoreDimension, HandoffSource } from '../harness';

import { startLoop, loopNext, loopApprove, loadLoop, loopSummary } from '../harness/feedback-loop';
import { runLLMJudge, judgeToDimensionScores } from '../agents/evaluator/llm-judge';
import { extractReportMetrics } from '../harness/handoff';

// ---------------------------------------------------------------------------
// Real Gemini Judge
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
// Simulated Report Generator (evolves based on feedback)
// ---------------------------------------------------------------------------

class EvolvingReportGenerator implements IReportGenerator {
  private round = 0;

  async generate(input: {
    keyword: string;
    subQueries: string[];
    sources: Array<{ title: string; url: string; snippet: string }>;
    previousFeedback?: string;
    userFeedback?: string;
  }): Promise<GenerationResult> {
    this.round++;

    let markdown: string;

    if (this.round === 1) {
      markdown = `# ${input.keyword} 研究报告

## 1. 背景
这是一个关于 ${input.keyword} 的初始报告。基于 ${input.sources.length} 个来源。

## 2. 发现
${input.subQueries.map((q, i) => `${i + 1}. ${q} — 待研究`).join('\n')}

## 3. 结论
初步结论。`;
    } else {
      markdown = `# ${input.keyword} 深度研究报告（第 ${this.round} 版）

## 1. 背景概述
${input.keyword} 是当前技术领域的重要研究方向。本报告基于 ${input.sources.length} 个权威来源的
综合分析，旨在提供深入的技术洞察 [1][2]。

## 2. 关键发现

### 2.1 技术架构
${input.subQueries[0] || '核心架构分析'} — 多层架构设计是主流趋势，
包括基座模型层、框架层和应用层的分层设计 [3]。

### 2.2 应用场景
${input.subQueries[1] || '应用分析'} — 自动化工具调用、代码生成、
多模态交互等场景已进入生产部署阶段 [4]。

### 2.3 挑战与限制
${input.subQueries[2] || '技术挑战'} — 上下文管理、安全对齐、
可靠性保障仍是关键技术瓶颈 [5]。

## 3. 趋势分析
基于现有研究，未来 1-2 年的主要技术趋势包括：
- 多 Agent 协作框架的标准化
- 安全评估体系的完善
- 端到端自动化能力的提升

## 4. 结论
${input.keyword} 领域正在快速发展，技术架构从单一模型
向多 Agent 系统演进，安全和可靠性是核心挑战。

## 参考文献
[1] Source A. "${input.sources[0]?.title || 'Reference 1'}." 2024.
[2] Source B. "${input.sources[1]?.title || 'Reference 2'}." 2024.
[3] Source C. "Architecture patterns." 2024.
[4] Source D. "Application deployments." 2024.
[5] Source E. "Technical challenges." 2024.

${input.previousFeedback ? `\n---\n*基于评审反馈的改进*: 本版本已根据上一轮评审意见进行了针对性修改，增加了引用数量和分析深度。` : ''}
${input.userFeedback ? `\n*用户反馈*: ${input.userFeedback}` : ''}`;
    }

    const reportMetrics = extractReportMetrics(markdown);

    return {
      report: { markdown, ...reportMetrics },
      metrics: {
        planDurationMs: 200,
        fetchDurationMs: 500,
        reportDurationMs: 1000,
        mindmapDurationMs: 0,
        totalDurationMs: 1700,
        sourceCount: input.sources.length,
        modelUsed: `simulated-gen-v${this.round}`,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

function cleanAgentsDir() {
  const agentsDir = join(process.cwd(), '.agents');
  if (existsSync(agentsDir)) {
    rmSync(agentsDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Main test
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n=== Feedback Loop Integration Test (Real Gemini API) ===\n');

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION;
  if (!project || !location) {
    console.error('ERROR: GOOGLE_VERTEX_PROJECT and GOOGLE_VERTEX_LOCATION must be set');
    process.exit(1);
  }
  console.log(`  Vertex AI: project=${project}, location=${location}`);

  cleanAgentsDir();

  const judge = new RealGeminiJudge();
  const generator = new EvolvingReportGenerator();

  const sources: HandoffSource[] = [
    { title: 'Anthropic - Agent Design Patterns', url: 'https://anthropic.com/agents', snippet: 'Agent design...' },
    { title: 'Google - Gemini Agent Framework', url: 'https://cloud.google.com/vertex-ai', snippet: 'Agent framework...' },
    { title: 'LangChain - Multi-Agent Systems', url: 'https://langchain.com', snippet: 'Multi-agent...' },
  ];

  // ── Round 1: Start Loop ──────────────────────────────────────────────
  console.log('\n  ── Round 1: startLoop ──');
  console.log('  Generating initial report + evaluating...');
  const startTime = Date.now();

  const startResult = await startLoop({
    keyword: 'AI Agent 框架演进',
    subQueries: ['Agent 架构范式有哪些？', '多 Agent 如何协作？', 'Agent 安全如何保障？'],
    sources,
    maxRounds: 3,
    contractOverrides: { autoApproveScore: 9.0 },
    judge,
    generator,
  });

  const round1Duration = Date.now() - startTime;
  console.log(`  Round 1 completed in ${round1Duration}ms`);

  // Validate loop state
  assert.ok(startResult.loop.id.startsWith('loop-'), 'Loop ID should start with loop-');
  assert.equal(startResult.loop.currentRound, 1, 'Should be round 1');
  assert.equal(startResult.loop.keyword, 'AI Agent 框架演进');
  assert.ok(startResult.latestRound.score >= 0, 'Score should be non-negative');
  assert.ok(startResult.latestRound.score <= 10, 'Score should be <= 10');
  assert.ok(startResult.latestRound.feedback.length > 0, 'Should have feedback');

  console.log(`  Score: ${startResult.latestRound.score}`);
  console.log(`  Satisfied: ${startResult.latestRound.contractSatisfied}`);
  console.log(`  Sprint complete: ${startResult.sprintComplete}`);
  console.log('  PASS: startLoop');

  if (startResult.sprintComplete) {
    console.log('  Sprint completed at round 1 (auto-approved)');
    console.log('\n' + loopSummary(startResult.loop));
    cleanAgentsDir();
    console.log('\n=== All feedback loop integration tests passed ===\n');
    return;
  }

  // ── Round 2: loopNext (improved report) ─────────────────────────────
  console.log('\n  ── Round 2: loopNext ──');
  console.log('  Generating improved report + evaluating...');
  const round2Start = Date.now();

  const nextResult = await loopNext(
    startResult.loop.id,
    judge,
    generator,
    '请增加更多引用和分析深度',
  );

  const round2Duration = Date.now() - round2Start;
  console.log(`  Round 2 completed in ${round2Duration}ms`);

  assert.equal(nextResult.loop.currentRound, 2, 'Should be round 2');
  assert.equal(nextResult.loop.rounds.length, 2, 'Should have 2 rounds');
  assert.ok(nextResult.latestRound.score >= 0, 'Score should be non-negative');

  console.log(`  Score: ${nextResult.latestRound.score}`);
  console.log(`  Satisfied: ${nextResult.latestRound.contractSatisfied}`);
  console.log(`  Sprint complete: ${nextResult.sprintComplete}`);
  console.log(`  Best round: ${nextResult.loop.bestRound} (score: ${nextResult.loop.bestScore})`);
  console.log('  PASS: loopNext');

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n  ── Loop Summary ──');
  const loop = await loadLoop(startResult.loop.id);
  console.log(loopSummary(loop));

  // ── Manual Approve ───────────────────────────────────────────────────
  if (loop.status === 'active') {
    console.log('\n  ── Manual Approve ──');
    const approved = await loopApprove(loop.id);
    assert.equal(approved.status, 'approved');
    assert.ok(approved.completionReason?.includes('User approved'));
    console.log(`  PASS: loopApprove — ${approved.completionReason}`);
  }

  // ── Verify file storage ──────────────────────────────────────────────
  console.log('\n  ── File Storage Verification ──');
  const agentsDir = join(process.cwd(), '.agents');
  const loopsDir = join(agentsDir, 'loops');
  const handoffsDir = join(agentsDir, 'handoffs');
  const contractsDir = join(agentsDir, 'contracts');

  assert.ok(existsSync(loopsDir), '.agents/loops/ should exist');
  assert.ok(existsSync(handoffsDir), '.agents/handoffs/ should exist');
  assert.ok(existsSync(contractsDir), '.agents/contracts/ should exist');
  console.log('  PASS: All .agents/ directories created');

  cleanAgentsDir();

  console.log('\n=== All feedback loop integration tests passed ===\n');
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
