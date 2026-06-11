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
  origin?: 'exa' | 'google' | 'knowledge-cache';
}

export interface KnowledgeEntry {
  project_id: string;
  topic: string;
  facts: string[];
  entities: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  source_url: string;
  source_title: string;
  raw_summary: string;
  created_at: string;
}

export interface KnowledgeDocument extends KnowledgeEntry {
  embedding_text?: string;
  expires_at?: string;
  access_count?: number;
  last_accessed_at?: string;
}

export interface BulkResult {
  succeeded: number;
  failed: number;
  duplicates: number;
  errors?: Array<{ id: string; status: number; error?: string }>;
}

export interface CoverageResult {
  subQuery: string;
  covered: boolean;
  score: number;
  existingEntries: KnowledgeEntry[];
}

export interface ISearchProvider {
  name: string;
  search(queries: string[]): Promise<Source[]>;
}

export interface SearchStats {
  totalSubQueries: number;
  coveredByCache: number;
  fetchedFromExternal: number;
  /** Number of entries confirmed indexed. -1 means indexing is still pending (timed out). */
  newEntriesIndexed: number;
  cacheHitRate: number;
  extractionErrors: number;
  extractionDiagnostics?: {
    total: number;
    succeeded: number;
    failed: number;
    errorBreakdown: Record<string, number>;
  };
}

export interface ResearchContext {
  keyword: string;
  subQueries: string[];
  sources: Source[];
  formattedContext: string;
  createdAt: number;
}
