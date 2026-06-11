import { streamText } from 'ai';
import { z } from 'zod';
import { flashModel, proModel } from './gemini';
import { safeGenerateObject } from './gemini-client';
import { getActiveProviders } from './search-provider';
import { getClient } from './es-client';
import { RESULT_TTL_MS } from './prediction-seeds';

const INDEX_NAME = 'predictions';

const AnalysisSchema = z.object({
  probabilities: z.array(z.number()).describe('Probability for each outcome in order, must sum to ~100'),
  rationales: z.array(z.string()).describe('One-sentence justification per outcome'),
  confidence_level: z.enum(['low', 'medium', 'high']),
  confidence_score: z.number().min(0).max(100),
  confidence_reason: z.string(),
  summary_1: z.string(),
  summary_2: z.string(),
  outcome_labels: z.array(z.string()).min(2).max(5).describe('2-5 possible outcome labels for this question'),
});

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function generateRealPrediction(id: string, question: string): Promise<void> {
  const client = getClient();

  try {
    // Step 1: Plan sub-queries
    const planResult = await safeGenerateObject({
      model: flashModel,
      schema: z.object({
        subQueries: z.array(z.string()).min(3).max(4),
      }),
      system: `Generate 3-4 focused search queries to find real-time data for a prediction question.
Each query should be a full sentence optimized for semantic search, covering different angles.`,
      prompt: `Prediction question: "${question}"`,
    });
    const plan = planResult.object as { subQueries: string[] };

    await updateProgress(client, id, 'collecting_sources', 'Searching the web for evidence');

    // Step 2: Fetch from Exa
    const providers = getActiveProviders();
    const providerResults = await Promise.all(
      providers.map((p) => p.search(plan.subQueries).catch(() => [])),
    );
    const sources = urlDedup(providerResults.flat());

    if (sources.length === 0) {
      await finishWithFallback(client, id, question);
      return;
    }

    await updateProgress(client, id, 'estimating', 'Analyzing sources and estimating probabilities');

    // Step 3: Analyze with Gemini
    const sourcesContext = sources
      .slice(0, 6)
      .map((s, i) => `[#${i + 1}] ${s.title}: ${s.text.slice(0, 800)}`)
      .join('\n\n');

    let analysis: z.infer<typeof AnalysisSchema>;
    try {
      const analysisResult = await safeGenerateObject({
        model: flashModel,
        schema: AnalysisSchema,
        system: `You are a prediction analyst. Analyze sources and provide probability estimates.
Generate 2-5 outcome labels (e.g. "Yes"/"No" or specific options like "Team A"/"Team B"/"Team C").
The "probabilities" array must match the "outcome_labels" array in order and sum to ~100.
The "rationales" array must match the "outcome_labels" array in order.`,
        prompt: `Question: "${question}"\n\nSources:\n${sourcesContext}`,
      });
      analysis = analysisResult.object as z.infer<typeof AnalysisSchema>;
    } catch {
      await finishWithFallback(client, id, question, sources);
      return;
    }

    await updateProgress(client, id, 'writing_report', 'Generating detailed analysis report');

    // Step 4: Generate report
    const reportContext = sources
      .slice(0, 8)
      .map((s, i) => `[Source #${i + 1}]\nTitle: ${s.title}\nURL: ${s.url}\nContent:\n${s.text.slice(0, 2000)}`)
      .join('\n\n');

    let report = '';
    try {
      const result = streamText({
        model: proModel,
        system: `You are a world-class analyst. Write a concise Markdown forecast report based on real-time data.
Requirements: ## headings, cite sources with [#n], 500-1500 words, end with probability assessment.`,
        prompt: `Research question: "${question}"\n\nReal-time data:\n${reportContext}`,
      });
      for await (const chunk of result.textStream) {
        report += chunk;
      }
    } catch {
      report = `## Analysis\n\nBased on ${sources.length} real-time sources, this forecast provides an evidence-based assessment.\n\n## Note\n\nDetailed report generation was unavailable. Please refer to the source links for more information.`;
    }

    // Build final detail
    const now = new Date().toISOString();

    const realSources = sources.slice(0, 6).map((s, i) => ({
      id: `source-${i + 1}`,
      title: s.title,
      description: s.text.slice(0, 200),
      url: s.url,
      quality: i < 2 ? 'high' : i < 4 ? 'medium' : 'low',
      publishedAt: now,
    }));

    const outcomes = analysis.outcome_labels.map((label, i) => ({
      id: slugify(label) || `outcome-${i + 1}`,
      rank: i + 1,
      label,
      probability: analysis.probabilities[i] ?? 50,
      change: 0,
      rationale: analysis.rationales[i] ?? `Based on available evidence.`,
      sourceIds: realSources.slice(0, 3).map((s) => s.id),
    }));

    outcomes.sort((a, b) => b.probability - a.probability);
    outcomes.forEach((o, i) => { o.rank = i + 1; });

    const detail = {
      id,
      question,
      category: 'General',
      icon: 'sparkles',
      status: 'completed',
      confidence: {
        level: analysis.confidence_level,
        score: analysis.confidence_score,
        explanation: analysis.confidence_reason,
      },
      outcomes,
      sources: realSources,
      summary: [analysis.summary_1, analysis.summary_2],
      report,
      createdAt: now,
      updatedAt: now,
    };

    await client.update({
      index: INDEX_NAME,
      id,
      body: {
        doc: {
          status: 'completed',
          ready_at: null,
          expires_at: new Date(Date.now() + RESULT_TTL_MS).toISOString(),
          detail,
        },
      },
      refresh: true,
    });

    console.info(`[prediction-generator] completed: ${id}`);
  } catch (error: any) {
    console.error(`[prediction-generator] failed for ${id}:`, error.message);
    await finishWithFallback(client, id, question).catch(() => {});
  }
}

