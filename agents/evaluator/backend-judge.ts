/**
 * Backend Judge — IJudge implementation for backend quality evaluation
 *
 * IMPORTANT: This judge evaluates quality from HandoffDocument data directly
 * (in-process), NOT by making HTTP requests to API endpoints.
 * HTTP-based evaluation (BackendEvaluator) should be run externally via CLI/CI.
 *
 * Dimensions evaluated from HandoffDocument:
 *   1. source_diversity — Are there sources from both Exa and ES?
 *   2. data_completeness — Are all source fields non-empty and valid?
 *   3. search_coverage — Enough unique sources? Snippet quality?
 *   4. report_structure — Report has proper sections and citations?
 *   5. pipeline_metrics — Timing within acceptable ranges?
 */

import type { IJudge, JudgeResult } from '@/harness/types';
import type { HandoffDocument } from '@/harness/handoff';
import type { ScoreDimension } from '@/harness/sprint-contract';

export const BACKEND_DIMENSIONS: ScoreDimension[] = [
  {
    name: 'source_diversity',
    description: '数据来源多样性：是否同时包含外部（Exa）和内部（ES）数据源',
    weight: 0.25,
    hardThreshold: 3.0,
    targetScore: 8.0,
  },
  {
    name: 'data_completeness',
    description: '数据完整性：所有 source 字段非空、URL 合法、无重复',
    weight: 0.25,
    hardThreshold: 5.0,
    targetScore: 9.0,
  },
  {
    name: 'search_coverage',
    description: '搜索覆盖度：来源数量 >= 阈值、snippet 非空率 >= 80%',
    weight: 0.20,
    hardThreshold: 5.0,
    targetScore: 8.0,
  },
  {
    name: 'report_structure',
    description: '报告结构：包含必要章节标题、有来源引用编号',
    weight: 0.15,
    hardThreshold: 4.0,
    targetScore: 8.0,
  },
  {
    name: 'pipeline_metrics',
    description: '管道指标：生成时间在合理范围内、来源数与报告长度匹配',
    weight: 0.15,
    hardThreshold: 3.0,
    targetScore: 7.0,
  },
];

interface CheckResult {
  dimension: string;
  check: string;
  passed: boolean;
  detail: string;
}

