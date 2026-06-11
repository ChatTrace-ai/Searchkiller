import type {
  ConfidenceLevel,
  PredictionDetail,
  PredictionListResponse,
  PredictionProgress,
  PredictionStatus,
  PredictionSummary,
} from '@/lib/prediction-types';

interface PredictionSeed {
  id: string;
  question: string;
  category: string;
  icon: string;
  outcomes: Array<{ label: string; probability: number; icon?: string }>;
}

interface StoredPrediction {
  normalizedQuestion: string;
  status: PredictionStatus;
  detail: PredictionDetail;
  expiresAt: number;
  featured: boolean;
  readyAt?: number;
}

const MOCK_UPDATED_AT = '2026-06-11T08:00:00.000Z';
const MOCK_CREATED_AT = '2026-06-11T07:55:00.000Z';
const GENERATION_DELAY_MS = 2_000;
const RESULT_TTL_MS = 24 * 60 * 60 * 1_000;

const seeds: PredictionSeed[] = [
  { id: 'world-cup-2026', question: 'Who will win the 2026 FIFA World Cup?', category: 'Sports', icon: 'trophy', outcomes: [{ label: 'Spain', probability: 16.4, icon: '🇪🇸' }, { label: 'France', probability: 16.1, icon: '🇫🇷' }, { label: 'England', probability: 10.8, icon: '🏴' }] },
  { id: 'nba-2027', question: 'Who will win the 2027 NBA championship?', category: 'Sports', icon: 'circle-dot', outcomes: [{ label: 'Oklahoma City Thunder', probability: 24 }, { label: 'Boston Celtics', probability: 19 }, { label: 'Denver Nuggets', probability: 14 }] },
  { id: 'bitcoin-week', question: 'Will Bitcoin finish higher this week?', category: 'Crypto', icon: 'bitcoin', outcomes: [{ label: 'Up', probability: 61 }, { label: 'Down', probability: 39 }] },
  { id: 'us-house-2026', question: 'Which party will control the US House after 2026?', category: 'Politics', icon: 'landmark', outcomes: [{ label: 'Democratic Party', probability: 53 }, { label: 'Republican Party', probability: 47 }] },
  { id: 'fed-july-2026', question: 'Will the Federal Reserve cut rates by July 2026?', category: 'Economy', icon: 'badge-dollar-sign', outcomes: [{ label: 'Yes', probability: 58 }, { label: 'No', probability: 42 }] },
  { id: 'iphone-18-sales', question: 'Will iPhone 18 launch sales exceed iPhone 17?', category: 'Technology', icon: 'smartphone', outcomes: [{ label: 'Yes', probability: 64 }, { label: 'No', probability: 36 }] },
  { id: 'ai-model-2026', question: 'Which lab will lead frontier AI benchmarks at year end?', category: 'Technology', icon: 'brain-circuit', outcomes: [{ label: 'Google DeepMind', probability: 34 }, { label: 'OpenAI', probability: 31 }, { label: 'Anthropic', probability: 20 }] },
  { id: 'champions-league-2027', question: 'Who will win the 2027 UEFA Champions League?', category: 'Sports', icon: 'trophy', outcomes: [{ label: 'Real Madrid', probability: 18 }, { label: 'Manchester City', probability: 16 }, { label: 'Bayern Munich', probability: 12 }] },
  { id: 'ethereum-5000', question: 'Will Ethereum trade above $5,000 in 2026?', category: 'Crypto', icon: 'chart-no-axes-combined', outcomes: [{ label: 'Yes', probability: 46 }, { label: 'No', probability: 54 }] },
  { id: 'sp500-year', question: 'Will the S&P 500 finish 2026 higher?', category: 'Markets', icon: 'chart-candlestick', outcomes: [{ label: 'Higher', probability: 67 }, { label: 'Lower', probability: 33 }] },
  { id: 'oil-100', question: 'Will Brent crude exceed $100 before 2027?', category: 'Markets', icon: 'fuel', outcomes: [{ label: 'Yes', probability: 38 }, { label: 'No', probability: 62 }] },
  { id: 'tesla-deliveries', question: 'Will Tesla deliveries grow year over year in 2026?', category: 'Business', icon: 'car-front', outcomes: [{ label: 'Yes', probability: 55 }, { label: 'No', probability: 45 }] },
  { id: 'oscars-picture', question: 'Which film will win the next Best Picture Oscar?', category: 'Culture', icon: 'clapperboard', outcomes: [{ label: 'Film A', probability: 27 }, { label: 'Film B', probability: 21 }, { label: 'Film C', probability: 16 }] },
  { id: 'formula-one-2026', question: 'Who will win the 2026 Formula One drivers title?', category: 'Sports', icon: 'flag-triangle-right', outcomes: [{ label: 'Max Verstappen', probability: 31 }, { label: 'Lando Norris', probability: 26 }, { label: 'Charles Leclerc', probability: 18 }] },
  { id: 'wimbledon-men-2026', question: "Who will win the 2026 Wimbledon men's title?", category: 'Sports', icon: 'medal', outcomes: [{ label: 'Carlos Alcaraz', probability: 34 }, { label: 'Jannik Sinner', probability: 32 }, { label: 'Novak Djokovic', probability: 12 }] },
  { id: 'wimbledon-women-2026', question: "Who will win the 2026 Wimbledon women's title?", category: 'Sports', icon: 'medal', outcomes: [{ label: 'Aryna Sabalenka', probability: 24 }, { label: 'Iga Swiatek', probability: 22 }, { label: 'Coco Gauff', probability: 17 }] },
  { id: 'mars-launch-2026', question: 'Will a crewed Mars mission launch before 2030?', category: 'Science', icon: 'rocket', outcomes: [{ label: 'Yes', probability: 18 }, { label: 'No', probability: 82 }] },
  { id: 'fusion-2030', question: 'Will commercial fusion deliver grid power before 2030?', category: 'Science', icon: 'atom', outcomes: [{ label: 'Yes', probability: 14 }, { label: 'No', probability: 86 }] },
  { id: 'global-temperature-2026', question: 'Will 2026 be the hottest year on record?', category: 'Climate', icon: 'thermometer-sun', outcomes: [{ label: 'Yes', probability: 57 }, { label: 'No', probability: 43 }] },
  { id: 'ev-share-2027', question: 'Will EVs exceed 25% of global new car sales in 2027?', category: 'Business', icon: 'battery-charging', outcomes: [{ label: 'Yes', probability: 63 }, { label: 'No', probability: 37 }] },
  { id: 'japan-inflation', question: 'Will Japan inflation remain above 2% through 2026?', category: 'Economy', icon: 'japanese-yen', outcomes: [{ label: 'Yes', probability: 59 }, { label: 'No', probability: 41 }] },
  { id: 'euro-dollar', question: 'Will the euro finish 2026 above 1.15 US dollars?', category: 'Markets', icon: 'badge-euro', outcomes: [{ label: 'Yes', probability: 44 }, { label: 'No', probability: 56 }] },
  { id: 'gold-3000', question: 'Will gold remain above $3,000 at year end?', category: 'Markets', icon: 'gem', outcomes: [{ label: 'Yes', probability: 62 }, { label: 'No', probability: 38 }] },
  { id: 'india-growth', question: 'Will India GDP growth exceed 7% in 2026?', category: 'Economy', icon: 'trending-up', outcomes: [{ label: 'Yes', probability: 52 }, { label: 'No', probability: 48 }] },
  { id: 'streaming-winner', question: 'Which streaming service will add the most subscribers?', category: 'Business', icon: 'tv', outcomes: [{ label: 'Netflix', probability: 43 }, { label: 'Disney+', probability: 23 }, { label: 'Prime Video', probability: 17 }] },
  { id: 'game-awards', question: 'Which game will win the next Game of the Year award?', category: 'Culture', icon: 'gamepad-2', outcomes: [{ label: 'Game A', probability: 29 }, { label: 'Game B', probability: 24 }, { label: 'Game C', probability: 15 }] },
  { id: 'grammy-album', question: 'Who will win the next Grammy for Album of the Year?', category: 'Culture', icon: 'music-2', outcomes: [{ label: 'Artist A', probability: 26 }, { label: 'Artist B', probability: 22 }, { label: 'Artist C', probability: 18 }] },
  { id: 'premier-league-2027', question: 'Who will win the 2026-27 Premier League?', category: 'Sports', icon: 'trophy', outcomes: [{ label: 'Manchester City', probability: 24 }, { label: 'Arsenal', probability: 22 }, { label: 'Liverpool', probability: 18 }] },
  { id: 'super-bowl-2027', question: 'Who will win Super Bowl LXI?', category: 'Sports', icon: 'trophy', outcomes: [{ label: 'Kansas City Chiefs', probability: 16 }, { label: 'Philadelphia Eagles', probability: 14 }, { label: 'Buffalo Bills', probability: 12 }] },
  { id: 'cloud-leader', question: 'Which cloud provider will grow fastest in 2026?', category: 'Technology', icon: 'cloud', outcomes: [{ label: 'Microsoft Azure', probability: 38 }, { label: 'Google Cloud', probability: 33 }, { label: 'AWS', probability: 21 }] },
  { id: 'robotaxi-city', question: 'Which city will see the fastest robotaxi expansion?', category: 'Technology', icon: 'car-taxi-front', outcomes: [{ label: 'San Francisco', probability: 32 }, { label: 'Austin', probability: 28 }, { label: 'Beijing', probability: 23 }] },
  { id: 'solar-growth', question: 'Will global solar installations set a new record in 2026?', category: 'Climate', icon: 'sun', outcomes: [{ label: 'Yes', probability: 79 }, { label: 'No', probability: 21 }] },
];

