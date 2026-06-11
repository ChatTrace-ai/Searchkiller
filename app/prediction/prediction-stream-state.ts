import type {
  PredictionStreamEvent,
  PredictionStreamState,
} from '@/lib/prediction-types';

export function createInitialPredictionStreamState(): PredictionStreamState {
  return {
    stage: 'planning',
    message: 'Planning focused research queries',
    queries: [],
    sources: [],
    draftOutcomes: [],
    reportPreview: '',
  };
}

export function isNewerPredictionStreamEvent(
  latestRevision: number,
  event: PredictionStreamEvent,
) {
  return event.revision > latestRevision;
}

export function applyPredictionStreamEvent(
  current: PredictionStreamState,
  event: PredictionStreamEvent,
): PredictionStreamState {
  switch (event.type) {
    case 'snapshot':
      return event.data;
    case 'stage':
      return { ...current, ...event.data };
    case 'queries':
      return { ...current, queries: event.data.queries };
    case 'sources':
      return { ...current, sources: event.data.sources };
    case 'outcomes':
      return { ...current, draftOutcomes: event.data.outcomes };
    case 'report_delta':
      return { ...current, reportPreview: current.reportPreview + event.data.delta };
    default:
      return current;
  }
}
