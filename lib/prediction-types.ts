export type PredictionStatus = 'processing' | 'completed' | 'failed';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type PredictionStage =
  | 'planning'
  | 'collecting_sources'
  | 'estimating'
  | 'writing_report';

export interface PredictionSummary {
  id: string;
  question: string;
  category: string;
  icon?: string;
  status: PredictionStatus;
  topOutcomes: Array<{
    label: string;
    probability: number;
    icon?: string;
  }>;
  updatedAt: string;
}

export interface PredictionDetail {
  id: string;
  question: string;
  category: string;
  icon?: string;
  status: PredictionStatus;
  confidence: {
    level: ConfidenceLevel;
    score: number;
    explanation: string;
  };
  outcomes: Array<{
    id: string;
    rank: number;
    label: string;
    icon?: string;
    probability: number;
    change: number;
    rationale: string;
    sourceIds: string[];
  }>;
  sources: Array<{
    id: string;
    title: string;
    description?: string;
    url: string;
    quality: ConfidenceLevel;
    publishedAt?: string;
  }>;
  summary: string[];
  report?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PredictionProgress {
  id: string;
  question: string;
  status: 'processing';
  progress: {
    stage: PredictionStage;
    message: string;
  };
  updatedAt: string;
}

export interface PredictionStreamSource {
  id: string;
  title: string;
  url: string;
  description?: string;
}

export interface PredictionStreamOutcome {
  label: string;
  probability: number;
  rationale?: string;
}

export interface PredictionStreamState {
  stage: PredictionStage;
  message: string;
  queries: string[];
  sources: PredictionStreamSource[];
  draftOutcomes: PredictionStreamOutcome[];
  reportPreview: string;
}

interface PredictionStreamEventBase {
  revision: number;
  occurredAt: string;
}

export type PredictionStreamEvent =
  | (PredictionStreamEventBase & {
      type: 'snapshot';
      data: PredictionStreamState;
    })
  | (PredictionStreamEventBase & {
      type: 'stage';
      data: Pick<PredictionStreamState, 'stage' | 'message'>;
    })
  | (PredictionStreamEventBase & {
      type: 'queries';
      data: { queries: string[] };
    })
  | (PredictionStreamEventBase & {
      type: 'sources';
      data: { sources: PredictionStreamSource[] };
    })
  | (PredictionStreamEventBase & {
      type: 'outcomes';
      data: { outcomes: PredictionStreamOutcome[] };
    })
  | (PredictionStreamEventBase & {
      type: 'report_delta';
      data: { delta: string };
    })
  | (PredictionStreamEventBase & {
      type: 'completed';
      data: { id: string };
    })
  | (PredictionStreamEventBase & {
      type: 'failed';
      data: { code: string; message: string };
    });

export interface PredictionListResponse {
  items: PredictionSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PredictionMutationResponse {
  id: string;
  status: PredictionStatus;
  reused?: boolean;
  pollAfterMs: number | null;
}

export interface ApiErrorBody {
  error: {
    code:
      | 'INVALID_REQUEST'
      | 'PREDICTION_NOT_FOUND'
      | 'PREDICTION_IN_PROGRESS'
      | 'RATE_LIMITED'
      | 'GENERATION_FAILED'
      | 'SERVICE_UNAVAILABLE';
    message: string;
  };
}
