'use client';

import { BrandMark } from './BrandMark';
import { PredictionSearch } from './PredictionSearch';

export function PredictionHeader({
  onSubmit,
  showSearch = true,
}: {
  onSubmit: (question: string) => Promise<void> | void;
  showSearch?: boolean;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-20 max-w-[1500px] items-center gap-5 px-5 lg:px-8">
        <BrandMark />
        {showSearch && (
          <div className="ml-auto hidden w-full max-w-3xl sm:block">
            <PredictionSearch compact onSubmit={onSubmit} />
          </div>
        )}
      </div>
    </header>
  );
}
