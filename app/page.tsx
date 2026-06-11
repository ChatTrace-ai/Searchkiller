'use client';

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
    <main className="min-h-screen bg-[#F8F6F2]">
      {/* Hero — full viewport height, background texture visible in full */}
      <div className="prediction-hero flex min-h-screen flex-col border-b border-laplace-border">
        <PredictionHeader onSubmit={createPrediction} showSearch={false} opaque={false} />

        <div className="flex flex-1 items-center justify-center px-5 pt-0 pb-72">
          <div className="mx-auto w-full max-w-5xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-laplace-sage">
              Evidence-based forecasts
            </p>
            <h1 className="mt-3 font-serif text-4xl font-bold text-[#2C2417] sm:text-5xl lg:text-6xl">
              Search anything you want to predict
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-laplace-muted sm:text-lg">
              Ask about an event and instantly explore forecast probabilities, reference sources,
              and model analysis.
            </p>

            <div className="mx-auto mt-9 max-w-4xl text-left">
              <PredictionSearch onSubmit={createPrediction} />
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <span className="mr-1 text-sm text-laplace-muted">Popular searches:</span>
              {popularSearches.map((item) => (
                <button
                  key={item.label}
                  onClick={() => createPrediction(item.question)}
                  className="rounded-full border border-laplace-border bg-laplace-card/80 px-4 py-2 text-sm font-medium text-laplace-muted shadow-sm hover:border-laplace-sage hover:text-laplace-green transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cards — warmer white to contrast with hero */}
      <section id="popular-predictions" className="scroll-mt-6 bg-[#F8F6F2]">
        <div className="mx-auto max-w-[1500px] px-5 py-12 lg:px-8">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#2C2417]">Popular predictions</h2>
              <p className="mt-1 text-laplace-muted">See what everyone is predicting</p>
            </div>
            <span className="hidden items-center gap-2 text-sm font-semibold text-laplace-muted sm:flex">
              8 predictions per page
            </span>
          </div>
          <PaginatedPredictionGrid {...pagination} />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
