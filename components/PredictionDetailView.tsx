'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { PredictionDetail } from '@/lib/prediction-types';

const confidenceStyles = {
  low: 'bg-red-50 text-red-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-laplace-green/10 text-laplace-sage',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function PredictionDetailView({ prediction }: { prediction: PredictionDetail }) {
  const [expanded, setExpanded] = useState(false);
  const visibleOutcomes = expanded ? prediction.outcomes : prediction.outcomes.slice(0, 6);

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <nav className="mb-5 text-sm text-laplace-muted">
        Trending <span className="mx-2">/</span> {prediction.category}
        <span className="mx-2">/</span>
        <span className="text-[#2C2417]">{prediction.question}</span>
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,0.9fr)]">
        <section className="min-w-0 rounded-lg border border-laplace-border bg-laplace-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#4A7C59,#1B3A2D)] text-white shadow-inner">
                <Gauge className="h-10 w-10" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-laplace-sage">
                  {prediction.category}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-[#2C2417] sm:text-3xl">
                  {prediction.question}
                </h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-laplace-muted">
                  {(prediction as any).dataSource === 'seed' ? (
                    <span className="rounded bg-laplace-border/50 px-1.5 py-0.5 text-[10px] font-medium text-laplace-muted">
                      Estimated
                    </span>
                  ) : (prediction as any).dataSource === 'real' ? (
                    <span className="rounded bg-laplace-green/10 px-1.5 py-0.5 text-[10px] font-medium text-laplace-sage">
                      AI-verified
                    </span>
                  ) : null}
                  <span>Forecast based on multiple information sources · Updated {formatDate(prediction.updatedAt)}</span>
                </p>
              </div>
            </div>

            <div className="w-full rounded-lg border border-laplace-border p-4 lg:w-64">
              <div className="flex items-center gap-2 text-sm font-medium text-laplace-muted">
                <ShieldCheck className="h-4 w-4" /> Overall confidence
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className={`rounded-md px-3 py-1 text-lg font-bold capitalize ${confidenceStyles[prediction.confidence.level]}`}>
                  {prediction.confidence.level}
                </span>
                <span className="text-2xl font-bold text-[#2C2417]">{prediction.confidence.score}</span>
              </div>
              <p className="mt-3 text-sm leading-5 text-laplace-muted">{prediction.confidence.explanation}</p>
            </div>
          </div>

          <div className="mt-8 hidden overflow-x-auto md:block">
            <table className="min-w-[680px]">
              <thead>
                <tr className="border-b border-laplace-border text-left text-xs font-semibold uppercase text-laplace-muted">
                  <th scope="col" className="w-[70px] px-2 pb-3">Rank</th>
                  <th scope="col" className="px-2 pb-3">Outcome</th>
                  <th scope="col" className="w-[48%] px-2 pb-3">Probability</th>
                  <th scope="col" className="w-40 px-2 pb-3 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
              {visibleOutcomes.map((outcome) => {
                const positive = outcome.change >= 0;
                return (
                  <tr key={outcome.id} className="border-b border-laplace-border/60">
                    <td className="px-2 py-4">
                      <span className={`grid h-8 w-8 place-items-center rounded-md font-semibold ${
                        outcome.rank === 1 ? 'bg-amber-100 text-amber-800' : 'bg-laplace-parchment text-laplace-muted'
                      }`}>
                        {outcome.rank}
                      </span>
                    </td>
                    <th scope="row" className="px-2 py-4 text-left">
                        <span className="flex items-center gap-3 font-semibold text-[#2C2417]">
                        {outcome.icon && <span className="text-xl">{outcome.icon}</span>}
                        {outcome.label}
                      </span>
                    </th>
                    <td className="px-2 py-4">
                      <span className="flex items-center gap-4">
                        <strong className="w-16 text-lg text-laplace-sage">{outcome.probability}%</strong>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-laplace-border">
                          <span
                            className="block h-full rounded-full bg-laplace-sage"
                            style={{ width: `${Math.max(2, outcome.probability)}%` }}
                          />
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-4">
                      <span className={`flex items-center justify-end gap-1 font-semibold ${
                        positive ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {positive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                        {Math.abs(outcome.change)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>

          <div className="mt-7 space-y-3 md:hidden">
            {visibleOutcomes.map((outcome) => {
              const positive = outcome.change >= 0;
              return (
                <div key={outcome.id} className="rounded-md border border-laplace-border p-3">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md font-semibold ${
                      outcome.rank === 1 ? 'bg-amber-100 text-amber-800' : 'bg-laplace-parchment text-laplace-muted'
                    }`}>
                      {outcome.rank}
                    </span>
                    {outcome.icon && <span className="text-lg">{outcome.icon}</span>}
                    <span className="min-w-0 flex-1 truncate font-semibold text-[#2C2417]">
                      {outcome.label}
                    </span>
                    <strong className="text-lg text-laplace-sage">{outcome.probability}%</strong>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-laplace-border">
                      <span
                        className="block h-full rounded-full bg-laplace-sage"
                        style={{ width: `${Math.max(2, outcome.probability)}%` }}
                      />
                    </span>
                    <span className={`flex w-16 items-center justify-end gap-1 text-sm font-semibold ${
                      positive ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {positive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      {Math.abs(outcome.change)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {prediction.outcomes.length > 6 && (
            <button
              onClick={() => setExpanded((value) => !value)}
              className="mx-auto mt-6 flex h-11 min-w-72 items-center justify-center gap-2 rounded-md border border-laplace-border font-semibold text-[#2C2417] hover:border-laplace-sage"
            >
              {expanded ? 'Show top outcomes' : `View all (${prediction.outcomes.length} outcomes)`}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}

          <p className="mt-8 border-t border-laplace-border pt-4 text-xs text-laplace-muted">
            Model-estimated probabilities are for reference only and do not constitute investment or decision advice.
          </p>
        </section>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-6">
          <section className="flex max-h-[360px] min-h-0 flex-col overflow-hidden rounded-lg border border-laplace-border bg-laplace-card shadow-sm">
            <div className="shrink-0 border-b border-laplace-border px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-laplace-sage">Evidence</p>
              <h2 className="mt-0.5 text-xl font-bold text-[#2C2417]">Reference sources</h2>
            </div>
            <div
              data-testid="detail-sources-panel"
              className="min-h-0 flex-1 divide-y divide-laplace-border overflow-y-auto px-5"
            >
              {prediction.sources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 py-4"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-laplace-green/10 text-laplace-sage">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold text-[#2C2417] group-hover:text-laplace-sage">
                      {source.title}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-laplace-muted">{source.description}</span>
                  </span>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${confidenceStyles[source.quality]}`}>
                    {source.quality}
                  </span>
                </a>
              ))}
            </div>
          </section>

          <section className="flex max-h-[520px] min-h-0 flex-col overflow-hidden rounded-lg border border-laplace-border bg-laplace-card shadow-sm">
            <div className="flex shrink-0 items-center gap-3 border-b border-laplace-border px-5 py-4">
              <FileText className="h-5 w-5 text-laplace-sage" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-laplace-sage">Forecast</p>
                <h2 className="mt-0.5 text-xl font-bold text-[#2C2417]">Analysis report</h2>
              </div>
            </div>
            <div
              data-testid="detail-report-panel"
              className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
            >
              <h3 className="font-bold text-[#2C2417]">Analysis summary</h3>
              <ul className="mt-4 space-y-3">
                {prediction.summary.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-laplace-muted">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-laplace-green" />
                    {item}
                  </li>
                ))}
              </ul>
              {prediction.report && (
                <div className="mt-6 border-t border-laplace-border pt-5">
                  <h3 className="mb-3 font-bold text-[#2C2417]">Full report</h3>
                  <div className="prose-report text-sm">
                    <ReactMarkdown>{prediction.report}</ReactMarkdown>
                  </div>
                </div>
              )}
              <p className="mt-6 text-xs text-laplace-muted">Updated {formatDate(prediction.updatedAt)}</p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
