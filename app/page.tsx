'use client';

import { ArrowRight } from 'lucide-react';
import { PaginatedPredictionGrid } from '@/components/PaginatedPredictionGrid';
import { PredictionHeader } from '@/components/PredictionHeader';
import { PredictionSearch } from '@/components/PredictionSearch';
import { SiteFooter } from '@/components/SiteFooter';
import { useCreatePrediction } from './use-create-prediction';
import { usePredictionPagination } from './use-prediction-pagination';

const popularSearches = [
  { label: 'World Cup winner', question: 'Who will win the 2026 FIFA World Cup?' },
  { label: 'Bitcoin this week', question: 'Will Bitcoin finish higher this week?' },
  { label: 'Federal Reserve rate cut', question: 'Will the Federal Reserve cut rates by July 2026?' },
  { label: 'Premier League champion', question: 'Who will win the 2026-27 Premier League?' },
];

export default function HomePage() {
  const createPrediction = useCreatePrediction();
  const pagination = usePredictionPagination();

  return (
    <main className="min-h-screen bg-white">
      <PredictionHeader onSubmit={createPrediction} showSearch={false} />

      <section className="prediction-hero border-b border-slate-100">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
          <p className="text-sm font-semibold uppercase text-blue-600">Evidence-based forecasts</p>
          <h1 className="mt-3 text-4xl font-bold text-gray-950 sm:text-5xl">
            Search anything you want to predict
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Ask about an event and instantly explore forecast probabilities, reference sources, and model analysis.
          </p>

          <div className="mx-auto mt-9 max-w-4xl text-left">
            <PredictionSearch onSubmit={createPrediction} />
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-sm text-slate-500">Popular searches:</span>
            {popularSearches.map((item) => (
              <button
                key={item.label}
                onClick={() => createPrediction(item.question)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm hover:border-blue-300"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="popular-predictions" className="mx-auto max-w-[1500px] scroll-mt-6 px-5 py-12 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950">Popular predictions</h2>
            <p className="mt-1 text-slate-500">See what everyone is predicting</p>
          </div>
          <span className="hidden items-center gap-2 text-sm font-semibold text-blue-600 sm:flex">
            16 predictions per page <ArrowRight className="h-4 w-4 rotate-90" />
          </span>
        </div>
        <PaginatedPredictionGrid {...pagination} />
      </section>
      <SiteFooter />
    </main>
  );
}
