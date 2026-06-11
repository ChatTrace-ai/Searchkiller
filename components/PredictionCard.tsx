import Link from 'next/link';
import {
  Atom,
  BadgeDollarSign,
  Bitcoin,
  BrainCircuit,
  ChartNoAxesCombined,
  CircleDot,
  Cloud,
  Landmark,
  Rocket,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { PredictionSummary } from '@/lib/prediction-types';

const icons = {
  trophy: Trophy,
  bitcoin: Bitcoin,
  'circle-dot': CircleDot,
  landmark: Landmark,
  'badge-dollar-sign': BadgeDollarSign,
  'brain-circuit': BrainCircuit,
  'chart-no-axes-combined': ChartNoAxesCombined,
  rocket: Rocket,
  atom: Atom,
  cloud: Cloud,
};

function relativeTime(value: string) {
  const hours = Math.max(
    1,
    Math.round((Date.now() - new Date(value).getTime()) / 3_600_000),
  );
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export function PredictionCard({ prediction }: { prediction: PredictionSummary }) {
  const Icon = icons[prediction.icon as keyof typeof icons] || Sparkles;

  return (
    <Link
      href={`/prediction/${prediction.id}`}
      className="group flex min-h-72 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_14px_34px_rgba(37,99,235,0.1)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-blue-600">{prediction.category}</p>
          <h3 className="mt-1 line-clamp-2 font-semibold leading-5 text-gray-950">
            {prediction.question}
          </h3>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {prediction.topOutcomes.map((outcome, index) => (
          <div key={`${outcome.label}-${index}`}>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-5 text-slate-400">{index + 1}</span>
              <span className="text-base">{outcome.icon || '•'}</span>
              <span className="min-w-0 flex-1 truncate text-slate-700">{outcome.label}</span>
              <span className="font-semibold text-blue-600">{outcome.probability}%</span>
            </div>
            <div className="ml-7 mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-blue-500"
                style={{ width: `${Math.max(2, outcome.probability)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-auto pt-5 text-right text-xs text-slate-400">
        Updated {relativeTime(prediction.updatedAt)}
      </p>
    </Link>
  );
}
