'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'laplace-recent-searches';
const MAX_ITEMS = 8;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days

export interface RecentSearch {
  id: string;
  question: string;
  timestamp: number;
}

function readFromStorage(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as RecentSearch[];
    const cutoff = Date.now() - MAX_AGE_MS;
    return items.filter((item) => item.timestamp > cutoff);
  } catch {
    return [];
  }
}

function writeToStorage(items: RecentSearch[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {}
}

export function addRecentSearch(id: string, question: string): void {
  const existing = readFromStorage().filter((item) => item.id !== id);
  const updated: RecentSearch[] = [{ id, question, timestamp: Date.now() }, ...existing];
  writeToStorage(updated);
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    setSearches(readFromStorage());
  }, []);

  const refresh = useCallback(() => {
    setSearches(readFromStorage());
  }, []);

  return { searches, refresh };
}
