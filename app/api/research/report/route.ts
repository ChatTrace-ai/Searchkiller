import { streamText } from 'ai';
import { proModel } from '@/lib/gemini';
import { contextCache } from '../fetch/route';

export async function POST(req: Request) {
  const { sessionId } = await req.json();
  const context = contextCache.get(sessionId);

  if (!context) {
    return Response.json({ error: 'Session expired or not found' }, { status: 404 });
  }

  const result = streamText({
    model: proModel,
    system: `你是一个世界顶尖的行业分析专家。基于用户的研究关键词和提供的互联网实时抓取数据，
输出一份结构严谨的 Markdown 研究报告。要求：
1. 完全基于事实，不得捏造
2. 使用清晰的 ## 标题结构（背景概述、关键发现、技术分析、趋势展望、结论）
3. 每个观点标明来源编号 [#n]
4. 中文为主，技术术语保留英文
5. 总字数控制在 1500-3000 字`,
    prompt: `研究关键词: "${context.keyword}"\n\n实时抓取数据:\n${context.formattedContext}`,
  });

  return result.toTextStreamResponse();
}
