/**
 * Backend Evaluator — Orchestrates all 5 probes
 *
 * Runs enabled probes in sequence, calculates weighted score,
 * and returns a comprehensive BackendEvalResult.
 *
 * Usage:
 *   const evaluator = new BackendEvaluator(config);
 *   const result = await evaluator.run();
 *   console.log(evaluator.formatReport(result));
 */

import type {
  IProbe,
  BackendEvalConfig,
  BackendEvalResult,
  DEFAULT_BACKEND_EVAL_CONFIG,
} from './probes/types';
import { ApiReliabilityProbe } from './probes/api-reliability';
import { SearchQualityProbe } from './probes/search-quality';
import { DataIntegrityProbe } from './probes/data-integrity';
import { CacheEffectivenessProbe } from './probes/cache-effectiveness';
import { GracefulDegradationProbe } from './probes/graceful-degradation';

const ALL_PROBES: IProbe[] = [
  new ApiReliabilityProbe(),
  new SearchQualityProbe(),
  new DataIntegrityProbe(),
  new CacheEffectivenessProbe(),
  new GracefulDegradationProbe(),
];

export class BackendEvaluator {
  private config: BackendEvalConfig;

  constructor(config: BackendEvalConfig) {
    this.config = config;
  }

  async run(): Promise<BackendEvalResult> {
    const t0 = Date.now();
    const enabledDims = new Set(
      this.config.dimensions.filter((d) => d.enabled).map((d) => d.name),
    );

    const probes = ALL_PROBES.filter((p) => enabledDims.has(p.dimension));
    const results = [];

    for (const probe of probes) {
      const result = await probe.run(this.config);
      results.push(result);
    }

    let weightedScore = 0;
    let totalWeight = 0;
    let allPassed = true;

    for (const result of results) {
      const dim = this.config.dimensions.find((d) => d.name === result.dimension);
      if (dim) {
        weightedScore += result.score * dim.weight;
        totalWeight += dim.weight;
        if (!result.passed) allPassed = false;
      }
    }

    if (totalWeight > 0 && totalWeight !== 1) {
      weightedScore = weightedScore / totalWeight;
    }

    return {
      timestamp: new Date().toISOString(),
      weightedScore: Math.round(weightedScore * 100) / 100,
      allPassed,
      probes: results,
      config: this.config,
      totalDurationMs: Date.now() - t0,
    };
  }

  formatReport(result: BackendEvalResult): string {
    const lines: string[] = [
      `\n=== Backend Evaluation Report ===`,
      `Timestamp: ${result.timestamp}`,
      `Weighted Score: ${result.weightedScore.toFixed(2)} / 10`,
      `All Passed: ${result.allPassed ? '✓ YES' : '✗ NO'}`,
      `Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`,
      '',
    ];

    for (const probe of result.probes) {
      const dim = result.config.dimensions.find((d) => d.name === probe.dimension);
      const status = probe.passed ? '✓' : '✗';
      lines.push(`── ${status} ${probe.dimension} (w=${dim?.weight ?? 0}, score=${probe.score.toFixed(1)}, ${(probe.durationMs / 1000).toFixed(1)}s) ──`);

      for (const d of probe.details) {
        const icon = d.passed ? '  ✓' : '  ✗';
        lines.push(`${icon} ${d.check}: ${d.actual} (expected: ${d.expected})${d.error ? ` [${d.error}]` : ''}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export { DEFAULT_BACKEND_EVAL_CONFIG } from './probes/types';
export type { BackendEvalConfig, BackendEvalResult } from './probes/types';
