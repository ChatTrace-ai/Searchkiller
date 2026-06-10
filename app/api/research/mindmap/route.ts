import { streamObject } from 'ai';
import { proModel } from '@/lib/gemini';
import { mindMapSchema } from '@/lib/schemas';
import { contextCache } from '@/lib/context-cache';

export async function POST(req: Request) {
  const { sessionId } = await req.json();
  const context = contextCache.get(sessionId);

  if (!context) {
    return Response.json({ error: 'Session expired or not found' }, { status: 404 });
  }

  const result = streamObject({
    model: proModel,
    schema: mindMapSchema,
    system: `你是一个世界顶尖的行业分析专家。根据用户的研究关键词和提供的互联网实时抓取正文，
提炼出一套具备严密逻辑层级关系的思维导图。要求：
1. 必须完全基于事实，不得凭空捏造
2. 根节点为研究主题，下设 3-5 个一级分支
3. 每个分支可有 2-4 个子节点
4. 每个节点必须包含 summary（一句话分析）
5. 标明信息来源 sources（引用文献标题或链接）`,
    prompt: `研究关键词: "${context.keyword}"\n\n抓取到的最新网页参考数据:\n${context.formattedContext}`,
  });

  return result.toTextStreamResponse();
}
