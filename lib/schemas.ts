import { z } from 'zod';

export const mindMapSchema: z.ZodType<any> = z.object({
  name: z.string().describe('思维导图核心节点名称'),
  children: z.array(z.lazy(() => mindMapSchema)).optional().describe('子分类节点'),
  attributes: z.object({
    summary: z.string().describe('对该节点主题的简短一句话分析或事实支撑'),
    sources: z.array(z.string()).describe('引用的外部网页标题或链接'),
  }).optional(),
});

export type MindMapNode = z.infer<typeof mindMapSchema>;

export interface Source {
  title: string;
  url: string;
  text: string;
}

export interface ResearchContext {
  keyword: string;
  subQueries: string[];
  sources: Source[];
  formattedContext: string;
  createdAt: number;
}
