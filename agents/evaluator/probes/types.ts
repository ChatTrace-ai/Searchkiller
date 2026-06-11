/**
 * Backend Evaluator — Probe Types
 *
 * Shared types for all 5 backend quality probes.
 * Each probe implements the IProbe interface and returns a ProbeResult.
 */

export interface ProbeDetail {
  check: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

export interface ProbeResult {
  dimension: string;
  score: number;
  passed: boolean;
  details: ProbeDetail[];
  durationMs: number;
}

export interface IProbe {
  readonly dimension: string;
  run(config: BackendEvalConfig): Promise<ProbeResult>;
}

export interface DimensionConfig {
  name: string;
  weight: number;
  hardThreshold: number;
  enabled: boolean;
}

export interface ApiEndpointConfig {
  path: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  slaMs: number;
  requiredFields?: string[];
}

export interface BackendEvalConfig {
  dimensions: DimensionConfig[];
  apiEndpoints: ApiEndpointConfig[];
  searchTestQueries: string[];
  baseUrl: string;
}

export interface BackendEvalResult {
  timestamp: string;
  weightedScore: number;
  allPassed: boolean;
  probes: ProbeResult[];
  config: BackendEvalConfig;
  totalDurationMs: number;
}

export const DEFAULT_BACKEND_EVAL_CONFIG: BackendEvalConfig = {
  dimensions: [
    { name: 'api_reliability',      weight: 0.25, hardThreshold: 9, enabled: true },
    { name: 'search_quality',       weight: 0.25, hardThreshold: 6, enabled: true },
    { name: 'data_integrity',       weight: 0.20, hardThreshold: 8, enabled: true },
    { name: 'cache_effectiveness',  weight: 0.15, hardThreshold: 0, enabled: false },
    { name: 'graceful_degradation', weight: 0.15, hardThreshold: 8, enabled: true },
  ],
  apiEndpoints: [
    {
      path: '/api/plan',
      method: 'POST',
      body: { keyword: '测试关键词：AI 技术趋势' },
      slaMs: 15_000,
      requiredFields: ['subQueries'],
    },
    {
      path: '/api/evaluate',
      method: 'POST',
      body: { action: 'stats' },
      slaMs: 2_000,
    },
  ],
  searchTestQueries: ['AI Agent 安全性研究', 'LLM alignment techniques 2026'],
  baseUrl: 'http://localhost:3000',
};
