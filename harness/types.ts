/**
 * Harness Framework — Core Interface Definitions
 *
 * These interfaces decouple the generic harness framework from
 * any specific application (e.g., Laplace's Demon). Application code
 * implements these interfaces; the harness operates through them.
 */

import type { HandoffDocument } from './handoff';
import type { ScoreDimension } from './sprint-contract';

// ---------------------------------------------------------------------------
// Judge Interface — how the harness evaluates quality
// ---------------------------------------------------------------------------

export interface JudgeResult {
  scores: Record<string, number>;
  feedback: {
    strengths: string[];
    weaknesses: string[];
    actionableImprovements: string[];
    overallAssessment: string;
  };
}

/**
 * Abstract quality judge. The harness calls this to evaluate a HandoffDocument.
 * Applications provide concrete implementations (e.g., Gemini LLM-as-Judge).
 */
export interface IJudge {
  evaluate(handoff: HandoffDocument, dimensions: ScoreDimension[]): Promise<JudgeResult>;
}

// ---------------------------------------------------------------------------
// Report Generator Interface — how the harness generates content
// ---------------------------------------------------------------------------

export interface GeneratedReport {
  markdown: string;
  wordCount: number;
  sectionHeadings: string[];
  citationCount: number;
}

export interface GenerationMetrics {
  planDurationMs: number;
  fetchDurationMs: number;
  reportDurationMs: number;
  mindmapDurationMs: number;
  totalDurationMs: number;
  sourceCount: number;
  modelUsed: string;
}

export interface GenerationResult {
  report: GeneratedReport;
  metrics: GenerationMetrics;
}

export interface GenerationInput {
  keyword: string;
  subQueries: string[];
  sources: Array<{ title: string; url: string; snippet: string }>;
  previousFeedback?: string;
  userFeedback?: string;
}

/**
 * Abstract report generator. The harness calls this to produce content.
 * Applications provide concrete implementations (e.g., Gemini Pro streaming).
 */
export interface IReportGenerator {
  generate(input: GenerationInput): Promise<GenerationResult>;
}
