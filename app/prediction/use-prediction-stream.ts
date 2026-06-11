'use client';

import { useEffect, useRef, useState } from 'react';
import type { PredictionProgress } from '@/lib/prediction-types';
import { createPredictionStreamClient, getPredictionStreamMode } from './prediction-stream-client';
import {
  applyPredictionStreamEvent,
  createInitialPredictionStreamState,
  isNewerPredictionStreamEvent,
} from './prediction-stream-state';

export function usePredictionStream({
  predictionId,
  progress,
  onCompleted,
  onFailed,
}: {
  predictionId: string;
  progress: PredictionProgress | null;
  onCompleted: () => void;
  onFailed: (message: string) => void;
}) {
  const [streamState, setStreamState] = useState(createInitialPredictionStreamState);
  const [streamAvailable, setStreamAvailable] = useState(true);
  const revisionRef = useRef(0);
  const onCompletedRef = useRef(onCompleted);
  const onFailedRef = useRef(onFailed);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
    onFailedRef.current = onFailed;
  }, [onCompleted, onFailed]);

  useEffect(() => {
    if (!progress?.question) return;

    revisionRef.current = 0;
    setStreamState(createInitialPredictionStreamState());
    setStreamAvailable(true);
    const client = createPredictionStreamClient();

    return client.subscribe(predictionId, progress.question, {
      onEvent(event) {
        if (!isNewerPredictionStreamEvent(revisionRef.current, event)) return;
        revisionRef.current = event.revision;

        if (event.type === 'completed') {
          onCompletedRef.current();
          return;
        }
        if (event.type === 'failed') {
          onFailedRef.current(event.data.message);
          return;
        }
        setStreamState((current) => applyPredictionStreamEvent(current, event));
      },
      onError() {
        setStreamAvailable(false);
      },
    });
  }, [predictionId, progress?.question]);

  const displayState = streamAvailable
    ? streamState
    : {
        ...streamState,
        stage: progress?.progress.stage ?? streamState.stage,
        message: progress?.progress.message ?? streamState.message,
      };

  return {
    mode: getPredictionStreamMode(),
    streamAvailable,
    streamState: displayState,
  };
}
