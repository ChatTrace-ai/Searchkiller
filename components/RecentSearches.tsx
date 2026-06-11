'use client';

import { Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { RecentSearch } from '@/app/use-recent-searches';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1_000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentSearches({ searches }: { searches: RecentSearch[] }) {
  if (searches.length === 0) return null;

  return (
    <section className="bg-[#F8F6F2]">
      <div className="mx-auto max-w-[1500px] px-5 py-10 lg:px-8">
        <div className="mb-5 flex items-center gap-2">
          <Clock className="h-4 w-4 text-laplace-sage" />
          <h2 className="text-lg font-semibold text-[#2C2417]">Your recent searches</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {searches.map((item) => (
            <Link
              key={item.id}
              href={`/prediction/${item.id}`}
              className="group flex min-w-[260px] max-w-[340px] shrink-0 flex-col justify-between rounded-lg border border-laplace-border bg-laplace-card p-4 shadow-sm transition-all hover:border-laplace-sage hover:shadow-md"
            >
              <p className="line-clamp-2 text-sm font-medium leading-snug text-[#2C2417] group-hover:text-laplace-green">
                {item.question}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-laplace-muted">{timeAgo(item.timestamp)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-laplace-muted transition-transform group-hover:translate-x-1 group-hover:text-laplace-sage" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
