'use client';

import type {
  PredictionStreamEvent,
  PredictionStreamOutcome,
  PredictionStreamSource,
} from '@/lib/prediction-types';

export type PredictionStreamMode = 'mock' | 'real';

export interface PredictionStreamHandlers {
  onEvent: (event: PredictionStreamEvent) => void;
  onError: (error: Error) => void;
}

export interface PredictionStreamClient {
  subscribe: (
    predictionId: string,
    question: string,
    handlers: PredictionStreamHandlers,
  ) => () => void;
}

const mockSources: PredictionStreamSource[] = [
  {
    id: 'mock-source-1',
    title: 'Recent news and official announcements',
    url: 'https://example.com/latest-news',
    description: 'Current reporting and primary announcements related to the forecast.',
  },
  {
    id: 'mock-source-2',
    title: 'Historical performance dataset',
    url: 'https://example.com/historical-data',
    description: 'Comparable outcomes and performance signals from recent years.',
  },
  {
    id: 'mock-source-3',
    title: 'Market and expert consensus',
    url: 'https://example.com/market-consensus',
    description: 'Aggregated expectations from market signals and domain experts.',
  },
];

const mockOutcomes: PredictionStreamOutcome[] = [
  {
    label: 'Leading outcome',
    probability: 48,
    rationale: 'Supported by the strongest combination of recent and historical signals.',
  },
  {
    label: 'Alternative outcome',
    probability: 32,
    rationale: 'Remains plausible but has less consistent support across the sources.',
  },
  {
    label: 'Other outcomes',
    probability: 20,
    rationale: 'Captures uncertainty and lower-probability scenarios.',
  },
];

function mockQueries(question: string) {
  return [
    `Latest evidence relevant to: ${question}`,
    `Historical outcomes and comparable cases for: ${question}`,
    `Current expert and market expectations for: ${question}`,
  ];
}

function createMockEvent(
  type: PredictionStreamEvent['type'],
  revision: number,
  data: PredictionStreamEvent['data'],
): PredictionStreamEvent {
  return {
    type,
    revision,
    occurredAt: new Date().toISOString(),
    data,
  } as PredictionStreamEvent;
}

function createMockClient(): PredictionStreamClient {
  return {
    subscribe(_predictionId, question, handlers) {
      const timers: number[] = [];
      let closed = false;
      let revision = 0;

      const emit = (
        delay: number,
        type: PredictionStreamEvent['type'],
        data: PredictionStreamEvent['data'],
      ) => {
        const timer = window.setTimeout(() => {
          if (closed) return;
          revision += 1;
          handlers.onEvent(createMockEvent(type, revision, data));
        }, delay);
        timers.push(timer);
      };

      emit(0, 'snapshot', {
        stage: 'planning',
        message: 'Planning focused research queries',
        queries: [],
        sources: [],
        draftOutcomes: [],
        reportPreview: '',
      });
      emit(1_200, 'queries', { queries: mockQueries(question) });
      emit(2_400, 'stage', {
        stage: 'collecting_sources',
        message: 'Searching current sources for evidence',
      });
      emit(3_800, 'sources', { sources: mockSources });
      emit(5_200, 'stage', {
        stage: 'estimating',
        message: 'Comparing evidence and estimating outcome probabilities',
      });
      emit(6_800, 'outcomes', { outcomes: mockOutcomes });
      emit(8_200, 'stage', {
        stage: 'writing_report',
        message: 'Writing the source-backed forecast report',
      });
      emit(9_200, 'report_delta', {
        delta: '## Evidence review\n\nThe available sources point to several competing signals. ',
      });
      emit(10_800, 'report_delta', {
        delta: 'Recent evidence gives the leading outcome an advantage, while historical comparisons preserve meaningful uncertainty.\n\n',
      });
      emit(12_400, 'report_delta', {
        delta: '## Preliminary assessment\n\nThe forecast is being checked against the collected sources before the final result is published.',
      });

      return () => {
        closed = true;
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    },
  };
}

const eventTypes: PredictionStreamEvent['type'][] = [
  'snapshot',
  'stage',
  'queries',
  'sources',
  'outcomes',
  'report_delta',
  'completed',
  'failed',
];

function createRealClient(): PredictionStreamClient {
  return {
    subscribe(predictionId, _question, handlers) {
      const source = new EventSource(`/api/predictions/${predictionId}/events`);
      let closed = false;

      const fail = (error: Error) => {
        if (closed) return;
        closed = true;
        source.close();
        handlers.onError(error);
      };

      const listeners = eventTypes.map((type) => {
        const listener = (message: MessageEvent<string>) => {
          try {
            const event = JSON.parse(message.data) as PredictionStreamEvent;
            if (event.type !== type) throw new Error('Prediction stream event type mismatch.');
            handlers.onEvent(event);
            if (type === 'completed' || type === 'failed') {
              closed = true;
              source.close();
            }
          } catch {
            fail(new Error('Prediction stream returned an invalid event.'));
          }
        };
        source.addEventListener(type, listener as EventListener);
        return { type, listener };
      });

      source.onerror = () => {
        fail(new Error('Live prediction stream is unavailable.'));
      };

      return () => {
        closed = true;
        listeners.forEach(({ type, listener }) => {
          source.removeEventListener(type, listener as EventListener);
        });
        source.close();
      };
    },
  };
}

export function getPredictionStreamMode(): PredictionStreamMode {
  return process.env.NEXT_PUBLIC_PREDICTION_STREAM_MODE === 'real' ? 'real' : 'mock';
}

export function createPredictionStreamClient(
  mode = getPredictionStreamMode(),
): PredictionStreamClient {
  return mode === 'real' ? createRealClient() : createMockClient();
}
