/**
 * Unit tests for LLM-Judge helper functions
 *
 * Tests the non-API parts: score conversion, feedback formatting.
 * Requires GOOGLE_VERTEX_LOCATION and GOOGLE_VERTEX_PROJECT env vars
 * (dummy values are fine since no actual API calls are made).
 *
 * Run with:
 *   GOOGLE_VERTEX_LOCATION=us-central1 GOOGLE_VERTEX_PROJECT=dummy \
 *     npx tsx tests/llm-judge.unit.test.ts
 */

import { strict as assert } from 'assert';

import {
  judgeToDimensionScores,
  formatJudgeFeedback,
  type LLMJudgeResult,
} from '../agents/evaluator/llm-judge';

const sampleResult: LLMJudgeResult = {
  scores: {
    factual_accuracy: 7.5,
    structural_completeness: 8.0,
    analysis_depth: 6.5,
    citation_quality: 7.0,
  },
  feedback: {
    strengths: [
      '报告结构清晰，章节划分合理',
      '关键发现部分数据翔实',
    ],
    weaknesses: [
      '分析深度不足，缺少对趋势的前瞻性判断',
      '部分引用缺少具体来源链接',
    ],
    actionableImprovements: [
      '在"趋势展望"章节增加基于数据的预测分析',
      '补充引用 [#3] 和 [#5] 的具体 URL',
      '在"技术分析"部分增加与竞品的对比维度',
    ],
    overallAssessment: '报告整体质量良好，但分析深度和引用完整性还有提升空间',
  },
};

function testJudgeToDimensionScores() {
  const scores = judgeToDimensionScores(sampleResult);

  assert.equal(scores.factual_accuracy, 7.5);
  assert.equal(scores.structural_completeness, 8.0);
  assert.equal(scores.analysis_depth, 6.5);
  assert.equal(scores.citation_quality, 7.0);
  assert.equal(Object.keys(scores).length, 4);

  console.log('  PASS: judgeToDimensionScores');
}

function testFormatJudgeFeedback() {
  const formatted = formatJudgeFeedback(sampleResult);

  assert.ok(formatted.includes('总评'));
  assert.ok(formatted.includes('报告整体质量良好'));
  assert.ok(formatted.includes('准确性=7.5'));
  assert.ok(formatted.includes('深度=6.5'));
  assert.ok(formatted.includes('优点'));
  assert.ok(formatted.includes('不足'));
  assert.ok(formatted.includes('改进建议'));
  assert.ok(formatted.includes('趋势展望'));

  console.log('  PASS: formatJudgeFeedback');
}

function testEmptyResult() {
  const emptyResult: LLMJudgeResult = {
    scores: {
      factual_accuracy: 0,
      structural_completeness: 0,
      analysis_depth: 0,
      citation_quality: 0,
    },
    feedback: {
      strengths: [],
      weaknesses: ['报告为空'],
      actionableImprovements: ['需要生成实际内容'],
      overallAssessment: '无内容',
    },
  };

  const scores = judgeToDimensionScores(emptyResult);
  assert.equal(scores.factual_accuracy, 0);

  const formatted = formatJudgeFeedback(emptyResult);
  assert.ok(formatted.includes('无内容'));

  console.log('  PASS: emptyResult');
}

function main() {
  console.log('\n=== LLM-Judge Helper Unit Tests ===\n');

  testJudgeToDimensionScores();
  testFormatJudgeFeedback();
  testEmptyResult();

  console.log('\n=== All tests passed ===\n');
}

main();
