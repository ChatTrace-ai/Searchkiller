'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  FileText,
  LoaderCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import type { PredictionProgress } from '@/lib/prediction-types';

const stages = [
  {
    id: 'planning',
    label: 'Planning the research',
    detail: 'Breaking the question into focused research queries',
    icon: Sparkles,
    progress: 12,
  },
  {
    id: 'collecting_sources',
    label: 'Collecting evidence',
    detail: 'Searching current sources and removing duplicate results',
    icon: Search,
    progress: 38,
  },
  {
    id: 'estimating',
    label: 'Estimating probabilities',
    detail: 'Comparing evidence and calculating possible outcomes',
    icon: BarChart3,
    progress: 70,
  },
  {
    id: 'writing_report',
    label: 'Writing the report',
    detail: 'Turning the analysis into a source-backed forecast',
    icon: FileText,
    progress: 90,
  },
] as const;

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder.toString().padStart(2, '0')}s`;
}

export function PredictionProgressView({
  progress,
}: {
  progress: PredictionProgress | null;
}) {
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const currentStage = progress?.progress.stage ?? 'planning';
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.id === currentStage));
  const activeStage = stages[currentIndex];
  const progressValue = activeStage.progress;
  const completedCount = currentIndex;

  const statusMessage = useMemo(
    () => progress?.progress.message || activeStage.detail,
    [activeStage.detail, progress?.progress.message],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-14 lg:px-8">
      <div className="border-b border-slate-200 pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-blue-700">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Forecast in progress
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">Usually takes 1-2 minutes</span>
        </div>
        <h1 className="mt-4 max-w-4xl text-balance text-3xl font-bold text-slate-950 sm:text-4xl">
          {progress?.question || 'Preparing your prediction'}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          {statusMessage}
        </p>
      </div>

      <div className="grid gap-10 py-9 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
        <section aria-labelledby="prediction-progress-heading">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-slate-500">Research progress</p>
              <h2 id="prediction-progress-heading" className="mt-1 text-xl font-semibold text-slate-950">
                {activeStage.label}
              </h2>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-blue-700">
              {progressValue}%
            </span>
          </div>

          <div
            className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="Prediction generation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressValue}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-700"
              style={{ width: `${progressValue}%` }}
            />
          </div>

          <ol className="mt-9">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const completed = index < currentIndex;
              const active = index === currentIndex;

              return (
                <li key={stage.id} className="relative flex min-h-24 gap-4 last:min-h-0">
                  {index < stages.length - 1 && (
                    <span
                      className={`absolute left-5 top-11 h-[calc(100%-2.5rem)] w-px ${
                        completed ? 'bg-blue-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border ${
                      completed
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : active
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {completed ? (
                      <Check className="h-5 w-5" />
                    ) : active ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </span>
                  <div className="pb-7 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-semibold ${active || completed ? 'text-slate-950' : 'text-slate-500'}`}>
                        {stage.label}
                      </h3>
                      {active && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          In progress
                        </span>
                      )}
                      {completed && (
                        <span className="text-xs font-medium text-emerald-700">Complete</span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm leading-6 ${active ? 'text-slate-600' : 'text-slate-400'}`}>
                      {stage.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="border-t border-slate-200 pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <dl className="space-y-7">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Elapsed time</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                {formatElapsed(elapsedSeconds)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Steps complete</dt>
              <dd className="mt-2 text-lg font-semibold text-slate-950">
                {completedCount} of {stages.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Current activity</dt>
              <dd className="mt-2 text-sm leading-6 text-slate-600">{statusMessage}</dd>
            </div>
          </dl>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-sm leading-6 text-slate-500">
              This page updates automatically. You can leave it open while the forecast is generated.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
