import Exa from 'exa-js';
import type { Source } from './schemas';

let _exa: Exa | null = null;

function getExa(): Exa {
  if (!_exa) {
    _exa = new Exa(process.env.EXA_API_KEY!);
  }
  return _exa;
}

export async function semanticSearch(queries: string[]): Promise<Source[]> {
  const exa = getExa();
  const results = await Promise.all(
    queries.map((q) =>
      exa.searchAndContents(q, {
        type: 'neural',
        useAutoprompt: true,
        numResults: 3,
        text: true,
      })
    )
  );

  const seen = new Set<string>();
  const sources: Source[] = [];

  for (const result of results) {
    for (const r of result.results) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      sources.push({
        title: r.title || 'Untitled',
        url: r.url,
        text: (r.text || '').substring(0, 3000),
      });
    }
  }

  return sources;
}