const sourceTemplates = [
  {
    id: 'source-1',
    title: 'Recent News Coverage',
    description: 'Current reporting and verified announcements relevant to the forecast.',
    url: 'https://news.google.com/',
    quality: 'high' as ConfidenceLevel,
    publishedAt: '2026-06-10T00:00:00.000Z',
  },
  {
    id: 'source-2',
    title: 'Historical Performance Data',
    description: 'Recent results, long-run trends, and comparable historical outcomes.',
    url: 'https://ourworldindata.org/',
    quality: 'high' as ConfidenceLevel,
    publishedAt: '2026-06-09T00:00:00.000Z',
  },
  {
    id: 'source-3',
    title: 'Market and Expert Signals',
    description: 'Aggregated expectations from markets, analysts, and domain experts.',
    url: 'https://www.reuters.com/',
    quality: 'medium' as ConfidenceLevel,
    publishedAt: '2026-06-10T00:00:00.000Z',
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function buildDetail(seed: PredictionSeed, now = MOCK_UPDATED_AT): PredictionDetail {
  const listedTotal = seed.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  const completeOutcomes = [...seed.outcomes];

  if (listedTotal < 99.9) {
    completeOutcomes.push({
      label: 'Other outcomes',
      probability: Number((100 - listedTotal).toFixed(1)),
      icon: '•',
    });
  }

  const outcomes = completeOutcomes
    .sort((a, b) => b.probability - a.probability)
    .map((outcome, index) => ({
      id: slugify(outcome.label) || `outcome-${index + 1}`,
      rank: index + 1,
      label: outcome.label,
      icon: outcome.icon,
      probability: outcome.probability,
      change: Number((((index % 2 === 0 ? 1 : -1) * (index + 1)) / 10).toFixed(1)),
      rationale: `${outcome.label} reflects the current balance of recent performance, historical evidence, and market expectations.`,
      sourceIds: ['source-1', 'source-2', 'source-3'],
    }));
  const probabilityTotal = outcomes.reduce(
    (sum, outcome) => sum + outcome.probability,
    0,
  );
  if (Math.abs(probabilityTotal - 100) > 0.1) {
    throw new Error(`Prediction probabilities must total 100, got ${probabilityTotal}`);
  }

  return {
    id: seed.id,
    question: seed.question,
    category: seed.category,
    icon: seed.icon,
    status: 'completed',
    confidence: {
      level: 'high',
      score: 82,
      explanation: 'Stable signals across multiple independent information sources.',
    },
    outcomes,
    sources: sourceTemplates,
    summary: [
      `${outcomes[0].label} currently has the highest estimated probability at ${outcomes[0].probability}%.`,
      'The forecast combines recent developments, historical performance, and market expectations.',
      'Probabilities can change quickly when new evidence becomes available.',
    ],
    report: `## Forecast analysis\n\n${outcomes[0].label} currently leads this forecast at **${outcomes[0].probability}%**. The estimate combines recent reporting, historical performance, and market signals.\n\n## Key uncertainty\n\nThis forecast is a model estimate rather than a certainty. Material news, injuries, policy changes, or market repricing may alter the ranking.`,
    createdAt: MOCK_CREATED_AT,
    updatedAt: now,
  };
}

function toSummary(record: StoredPrediction): PredictionSummary {
  const { detail } = record;
  return {
    id: detail.id,
    question: detail.question,
    category: detail.category,
    icon: detail.icon,
    status: record.status,
    topOutcomes: detail.outcomes.slice(0, 3).map(({ label, probability, icon }) => ({
      label,
      probability,
      icon,
    })),
    updatedAt: detail.updatedAt,
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

export function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      offset?: unknown;
    };
    if (!Number.isInteger(parsed.offset) || Number(parsed.offset) < 0) {
      throw new Error('Invalid offset');
    }
    return Number(parsed.offset);
  } catch {
    throw new Error('INVALID_CURSOR');
  }
}

function createCustomDetail(id: string, question: string): PredictionDetail {
  return buildDetail({
    id,
    question,
    category: 'General',
    icon: 'sparkles',
    outcomes: [
      { label: 'Yes / primary outcome', probability: 56 },
      { label: 'No / alternative outcome', probability: 44 },
    ],
  }, new Date().toISOString());
}

const records = new Map<string, StoredPrediction>(
  seeds.map((seed) => {
    const detail = buildDetail(seed);
    return [
      seed.id,
      {
        normalizedQuestion: normalizeQuestion(seed.question),
        status: 'completed' as const,
        detail,
        expiresAt: Number.POSITIVE_INFINITY,
        featured: true,
      },
    ];
  }),
);

function resolveRecord(record: StoredPrediction): StoredPrediction {
  if (record.status === 'processing' && record.readyAt && Date.now() >= record.readyAt) {
    record.status = 'completed';
    record.readyAt = undefined;
    record.detail = {
      ...record.detail,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };
  }
  return record;
}

export function listPopularPredictions(options: {
  offset: number;
  limit: number;
  category?: string | null;
}): PredictionListResponse {
  const category = options.category?.trim().toLowerCase();
  const available = [...records.values()]
    .map(resolveRecord)
    .filter((record) => record.featured)
    .filter((record) => !category || record.detail.category.toLowerCase() === category)
    .map(toSummary);

  const items = available.slice(options.offset, options.offset + options.limit);
  const nextOffset = options.offset + items.length;
  const hasMore = nextOffset < available.length;

  return {
    items,
    nextCursor: hasMore ? encodeCursor(nextOffset) : null,
    hasMore,
  };
}

export function createPrediction(question: string): {
  id: string;
  status: PredictionStatus;
  reused: boolean;
} {
  const normalizedQuestion = normalizeQuestion(question);
  const now = Date.now();

  for (const record of records.values()) {
    resolveRecord(record);
    if (record.normalizedQuestion === normalizedQuestion && record.expiresAt > now) {
      return { id: record.detail.id, status: record.status, reused: true };
    }
  }

  const id = `pred_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  records.set(id, {
    normalizedQuestion,
    status: 'processing',
    detail: createCustomDetail(id, question),
    expiresAt: now + RESULT_TTL_MS,
    featured: false,
    readyAt: now + GENERATION_DELAY_MS,
  });

  return { id, status: 'processing', reused: false };
}

export function getPrediction(
  id: string,
): PredictionDetail | PredictionProgress | null {
  const record = records.get(id);
  if (!record) return null;

  resolveRecord(record);
  if (record.status === 'processing') {
    return {
      id: record.detail.id,
      question: record.detail.question,
      status: 'processing',
      progress: {
        stage: 'collecting_sources',
        message: 'Collecting reference sources',
      },
      updatedAt: record.detail.updatedAt,
    };
  }

  return { ...record.detail, status: record.status };
}

export function refreshPrediction(id: string):
  | { status: 'started' }
  | { status: 'in_progress' }
  | { status: 'not_found' } {
  const record = records.get(id);
  if (!record) return { status: 'not_found' };

  resolveRecord(record);
  if (record.status === 'processing') return { status: 'in_progress' };

  const now = Date.now();
  record.status = 'processing';
  record.readyAt = now + GENERATION_DELAY_MS;
  record.expiresAt = record.featured
    ? Number.POSITIVE_INFINITY
    : now + RESULT_TTL_MS;
  record.detail = {
    ...record.detail,
    status: 'processing',
    updatedAt: new Date(now).toISOString(),
  };
  return { status: 'started' };
}