async function updateProgress(
  client: any,
  id: string,
  stage: string,
  message: string,
): Promise<void> {
  try {
    await client.update({
      index: INDEX_NAME,
      id,
      body: {
        script: {
          source: `
            ctx._source.detail.status = 'processing';
            ctx._source.detail.updatedAt = params.updatedAt;
            if (ctx._source.detail.progress == null) { ctx._source.detail.progress = new HashMap(); }
            ctx._source.detail.progress.stage = params.stage;
            ctx._source.detail.progress.message = params.message;
          `,
          lang: 'painless',
          params: {
            updatedAt: new Date().toISOString(),
            stage,
            message,
          },
        },
      },
    });
  } catch {}
}

async function finishWithFallback(
  client: any,
  id: string,
  question: string,
  sources?: Array<{ title: string; url: string; text: string }>,
): Promise<void> {
  const now = new Date().toISOString();
  const fallbackSources = sources
    ? sources.slice(0, 3).map((s, i) => ({
        id: `source-${i + 1}`,
        title: s.title,
        description: s.text.slice(0, 200),
        url: s.url,
        quality: 'medium',
        publishedAt: now,
      }))
    : [];

  const detail = {
    id,
    question,
    category: 'General',
    icon: 'sparkles',
    status: 'completed',
    confidence: { level: 'low', score: 30, explanation: 'Limited data available for this prediction.' },
    outcomes: [
      { id: 'yes', rank: 1, label: 'Yes', probability: 50, change: 0, rationale: 'Insufficient data for a strong estimate.', sourceIds: [] },
      { id: 'no', rank: 2, label: 'No', probability: 50, change: 0, rationale: 'Insufficient data for a strong estimate.', sourceIds: [] },
    ],
    sources: fallbackSources,
    summary: ['Insufficient real-time data was found to provide a confident forecast.', 'This prediction uses default probabilities — try a more specific question.'],
    report: `## Analysis\n\nInsufficient real-time data was available for "${question}". The probabilities shown are defaults.\n\n## Recommendation\n\nTry rephrasing your question or searching for a more specific topic.`,
    createdAt: now,
    updatedAt: now,
  };

  await client.update({
    index: INDEX_NAME,
    id,
    body: {
      doc: {
        status: 'completed',
        ready_at: null,
        expires_at: new Date(Date.now() + RESULT_TTL_MS).toISOString(),
        detail,
      },
    },
    refresh: true,
  });
}

function urlDedup(sources: Array<{ title: string; url: string; text: string }>): Array<{ title: string; url: string; text: string }> {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
