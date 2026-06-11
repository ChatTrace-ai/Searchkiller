'use client';

import { FormEvent, useState } from 'react';
import { Search } from 'lucide-react';

interface PredictionSearchProps {
  initialValue?: string;
  compact?: boolean;
  onSubmit: (question: string) => Promise<void> | void;
}

export function PredictionSearch({
  initialValue = '',
  compact = false,
  onSubmit,
}: PredictionSearchProps) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const question = value.trim();
    if (question.length < 5 || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(question);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className={`flex items-center border border-slate-200 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 ${
        compact ? 'h-12 rounded-md' : 'h-16 rounded-lg'
      }`}
    >
      <Search className={`ml-5 shrink-0 text-slate-500 ${compact ? 'h-5 w-5' : 'h-6 w-6'}`} />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={
          compact
            ? 'Search anything you want to predict...'
            : 'For example: Who will win the 2026 FIFA World Cup?'
        }
        aria-label={compact ? 'Global prediction search' : 'Prediction question'}
        className={`min-w-0 flex-1 bg-transparent px-4 text-gray-900 outline-none placeholder:text-slate-400 ${
          compact ? 'text-sm' : 'text-base sm:text-lg'
        }`}
      />
      {!compact && (
        <button
          type="submit"
          disabled={value.trim().length < 5 || submitting}
          className="mr-2 h-12 min-w-28 rounded-md bg-blue-600 px-5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Starting...' : 'Predict'}
        </button>
      )}
    </form>
  );
}
