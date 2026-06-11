import { test, expect } from '@playwright/test';
import {
  applyPredictionStreamEvent,
  createInitialPredictionStreamState,
  isNewerPredictionStreamEvent,
} from '@/app/prediction/prediction-stream-state';
import type { PredictionStreamEvent } from '@/lib/prediction-types';

function event(
  value: Omit<PredictionStreamEvent, 'occurredAt'>,
): PredictionStreamEvent {
  return {
    ...value,
    occurredAt: '2026-06-11T10:00:00Z',
  } as PredictionStreamEvent;
}

test.describe('Prediction stream state', () => {
  test('rebuilds from snapshot and appends report deltas', () => {
    const snapshot = event({
      type: 'snapshot',
      revision: 4,
      data: {
        stage: 'writing_report',
        message: 'Writing report',
        queries: ['query one'],
        sources: [],
        draftOutcomes: [{ label: 'Yes', probability: 60 }],
        reportPreview: '## Analysis\n\n',
      },
    });
    const delta = event({
      type: 'report_delta',
      revision: 5,
      data: { delta: 'Evidence supports the leading outcome.' },
    });

    const restored = applyPredictionStreamEvent(
      createInitialPredictionStreamState(),
      snapshot,
    );
    const updated = applyPredictionStreamEvent(restored, delta);

    expect(updated.stage).toBe('writing_report');
    expect(updated.queries).toEqual(['query one']);
    expect(updated.reportPreview).toBe(
      '## Analysis\n\nEvidence supports the leading outcome.',
    );
  });

  test('identifies duplicate and out-of-order revisions', () => {
    const currentRevision = 7;

    expect(isNewerPredictionStreamEvent(currentRevision, event({
      type: 'stage',
      revision: 8,
      data: { stage: 'estimating', message: 'Estimating' },
    }))).toBe(true);
    expect(isNewerPredictionStreamEvent(currentRevision, event({
      type: 'stage',
      revision: 7,
      data: { stage: 'estimating', message: 'Duplicate' },
    }))).toBe(false);
    expect(isNewerPredictionStreamEvent(currentRevision, event({
      type: 'stage',
      revision: 6,
      data: { stage: 'collecting_sources', message: 'Stale' },
    }))).toBe(false);
  });
});
