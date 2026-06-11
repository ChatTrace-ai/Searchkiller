import { incrementalSearch } from '@/lib/incremental-search';
import { contextCache } from '@/lib/context-cache';
import { ensureKnowledgeIndex } from '@/lib/knowledge-store';
import type { ResearchContext } from '@/lib/schemas';

let indexReady = false;

export async function POST(req: Request) {
  if (!indexReady) {
    await ensureKnowledgeIndex().catch((e) =>
      console.warn('[fetch/route] knowledge index init warning:', e.message),
    );
    indexReady = true;
  }

  const { keyword, subQueries, project_id } = await req.json();

  if (!keyword || !subQueries?.length) {
    return Response.json({ error: 'keyword and subQueries are required' }, { status: 400 });
  }

  const { sources, stats } = await incrementalSearch(
    project_id || 'default',
    keyword,
    subQueries,
  );

  const formattedContext = sources
    .map((s, i) => `[文献源 #${i + 1}]\n标题: ${s.title}\n链接: ${s.url}\n核心正文内容:\n${s.text}`)
    .join('\n\n');

  const sessionId = crypto.randomUUID();
  const context: ResearchContext = {
    keyword,
    subQueries,
    sources,
    formattedContext,
    createdAt: Date.now(),
  };

  contextCache.set(sessionId, context);

  return Response.json({
    sessionId,
    sources: sources.map(({ title, url, origin }) => ({ title, url, origin })),
    stats,
  });
}
