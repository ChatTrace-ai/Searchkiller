import { z } from 'zod';
import { flashModel } from './gemini';
import { safeGenerateObject } from './gemini-client';
import type { Source, KnowledgeEntry } from './schemas';

export type ExtractionErrorClass = 'rate_limit' | 'schema_validation' | 'timeout' | 'api_error' | 'empty_source';

export interface ExtractionDiagnostics {
  total: number;
  succeeded: number;
  failed: number;
  errorBreakdown: Record<ExtractionErrorClass, number>;
}

const KnowledgeSchema = z.object({
  topic: z.string().describe('The main topic or subject of this source'),
  facts: z.array(z.string()).max(10).describe('Key factual claims from the source').default([]),
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.string().describe('Entity type: person, organization, technology, concept, event, location, or other'),
      description: z.string().optional(),
    }),
  ).describe('Named entities mentioned in the source').default([]),
  raw_summary: z.string().max(1500).describe('A concise summary of the source content (under 300 words)'),
});

type ExtractedKnowledge = Omit<KnowledgeEntry, 'project_id' | 'created_at'>;

function sanitizeInput(text: string, maxLen = 3000): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, ' ')
    .trim();
  return cleaned.slice(0, maxLen);
}

export async function extractKnowledge(source: Source): Promise<ExtractedKnowledge> {
  const content = sanitizeInput(source.text);
  const inputText = `Title: ${source.title}\nURL: ${source.url}\n\nContent:\n${content}`;

  const result = await safeGenerateObject({
    model: flashModel,
    schema: KnowledgeSchema,
    system: `Extract structured knowledge from the given source. Rules:
- topic: short phrase describing the main subject
- facts: up to 10 key factual claims (can be empty array if source is thin)
- entities: named entities with type (person/organization/technology/concept/event/location/other)
- raw_summary: concise summary under 300 words
Be factual. Output in English. If content is too short or unclear, still produce valid output with empty arrays.`,
    prompt: inputText,
    providerOptions: {
      vertex: { thinkingConfig: { thinkingBudget: 0 } },
    },
  }, { label: 'knowledge-extract' });

  const obj = result.object as z.infer<typeof KnowledgeSchema>;
  return {
    topic: obj.topic,
    facts: obj.facts || [],
    entities: obj.entities || [],
    source_url: source.url,
    source_title: source.title,
    raw_summary: obj.raw_summary,
  };
}

function classifyExtractionError(error: any): ExtractionErrorClass {
  const cls = error?.geminiErrorClass;
  if (cls === 'rate_limit') return 'rate_limit';
  if (cls === 'timeout') return 'timeout';
  if (cls === 'validation') return 'schema_validation';
  return 'api_error';
}

interface ExtractResult {
  data: ExtractedKnowledge | null;
  errorClass?: ExtractionErrorClass;
}

async function extractSafe(source: Source): Promise<ExtractResult> {
  const sanitized = sanitizeInput(source.text || '');
  if (sanitized.length < 50) {
    return { data: null, errorClass: 'empty_source' };
  }

  try {
    const data = await extractKnowledge(source);
    return { data };
  } catch (error: any) {
    return { data: null, errorClass: classifyExtractionError(error) };
  }
}

export async function extractKnowledgeBatch(
  sources: Source[],
): Promise<{ results: Array<ExtractedKnowledge | null>; diagnostics: ExtractionDiagnostics }> {
  const errorBreakdown: Record<ExtractionErrorClass, number> = {
    rate_limit: 0,
    schema_validation: 0,
    timeout: 0,
    api_error: 0,
    empty_source: 0,
  };

  const extractResults = await Promise.all(
    sources.map((source) => extractSafe(source)),
  );

  const results = extractResults.map((r) => {
    if (r.errorClass) errorBreakdown[r.errorClass]++;
    return r.data;
  });

  const succeeded = results.filter((r) => r !== null).length;

  const diagnostics: ExtractionDiagnostics = {
    total: sources.length,
    succeeded,
    failed: sources.length - succeeded,
    errorBreakdown,
  };

  console.info('[knowledge-extractor] batch diagnostics:', diagnostics);

  return { results, diagnostics };
}