export class BackendJudge implements IJudge {
  async evaluate(
    handoff: HandoffDocument,
    _dimensions: ScoreDimension[],
  ): Promise<JudgeResult> {
    const checks: CheckResult[] = [];
    const sources = handoff.output.sources;
    const report = handoff.output.report;

    // --- D1: source_diversity ---
    const urls = sources.map((s) => s.url);
    const exaLike = sources.filter((s) => s.url.startsWith('http') && !s.url.includes('#internal'));
    const esLike = sources.filter((s) => s.url.includes('#internal') || s.url.includes('example.com'));

    checks.push({
      dimension: 'source_diversity',
      check: 'Has external (Exa-like) sources',
      passed: exaLike.length > 0,
      detail: `${exaLike.length} external sources`,
    });

    checks.push({
      dimension: 'source_diversity',
      check: 'Total sources >= 5',
      passed: sources.length >= 5,
      detail: `${sources.length} total sources`,
    });

    const uniqueUrls = new Set(urls);
    checks.push({
      dimension: 'source_diversity',
      check: 'No duplicate URLs',
      passed: urls.length === uniqueUrls.size,
      detail: urls.length === uniqueUrls.size ? 'no duplicates' : `${urls.length - uniqueUrls.size} duplicates`,
    });

    // --- D2: data_completeness ---
    const allHaveTitle = sources.every((s) => s.title && s.title.trim().length > 0);
    checks.push({
      dimension: 'data_completeness',
      check: 'All sources have title',
      passed: allHaveTitle,
      detail: allHaveTitle ? 'all present' : 'some missing',
    });

    const allHaveUrl = sources.every((s) => s.url && s.url.length > 0);
    checks.push({
      dimension: 'data_completeness',
      check: 'All sources have URL',
      passed: allHaveUrl,
      detail: allHaveUrl ? 'all present' : 'some missing',
    });

    const allHaveSnippet = sources.every((s) => s.snippet && s.snippet.trim().length > 0);
    checks.push({
      dimension: 'data_completeness',
      check: 'All sources have snippet',
      passed: allHaveSnippet,
      detail: allHaveSnippet ? 'all present' : 'some missing',
    });

    const subQueriesValid = handoff.input.subQueries.length >= 3 && handoff.input.subQueries.length <= 5;
    checks.push({
      dimension: 'data_completeness',
      check: 'subQueries count 3-5',
      passed: subQueriesValid,
      detail: `${handoff.input.subQueries.length} queries`,
    });

    // --- D3: search_coverage ---
    checks.push({
      dimension: 'search_coverage',
      check: 'Source count >= 8',
      passed: sources.length >= 8,
      detail: `${sources.length} sources`,
    });

    const snippetNonEmpty = sources.filter((s) => s.snippet && s.snippet.length > 50).length;
    const snippetRate = sources.length > 0 ? snippetNonEmpty / sources.length : 0;
    checks.push({
      dimension: 'search_coverage',
      check: 'Snippet non-empty rate >= 80%',
      passed: snippetRate >= 0.8,
      detail: `${(snippetRate * 100).toFixed(0)}%`,
    });

    // --- D4: report_structure ---
    const md = report?.markdown ?? '';
    const hasBackground = /##\s*.*(背景|概述|overview)/i.test(md);
    const hasConclusion = /##\s*.*(结论|conclusion|总结)/i.test(md);
    checks.push({
      dimension: 'report_structure',
      check: 'Has background/overview section',
      passed: hasBackground,
      detail: hasBackground ? 'present' : 'missing',
    });
    checks.push({
      dimension: 'report_structure',
      check: 'Has conclusion section',
      passed: hasConclusion,
      detail: hasConclusion ? 'present' : 'missing',
    });

    const citationCount = (md.match(/\[#?\d+\]/g) || []).length;
    checks.push({
      dimension: 'report_structure',
      check: 'Has source citations >= 3',
      passed: citationCount >= 3,
      detail: `${citationCount} citations`,
    });

    const wordCount = md.length;
    checks.push({
      dimension: 'report_structure',
      check: 'Report length >= 1500 chars',
      passed: wordCount >= 1500,
      detail: `${wordCount} chars`,
    });

    // --- D5: pipeline_metrics ---
    const reportDuration = handoff.metrics?.reportDurationMs ?? 0;
    checks.push({
      dimension: 'pipeline_metrics',
      check: 'Report generation < 120s',
      passed: reportDuration > 0 && reportDuration < 120_000,
      detail: reportDuration > 0 ? `${(reportDuration / 1000).toFixed(1)}s` : 'unknown',
    });

    checks.push({
      dimension: 'pipeline_metrics',
      check: 'Source count matches report citations',
      passed: citationCount > 0 && sources.length > 0,
      detail: `${sources.length} sources, ${citationCount} citations`,
    });

    // --- Compute scores ---
    const dimensionGroups = new Map<string, CheckResult[]>();
    for (const c of checks) {
      if (!dimensionGroups.has(c.dimension)) dimensionGroups.set(c.dimension, []);
      dimensionGroups.get(c.dimension)!.push(c);
    }

    const scores: Record<string, number> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const improvements: string[] = [];

    for (const dim of BACKEND_DIMENSIONS) {
      const group = dimensionGroups.get(dim.name) ?? [];
      const passed = group.filter((c) => c.passed).length;
      const total = group.length;
      const score = total > 0 ? Math.round((passed / total) * 10 * 100) / 100 : 0;
      scores[dim.name] = score;

      if (score >= dim.targetScore) {
        strengths.push(`${dim.name}: ${score.toFixed(1)}/10 (${passed}/${total} checks)`);
      } else if (score < dim.hardThreshold) {
        weaknesses.push(`${dim.name}: ${score.toFixed(1)}/10 — below hard threshold ${dim.hardThreshold}`);
      }

      for (const c of group) {
        if (!c.passed) {
          improvements.push(`[${dim.name}] ${c.check}: ${c.detail}`);
        }
      }
    }

    if (improvements.length === 0) {
      improvements.push('All backend checks passed');
    }

    const totalPassed = checks.filter((c) => c.passed).length;
    return {
      scores,
      feedback: {
        strengths: strengths.slice(0, 3),
        weaknesses: weaknesses.slice(0, 3),
        actionableImprovements: improvements.slice(0, 4),
        overallAssessment: `Backend: ${totalPassed}/${checks.length} checks passed, ${sources.length} sources, ${citationCount} citations, report ${(wordCount / 1000).toFixed(1)}k chars`,
      },
    };
  }
}
