/**
 * LLM-Judge Integration Test — Real Gemini API Call
 *
 * Requires: GOOGLE_VERTEX_PROJECT + GOOGLE_VERTEX_LOCATION env vars
 *
 * Run with:
 *   npx tsx tests/llm-judge.integration.test.ts
 */

import { strict as assert } from 'assert';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

import {
  createHandoffDocument,
  saveHandoff,
  type HandoffDocument,
  type HandoffReport,
  type HandoffMetrics,
} from '../harness/handoff';

import {
  proposeContract,
  activateContract,
  saveContract,
} from '../harness/sprint-contract';

import {
  runLLMJudge,
  judgeToDimensionScores,
  formatJudgeFeedback,
} from '../agents/evaluator/llm-judge';

const HANDOFFS_DIR = join(process.cwd(), '.agents', 'handoffs');

// Realistic sample report for evaluation
const sampleReportMarkdown = `# AI Agent 架构趋势深度研究报告

## 1. 背景概述
AI Agent 是近年来人工智能领域最受关注的方向之一。从 2023 年 AutoGPT 的出现，到 2024-2025 年 
Anthropic Claude、Google Gemini 等大模型的能力提升，AI Agent 正在从概念验证走向生产部署。

本报告基于对 8 个权威来源的综合分析，深入探讨 AI Agent 的技术架构演进与未来趋势。

## 2. 关键发现

### 2.1 架构范式转变
传统的 Chain-of-Thought (CoT) 范式正在被更复杂的 multi-agent 架构所取代。
Anthropic 的 computer use 和 Google 的 Gemini Agent 都采用了 tool-use + reflection 
的双循环架构 [1]。

### 2.2 核心技术栈
- **模型层**: GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash 构成了主流的基座模型选择
- **框架层**: LangChain, CrewAI, AutoGen 是最常用的 Agent 框架 [2]
- **评估层**: LLM-as-Judge, HELM, BigBench 等评估框架用于质量保证 [3]

### 2.3 生产部署挑战
实际生产环境中，Agent 面临以下关键挑战：
1. 上下文窗口限制导致的"遗忘"问题
2. 工具调用的可靠性和延迟
3. 安全性和权限控制 [4]

## 3. 趋势分析

### 3.1 多模态 Agent
Gemini 2.0 和 GPT-4o 的多模态能力使得 Agent 可以处理图像、视频和音频输入，
这为 web 自动化、代码审查等场景提供了全新的交互方式 [5]。

### 3.2 Agent 编排与协作
2025 年的趋势表明，单一 Agent 正在向 multi-agent 系统演进：
- Planner Agent 负责任务分解
- Executor Agent 负责具体执行
- Evaluator Agent 负责质量控制 [6]

### 3.3 安全与对齐
随着 Agent 获得更多系统权限（文件读写、API 调用），对齐问题变得更加突出。
Constitutional AI 和 RLHF 是目前主要的对齐手段 [7]。

## 4. 展望
预计到 2026 年，Agent 架构将实现：
- 上下文窗口突破百万 token
- 端到端的 Agent 安全认证框架
- 标准化的 Agent 互操作协议 [8]

## 5. 结论
AI Agent 正处于从"能用"到"好用"的关键转折期。架构设计需要同时关注
能力边界扩展和可靠性保障，多 Agent 协作和安全对齐是核心挑战。

## 参考文献
[1] Anthropic. "Building effective agents." 2024.
[2] LangChain. "Agent architectures." 2024.
[3] Stanford HELM. "Holistic evaluation of language models." 2023.
[4] Google DeepMind. "Gemini Agent safety." 2024.
[5] OpenAI. "GPT-4o multi-modal agents." 2024.
[6] CrewAI. "Multi-agent collaboration." 2024.
[7] Anthropic. "Constitutional AI." 2023.
[8] AI Alliance. "Agent interoperability standards." 2025.`;

const sampleMetrics: HandoffMetrics = {
  planDurationMs: 1200,
  fetchDurationMs: 4500,
  reportDurationMs: 8000,
  mindmapDurationMs: 3000,
  totalDurationMs: 16700,
  sourceCount: 8,
  modelUsed: 'gemini-2.5-pro',
};

const sampleReport: HandoffReport = {
  markdown: sampleReportMarkdown,
  wordCount: sampleReportMarkdown.split(/\s+/).filter(Boolean).length,
  sectionHeadings: [
    '背景概述', '关键发现', '架构范式转变', '核心技术栈',
    '生产部署挑战', '趋势分析', '多模态 Agent', 'Agent 编排与协作',
    '安全与对齐', '展望', '结论', '参考文献',
  ],
  citationCount: 8,
};

