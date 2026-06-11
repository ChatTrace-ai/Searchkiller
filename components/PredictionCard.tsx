import Link from 'next/link';
import {
  Atom,
  BadgeDollarSign,
  BadgeEuro,
  BatteryCharging,
  Bitcoin,
  BrainCircuit,
  CarFront,
  CarTaxiFront,
  ChartCandlestick,
  ChartNoAxesCombined,
  CircleDot,
  Clapperboard,
  Cloud,
  FlagTriangleRight,
  Fuel,
  Gamepad2,
  Gem,
  JapaneseYen,
  Landmark,
  Medal,
  Music2,
  Rocket,
  Smartphone,
  Sparkles,
  Sun,
  ThermometerSun,
  TrendingUp,
  Trophy,
  Tv,
} from 'lucide-react';
import type { PredictionSummary } from '@/lib/prediction-types';

const icons: Record<string, typeof Sparkles> = {
  trophy: Trophy,
  bitcoin: Bitcoin,
  'circle-dot': CircleDot,
  landmark: Landmark,
  'badge-dollar-sign': BadgeDollarSign,
  'badge-euro': BadgeEuro,
  'brain-circuit': BrainCircuit,
  'chart-no-axes-combined': ChartNoAxesCombined,
  'chart-candlestick': ChartCandlestick,
  'car-front': CarFront,
  'car-taxi-front': CarTaxiFront,
  'battery-charging': BatteryCharging,
  'flag-triangle-right': FlagTriangleRight,
  'thermometer-sun': ThermometerSun,
  'japanese-yen': JapaneseYen,
  'gamepad-2': Gamepad2,
  'music-2': Music2,
  'trending-up': TrendingUp,
  rocket: Rocket,
  atom: Atom,
  cloud: Cloud,
  clapperboard: Clapperboard,
  fuel: Fuel,
  gem: Gem,
  medal: Medal,
  smartphone: Smartphone,
  sun: Sun,
  tv: Tv,
  sparkles: Sparkles,
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
      className="group flex min-h-72 flex-col rounded-xl border border-laplace-border bg-laplace-card p-5 shadow-[0_4px_16px_rgba(44,36,23,0.04)] transition hover:-translate-y-0.5 hover:border-laplace-sage hover:shadow-[0_10px_28px_rgba(74,124,89,0.12)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-laplace-border/60 text-laplace-sage">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-laplace-sage">
            {prediction.category}
          </p>
          <h3 className="mt-1 line-clamp-2 font-semibold leading-5 text-[#2C2417]">
            {prediction.question}
          </h3>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {prediction.topOutcomes.map((outcome, index) => (
          <div key={`${outcome.label}-${index}`}>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-5 text-laplace-muted">{index + 1}</span>
              {outcome.icon && <span className="text-base">{outcome.icon}</span>}
              <span className="min-w-0 flex-1 truncate text-[#3A3020]">{outcome.label}</span>
              <span className="font-semibold text-laplace-sage">{outcome.probability}%</span>
            </div>
            <div className="ml-7 mt-1.5 h-1.5 overflow-hidden rounded-full bg-laplace-border">
              <span
                className="block h-full rounded-full bg-laplace-sage"
                style={{ width: `${Math.max(2, outcome.probability)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between pt-5">
        {prediction.dataSource === 'seed' ? (
          <span className="rounded bg-laplace-border/50 px-1.5 py-0.5 text-[10px] font-medium text-laplace-muted">
            Estimated
          </span>
        ) : (
          <span className="rounded bg-laplace-green/10 px-1.5 py-0.5 text-[10px] font-medium text-laplace-sage">
            AI-verified
          </span>
        )}
        <p className="text-right text-xs text-laplace-muted">
          Updated {relativeTime(prediction.updatedAt)}
        </p>
      </div>
    </Link>
  );
}
