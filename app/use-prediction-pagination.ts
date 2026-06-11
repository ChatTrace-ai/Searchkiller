'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PredictionListResponse, PredictionSummary } from '@/lib/prediction-types';

export function usePredictionPagination() {
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
      const params = new URLSearchParams({ limit: '8' });
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
  }, [load]);

  const goToPage = useCallback((targetPage: number) => {
    if (targetPage < 1 || loadingRef.current) return;
    const cursor = pageCursors[targetPage - 1];
    if (cursor === undefined) return;
    load(targetPage, cursor, true);
  }, [load, pageCursors]);

  const goNext = useCallback(() => {
    if (hasMore && nextCursor) {
      load(page + 1, nextCursor, true);
    }
  }, [hasMore, load, nextCursor, page]);

  const retry = useCallback(() => {
    const cursor = pageCursors[page - 1];
    if (cursor !== undefined) load(page, cursor);
  }, [load, page, pageCursors]);

  return {
    items,
    page,
    hasMore,
    loading,
    error,
    goToPage,
    goNext,
    retry,
  };
}
