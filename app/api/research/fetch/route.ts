import { semanticSearch } from '@/lib/exa';
import { hybridSearch } from '@/lib/elasticsearch';
import { contextCache } from '@/lib/context-cache';
import type { ResearchContext } from '@/lib/schemas';

export async function POST(req: Request) {
  const { keyword, subQueries } = await req.json();

  if (!keyword || !subQueries?.length) {
    return Response.json({ error: 'keyword and subQueries are required' }, { status: 400 });
  }

  const [exaSources, esSources] = await Promise.all([
    semanticSearch(subQueries),
    hybridSearch(keyword),
  ]);

  const allSources = [...exaSources, ...esSources];

  const formattedContext = allSources
    .map((s, i) => `[文献源 #${i + 1}]\n标题: ${s.title}\n链接: ${s.url}\n核心正文内容:\n${s.text}`)
    .join('\n\n');

  const sessionId = crypto.randomUUID();
  const context: ResearchContext = {
    keyword,
    subQueries,
    sources: allSources,
    formattedContext,
    createdAt: Date.now(),
  };

  contextCache.set(sessionId, context);

  return Response.json({
    sessionId,
    sources: allSources.map(({ title, url }) => ({ title, url })),
  });
}
