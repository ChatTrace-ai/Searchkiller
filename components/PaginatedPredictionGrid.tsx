'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PredictionListResponse, PredictionSummary } from '@/lib/prediction-types';
import { PredictionCard } from './PredictionCard';

function CardSkeleton() {
  return (
    <div className="min-h-72 animate-pulse rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex gap-3">
        <div className="h-12 w-12 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-slate-100" />
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-3/4 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-7 space-y-4">
        <div className="h-4 rounded bg-slate-100" />
        <div className="h-4 rounded bg-slate-100" />
        <div className="h-4 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function PaginatedPredictionGrid() {
  const [items, setItems] = useState<PredictionSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<Array<string | null>>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (
    targetPage: number,
    cursor: string | null,
    scrollToGrid = false,
  ) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: '16' });
      if (cursor) params.set('cursor', cursor);
      const response = await fetch(`/api/predictions/popular?${params}`);
      const body = (await response.json()) as PredictionListResponse & {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(body.error?.message || 'Could not load predictions.');

      setItems(body.items);
      setPage(targetPage);
      setNextCursor(body.nextCursor);
      setHasMore(body.hasMore);
      if (body.nextCursor) {
        setPageCursors((current) => {
          const updated = [...current];
          updated[targetPage] = body.nextCursor;
          return updated;
        });
      }
      if (scrollToGrid) {
        document.getElementById('popular-predictions')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load predictions.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, null);
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToPage = (targetPage: number) => {
    if (targetPage < 1 || loading) return;
    const cursor = pageCursors[targetPage - 1];
    if (cursor === undefined) return;
    load(targetPage, cursor, true);
  };

  const goNext = () => {
    if (hasMore && nextCursor) {
      load(page + 1, nextCursor, true);
    }
  };

  const availablePages = hasMore ? [page, page + 1] : Array.from(
    { length: page },
    (_, index) => index + 1,
  );

  useEffect(() => {
    if (page === 1 && pageCursors.length === 1 && nextCursor) {
      setPageCursors([null, nextCursor]);
    }
  }, [nextCursor, page, pageCursors.length]);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((prediction) => (
          <PredictionCard key={prediction.id} prediction={prediction} />
        ))}
        {loading && Array.from({ length: 16 }, (_, index) => (
          <CardSkeleton key={`skeleton-${index}`} />
        ))}
      </div>

      <div className="flex min-h-24 items-center justify-center">
        {error && (
          <button
            onClick={() => goToPage(page)}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
          >
            Retry loading predictions
          </button>
        )}
        {!error && items.length > 0 && (
          <nav aria-label="Prediction pages" className="flex items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1 || loading}
              aria-label="Previous page"
              className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {availablePages.map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => pageNumber === page ? undefined : goToPage(pageNumber)}
                disabled={loading}
                aria-current={pageNumber === page ? 'page' : undefined}
                className={`h-10 min-w-10 rounded-md border px-3 text-sm font-semibold ${
                  pageNumber === page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              onClick={goNext}
              disabled={!hasMore || loading}
              aria-label="Next page"
              className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        )}
      </div>
    </>
  );
}
