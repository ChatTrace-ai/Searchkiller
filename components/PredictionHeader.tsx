'use client';

import { BrandMark } from './BrandMark';
import { PredictionSearch } from './PredictionSearch';

export function PredictionHeader({
  onSubmit,
  showSearch = true,
  opaque = true,
}: {
  onSubmit: (question: string) => Promise<void> | void;
  showSearch?: boolean;
  opaque?: boolean;
}) {
  return (
    <header className={opaque ? 'bg-laplace-parchment' : 'bg-transparent'}>
        <div className="flex h-28 w-full items-center gap-5 pl-4 pr-8 lg:pr-12">
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
