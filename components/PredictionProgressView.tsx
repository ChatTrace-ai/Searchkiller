'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  CircleAlert,
  ExternalLink,
  FileText,
  LoaderCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type {
  PredictionProgress,
  PredictionStreamState,
} from '@/lib/prediction-types';

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
  streamState,
  streamMode,
  streamAvailable,
}: {
  progress: PredictionProgress | null;
  streamState: PredictionStreamState;
  streamMode: 'mock' | 'real';
  streamAvailable: boolean;
}) {
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const streamPanelRef = useRef<HTMLDivElement>(null);
  const followStreamRef = useRef(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const currentStage = streamState.stage;
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.id === currentStage));
  const activeStage = stages[currentIndex];
  const progressValue = activeStage.progress;
  const completedCount = currentIndex;

  const statusMessage = useMemo(
    () => streamState.message || progress?.progress.message || activeStage.detail,
    [activeStage.detail, progress?.progress.message, streamState.message],
  );
  const hasStreamContent = (
    streamState.queries.length > 0 ||
    streamState.sources.length > 0 ||
    streamState.draftOutcomes.length > 0 ||
    Boolean(streamState.reportPreview)
  );
  const streamRevisionKey = [
    streamState.stage,
    streamState.queries.length,
    streamState.sources.length,
    streamState.draftOutcomes.length,
    streamState.reportPreview.length,
  ].join(':');

  useEffect(() => {
    const panel = streamPanelRef.current;
    if (!panel || !followStreamRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [streamRevisionKey]);

  return (
    <main className="mx-auto flex h-[calc(100dvh-5rem)] w-full max-w-[1500px] flex-col overflow-hidden px-5 py-5 lg:px-8">
      <header className="shrink-0 border-b border-laplace-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-2 font-semibold text-laplace-green">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Forecast in progress
              </span>
              <span className="text-laplace-border">/</span>
              <span className="text-laplace-muted">Usually takes 1-2 minutes</span>
            </div>
            <h1 className="mt-2 max-w-4xl text-balance text-2xl font-bold text-[#2C2417] sm:text-3xl">
              {progress?.question || 'Preparing your prediction'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-laplace-muted">
              {statusMessage}
            </p>
          </div>

          <dl className="flex shrink-0 items-center gap-5 border-t border-laplace-border pt-3 text-sm lg:border-l lg:border-t-0 lg:pl-6 lg:pt-1">
            <div>
              <dt className="text-xs text-laplace-muted">Elapsed</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[#2C2417]">
                {formatElapsed(elapsedSeconds)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-laplace-muted">Step</dt>
              <dd className="mt-0.5 font-semibold text-[#2C2417]">
                {completedCount + 1}/{stages.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-laplace-muted">Stream</dt>
              <dd className={`mt-0.5 font-semibold ${
                streamAvailable ? 'text-laplace-sage' : 'text-amber-700'
              }`}>
                {streamAvailable
                  ? streamMode === 'mock' ? 'Preview' : 'Live'
                  : 'Polling'}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(230px,0.8fr)_minmax(0,1.2fr)] gap-5 pt-5 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.35fr)] lg:grid-rows-1">
        <section
          aria-labelledby="prediction-progress-heading"
          className="min-h-0 overflow-y-auto pr-2"
        >
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-laplace-muted">Research progress</p>
                <h2 id="prediction-progress-heading" className="mt-1 text-xl font-semibold text-[#2C2417]">
                  {activeStage.label}
                </h2>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-laplace-green">
                {progressValue}%
              </span>
            </div>

            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-laplace-border"
              role="progressbar"
              aria-label="Prediction generation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressValue}
            >
              <div
                className="h-full rounded-full bg-laplace-green transition-[width] duration-700"
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
                          completed ? 'bg-laplace-sage' : 'bg-laplace-border'
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border ${
                        completed
                          ? 'border-laplace-green bg-laplace-green text-white'
                          : active
                            ? 'border-laplace-sage bg-laplace-green/10 text-laplace-green'
                            : 'border-laplace-border bg-laplace-card text-laplace-muted'
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
                        <h3 className={`font-semibold ${active || completed ? 'text-[#2C2417]' : 'text-laplace-muted'}`}>
                          {stage.label}
                        </h3>
                        {active && (
                          <span className="rounded bg-laplace-green/10 px-2 py-0.5 text-xs font-semibold text-laplace-sage">
                            In progress
                          </span>
                        )}
                        {completed && (
                          <span className="text-xs font-medium text-laplace-sage">Complete</span>
                        )}
                      </div>
                      <p className={`mt-1 text-sm leading-6 ${active ? 'text-laplace-muted' : 'text-laplace-border'}`}>
                        {stage.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
        </section>

        <section
          aria-labelledby="live-activity-heading"
          className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-laplace-border bg-laplace-card shadow-sm"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-laplace-border px-5 py-3.5 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-laplace-sage">Live activity</p>
              <h2 id="live-activity-heading" className="mt-0.5 text-lg font-semibold text-[#2C2417]">
                Research output
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-laplace-muted">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-laplace-sage" />
              Updating
            </span>
          </div>

          <div
            ref={streamPanelRef}
            data-testid="prediction-stream-panel"
            className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
            onScroll={(event) => {
              const panel = event.currentTarget;
              followStreamRef.current = (
                panel.scrollHeight - panel.scrollTop - panel.clientHeight < 80
              );
            }}
          >
            {!hasStreamContent && (
              <div className="flex min-h-48 flex-col items-center justify-center text-center">
                <Search className="h-6 w-6 text-laplace-border" />
                <p className="mt-3 text-sm font-medium text-[#2C2417]">
                  Waiting for research output
                </p>
                <p className="mt-1 max-w-sm text-sm leading-5 text-laplace-muted">
                  Queries, sources, probability estimates, and report text will appear here.
                </p>
              </div>
            )}

            <div className="space-y-9">
            {streamState.queries.length > 0 && (
              <section aria-labelledby="research-queries-heading">
                <p className="text-xs font-semibold uppercase tracking-widest text-laplace-muted">Research plan</p>
                <h2 id="research-queries-heading" className="mt-1 text-lg font-semibold text-[#2C2417]">
                  Search queries
                </h2>
                <ol className="mt-4 space-y-3">
                  {streamState.queries.map((query, index) => (
                    <li key={query} className="flex gap-3 text-sm leading-6 text-laplace-muted">
                      <span className="mt-0.5 font-semibold tabular-nums text-laplace-sage">
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                      <span>{query}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {streamState.sources.length > 0 && (
              <section aria-labelledby="live-sources-heading">
                <p className="text-xs font-semibold uppercase tracking-widest text-laplace-muted">Evidence collected</p>
                <h2 id="live-sources-heading" className="mt-1 text-lg font-semibold text-[#2C2417]">
                  Reference sources
                </h2>
                <div className="mt-4 divide-y divide-laplace-border border-y border-laplace-border">
                  {streamState.sources.map((source) => (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 py-4 text-left hover:bg-laplace-parchment/50"
                    >
                      <Search className="mt-0.5 h-4 w-4 shrink-0 text-laplace-sage" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[#2C2417]">{source.title}</span>
                        {source.description && (
                          <span className="mt-1 block text-sm leading-5 text-laplace-muted">
                            {source.description}
                          </span>
                        )}
                      </span>
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-laplace-muted" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {streamState.draftOutcomes.length > 0 && (
              <section aria-labelledby="draft-outcomes-heading">
                <p className="text-xs font-semibold uppercase tracking-widest text-laplace-muted">Preliminary model output</p>
                <h2 id="draft-outcomes-heading" className="mt-1 text-lg font-semibold text-[#2C2417]">
                  Draft probabilities
                </h2>
                <div className="mt-5 space-y-5">
                  {streamState.draftOutcomes.map((outcome) => (
                    <div key={outcome.label}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium text-[#2C2417]">{outcome.label}</span>
                        <span className="font-semibold tabular-nums text-laplace-green">
                          {outcome.probability}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-laplace-border">
                        <div
                          className="h-full rounded-full bg-laplace-green transition-[width] duration-700"
                          style={{ width: `${Math.max(1, Math.min(100, outcome.probability))}%` }}
                        />
                      </div>
                      {outcome.rationale && (
                        <p className="mt-2 text-sm leading-5 text-laplace-muted">{outcome.rationale}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {streamState.reportPreview && (
              <section aria-labelledby="report-preview-heading">
                <p className="text-xs font-semibold uppercase tracking-widest text-laplace-muted">Live draft</p>
                <h2 id="report-preview-heading" className="mt-1 text-lg font-semibold text-[#2C2417]">
                  Analysis report
                </h2>
                <div className="prose-report mt-4 border-l-2 border-laplace-sage pl-5 text-sm">
                  <ReactMarkdown>{streamState.reportPreview}</ReactMarkdown>
                </div>
              </section>
            )}

            {!streamAvailable && (
              <p className="flex gap-2 border-t border-laplace-border pt-5 text-sm leading-6 text-amber-700">
                <CircleAlert className="mt-1 h-4 w-4 shrink-0" />
                Live updates are unavailable. Status updates will continue through polling.
              </p>
            )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
