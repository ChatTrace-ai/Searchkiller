'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function useCreatePrediction() {
  const router = useRouter();

  return useCallback(async (question: string) => {
    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error?.message || 'Prediction could not be created.');
    }
    router.push(`/prediction/${body.id}`);
  }, [router]);
}
