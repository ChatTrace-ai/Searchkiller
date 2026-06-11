import Exa from 'exa-js';
import type { ISearchProvider, Source } from './schemas';

let _exa: Exa | null = null;

function getExa(): Exa {
  if (!_exa) {
    _exa = new Exa(process.env.EXA_API_KEY!);
  }
  return _exa;
}

export class ExaProvider implements ISearchProvider {
  name = 'exa';

  async search(queries: string[]): Promise<Source[]> {
    const exa = getExa();
    const results = await Promise.all(
      queries.map((q) =>
        exa.searchAndContents(q, {
          type: 'neural',
          useAutoprompt: true,
          numResults: 3,
          text: true,
        }),
      ),
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
          origin: 'exa',
        });
      }
    }

    return sources;
  }
}

export class GoogleProvider implements ISearchProvider {
  name = 'google';

  async search(_queries: string[]): Promise<Source[]> {
    return [];
  }
}

export function getActiveProviders(): ISearchProvider[] {
  const providers: ISearchProvider[] = [new ExaProvider()];

  if (process.env.GOOGLE_SEARCH_API_KEY) {
    providers.push(new GoogleProvider());
  }

  return providers;
}
