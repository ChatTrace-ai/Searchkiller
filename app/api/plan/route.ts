import { flashModel } from '@/lib/gemini';
import { safeGenerateObject } from '@/lib/gemini-client';
import { z } from 'zod';

export async function POST(req: Request) {
  const { keyword } = await req.json();

  if (!keyword || typeof keyword !== 'string') {
    return Response.json({ error: 'keyword is required' }, { status: 400 });
  }

  try {
    const { object } = await safeGenerateObject({
      model: flashModel,
      schema: z.object({
        subQueries: z.array(z.string()).min(3).max(5),
      }),
      system: `你是一个专业的查询规划器。将用户的研究关键词拆解为 3~5 个独立角度的子查询句。
每个子查询应该：
- 针对语义搜索引擎优化（完整句子而非关键字）
- 覆盖不同维度（背景、技术、应用、趋势、挑战等）
- 使用中英文混合（技术术语用英文）`,
      prompt: `研究关键词: "${keyword}"`,
    });

    return Response.json(object);
  } catch (error: any) {
    const cls = error?.geminiErrorClass;
    if (cls === 'rate_limit') {
      return Response.json({ error: { code: 'RATE_LIMITED', message: 'Gemini API rate limited' } }, { status: 429 });
    }
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Plan generation failed' } }, { status: 503 });
  }
}