async function testLLMJudgeRealAPI() {
  console.log('  Creating test HandoffDocument...');

  const handoff = createHandoffDocument({
    keyword: 'AI Agent 架构趋势',
    subQueries: [
      'AI Agent 有哪些主流架构范式？',
      'Multi-Agent 系统如何协作？',
      'Agent 的安全性和对齐问题如何解决？',
    ],
    report: sampleReport,
    mindmap: null,
    sources: [
      { title: 'Anthropic - Building effective agents', url: 'https://anthropic.com/agents', snippet: 'Agent architecture patterns...' },
      { title: 'LangChain - Agent architectures', url: 'https://langchain.com/agents', snippet: 'Framework comparison...' },
      { title: 'Stanford HELM', url: 'https://helm.stanford.edu', snippet: 'Holistic evaluation...' },
      { title: 'Google DeepMind - Gemini Agent safety', url: 'https://deepmind.google', snippet: 'Agent safety research...' },
      { title: 'OpenAI - GPT-4o multi-modal', url: 'https://openai.com', snippet: 'Multi-modal agents...' },
    ],
    metrics: sampleMetrics,
  });

  await saveHandoff(handoff);
  console.log(`  HandoffDocument saved: ${handoff.id}`);

  // Use default dimensions from sprint contract
  const contract = proposeContract('AI Agent 架构趋势');

  console.log('  Calling Gemini Flash API (runLLMJudge)...');
  const startTime = Date.now();
  const result = await runLLMJudge(handoff, contract.dimensions);
  const duration = Date.now() - startTime;
  console.log(`  API call completed in ${duration}ms`);

  // Validate result structure
  assert.ok(result.scores, 'Should have scores');
  assert.ok(typeof result.scores.factual_accuracy === 'number', 'factual_accuracy should be a number');
  assert.ok(typeof result.scores.structural_completeness === 'number', 'structural_completeness should be a number');
  assert.ok(typeof result.scores.analysis_depth === 'number', 'analysis_depth should be a number');
  assert.ok(typeof result.scores.citation_quality === 'number', 'citation_quality should be a number');

  // Validate score ranges
  for (const [dim, score] of Object.entries(result.scores)) {
    assert.ok(score >= 0 && score <= 10, `${dim} score (${score}) should be 0-10`);
  }

  // Validate feedback structure
  assert.ok(result.feedback, 'Should have feedback');
  assert.ok(Array.isArray(result.feedback.strengths), 'strengths should be array');
  assert.ok(result.feedback.strengths.length >= 1, 'Should have at least 1 strength');
  assert.ok(Array.isArray(result.feedback.weaknesses), 'weaknesses should be array');
  assert.ok(result.feedback.weaknesses.length >= 1, 'Should have at least 1 weakness');
  assert.ok(Array.isArray(result.feedback.actionableImprovements), 'improvements should be array');
  assert.ok(result.feedback.actionableImprovements.length >= 1, 'Should have at least 1 improvement');
  assert.ok(typeof result.feedback.overallAssessment === 'string', 'overallAssessment should be string');
  assert.ok(result.feedback.overallAssessment.length > 0, 'overallAssessment should not be empty');

  console.log('  PASS: LLM Judge result structure');

  // Test conversion to dimension scores map
  const dimScores = judgeToDimensionScores(result);
  assert.deepEqual(Object.keys(dimScores).sort(), [
    'analysis_depth', 'citation_quality', 'factual_accuracy', 'structural_completeness',
  ]);
  console.log('  PASS: judgeToDimensionScores');

  // Test feedback formatting
  const formatted = formatJudgeFeedback(result);
  assert.ok(formatted.includes('**总评**'), 'Formatted should include overall assessment header');
  assert.ok(formatted.includes('**优点**'), 'Formatted should include strengths header');
  assert.ok(formatted.includes('**不足**'), 'Formatted should include weaknesses header');
  assert.ok(formatted.includes('**改进建议**'), 'Formatted should include improvements header');
  console.log('  PASS: formatJudgeFeedback');

  // Print actual results for inspection
  console.log('\n  --- Actual Gemini API Results ---');
  console.log(`  Scores:`);
  console.log(`    事实准确性:   ${result.scores.factual_accuracy}`);
  console.log(`    结构完整性:   ${result.scores.structural_completeness}`);
  console.log(`    分析深度:     ${result.scores.analysis_depth}`);
  console.log(`    引用质量:     ${result.scores.citation_quality}`);
  console.log(`  总评: ${result.feedback.overallAssessment}`);
  console.log(`  优点: ${result.feedback.strengths.join(' | ')}`);
  console.log(`  不足: ${result.feedback.weaknesses.join(' | ')}`);
  console.log(`  改进: ${result.feedback.actionableImprovements.join(' | ')}`);
  console.log('  ---');

  return { handoff, result, dimScores };
}

async function main() {
  console.log('\n=== LLM-Judge Integration Test (Real Gemini API) ===\n');

  // Check env vars
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION;
  if (!project || !location) {
    console.error('ERROR: GOOGLE_VERTEX_PROJECT and GOOGLE_VERTEX_LOCATION must be set');
    console.error(`  GOOGLE_VERTEX_PROJECT=${project || '(missing)'}`);
    console.error(`  GOOGLE_VERTEX_LOCATION=${location || '(missing)'}`);
    process.exit(1);
  }
  console.log(`  Vertex AI: project=${project}, location=${location}`);

  await testLLMJudgeRealAPI();

  // Cleanup test files
  const handoffsDir = join(process.cwd(), '.agents', 'handoffs');
  if (existsSync(handoffsDir)) {
    rmSync(handoffsDir, { recursive: true, force: true });
  }

  console.log('\n=== All LLM-Judge integration tests passed ===\n');
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
