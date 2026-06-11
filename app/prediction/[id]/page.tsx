'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { PredictionDetailView } from '@/components/PredictionDetailView';
import { PredictionHeader } from '@/components/PredictionHeader';
import { PredictionProgressView } from '@/components/PredictionProgressView';
import type { PredictionDetail, PredictionProgress } from '@/lib/prediction-types';
import { useCreatePrediction } from '../../use-create-prediction';
import { usePredictionStream } from '../use-prediction-stream';

export default function PredictionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const createPrediction = useCreatePrediction();
  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [progress, setProgress] = useState<PredictionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshPrediction = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const { mode, streamAvailable, streamState } = usePredictionStream({
    predictionId: id,
    progress,
    onCompleted: refreshPrediction,
    onFailed: setError,
  });

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    setError(null);

    const load = async () => {
      try {
        const response = await fetch(`/api/predictions/${id}`, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || 'Prediction could not be loaded.');
        if (cancelled) return;

        if (body.status === 'processing') {
          setPrediction(null);
          setProgress(body);
          setResolvedId(id);
          timeout = setTimeout(load, 2_000);
          return;
        }

        if (body.status === 'failed') {
          throw new Error(body.error?.message || 'Prediction generation failed.');
        }

        setPrediction(body);
        setProgress(null);
        setResolvedId(id);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Prediction could not be loaded.');
          setResolvedId(id);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [id, refreshToken]);

  const initialLoading = resolvedId !== id;
  const lockViewport = initialLoading || Boolean(progress);

  return (
    <div className={`${lockViewport ? 'h-dvh overflow-hidden' : 'min-h-dvh'} bg-laplace-parchment`}>
      <PredictionHeader onSubmit={createPrediction} />
      {initialLoading && (
        <main
          aria-label="Loading prediction"
          className="grid h-[calc(100dvh-5rem)] place-items-center px-5"
        >
          <div className="flex items-center gap-3 text-sm font-medium text-laplace-muted">
            <LoaderCircle className="h-5 w-5 animate-spin text-laplace-green" />
            Loading prediction
          </div>
        </main>
      )}
      {!initialLoading && error && (
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="text-2xl font-bold text-[#2C2417]">Prediction unavailable</h1>
          <p className="mt-3 text-laplace-muted">{error}</p>
        </div>
      )}
      {!initialLoading && !error && progress && (
        <PredictionProgressView
          progress={progress}
          streamState={streamState}
          streamMode={mode}
          streamAvailable={streamAvailable}
        />
      )}
      {!initialLoading && prediction && <PredictionDetailView prediction={prediction} />}
    </div>
  );
}
