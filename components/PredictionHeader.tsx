'use client';

import { BrandMark } from './BrandMark';
import { PredictionSearch } from './PredictionSearch';

export function PredictionHeader({
  onSubmit,
}: {
  onSubmit: (question: string) => Promise<void> | void;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-20 max-w-[1500px] items-center gap-5 px-5 lg:px-8">
        <BrandMark />
        <div className="ml-auto hidden w-full max-w-3xl sm:block">
          <PredictionSearch compact onSubmit={onSubmit} />
        </div>
      </div>
    </header>
  );
}
