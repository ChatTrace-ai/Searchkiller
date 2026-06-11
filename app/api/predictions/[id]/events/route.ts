import { getPrediction } from '@/lib/prediction-store';
import type {
  PredictionStreamEvent,
  PredictionStage,
  PredictionDetail,
  PredictionProgress,
} from '@/lib/prediction-types';

export const runtime = 'nodejs';

const POLL_INTERVAL_MS = 1_000;
const KEEPALIVE_INTERVAL_MS = 15_000;
const MAX_DURATION_MS = 300_000;

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const initial = await getPrediction(id);
  if (!initial) {
    return Response.json(
      { error: { code: 'PREDICTION_NOT_FOUND', message: 'Prediction not found' } },
      { status: 404 },
    );
  }

  const encoder = new TextEncoder();
  let revision = 0;
  let lastStage: PredictionStage = 'planning';
  let lastSourceCount = 0;
  let lastOutcomeCount = 0;
  let lastReportLength = 0;
  let done = false;

  function makeEvent(
    type: PredictionStreamEvent['type'],
    data: Record<string, unknown>,
  ): string {
    revision += 1;
    const payload: PredictionStreamEvent = {
      type,
      revision,
      occurredAt: new Date().toISOString(),
      data,
    } as PredictionStreamEvent;
    return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  }

  let queriesSent = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => {
        try { controller.enqueue(encoder.encode(chunk)); } catch { /* closed */ }
      };

      const initData = buildSnapshotFromPrediction(initial);
      enqueue(makeEvent('snapshot', initData));
      lastStage = initData.stage as PredictionStage;
      const initSources = initData.sources as unknown[];
      const initOutcomes = initData.draftOutcomes as unknown[];
      const initReport = (initData.reportPreview as string) || '';
      if (initSources?.length) lastSourceCount = initSources.length;
      if (initOutcomes?.length) lastOutcomeCount = initOutcomes.length;
      if (initReport.length) lastReportLength = initReport.length;
      if ((initData.queries as unknown[])?.length > 0) queriesSent = true;

      const keepaliveTimer = setInterval(() => {
        enqueue(': keepalive\n\n');
      }, KEEPALIVE_INTERVAL_MS);

      const startTime = Date.now();

      const poll = async () => {
        while (!done && Date.now() - startTime < MAX_DURATION_MS) {
          await sleep(POLL_INTERVAL_MS);

          try {
            const current = await getPrediction(id);
            if (!current) {
              enqueue(makeEvent('failed', { code: 'PREDICTION_NOT_FOUND', message: 'Prediction disappeared' }));
              done = true;
              break;
            }

            if ('progress' in current && current.status === 'processing') {
              const prog = current as PredictionProgress;
              const stage = prog.progress?.stage || 'planning';
              const progAny = prog as any;

              if (stage !== lastStage) {
                lastStage = stage;
                enqueue(makeEvent('stage', { stage, message: prog.progress?.message || '' }));
              }

              if (!queriesSent && progAny.progress?.queries?.length > 0) {
                queriesSent = true;
                enqueue(makeEvent('queries', { queries: progAny.progress.queries }));
              }

              const liveSources = progAny.progress?.sources;
              if (liveSources?.length > 0 && liveSources.length !== lastSourceCount) {
                lastSourceCount = liveSources.length;
                enqueue(makeEvent('sources', { sources: liveSources }));
              }

              const liveOutcomes = progAny.progress?.draftOutcomes;
              if (liveOutcomes?.length > 0 && liveOutcomes.length !== lastOutcomeCount) {
                lastOutcomeCount = liveOutcomes.length;
                enqueue(makeEvent('outcomes', { outcomes: liveOutcomes }));
              }

              const reportPreview = progAny.progress?.reportPreview;
              if (reportPreview && reportPreview.length > lastReportLength) {
                const delta = reportPreview.slice(lastReportLength);
                lastReportLength = reportPreview.length;
                enqueue(makeEvent('report_delta', { delta }));
              }

              continue;
            }

            const detail = current as PredictionDetail;
            const detailAny = detail as any;

            if (detail.status === 'failed') {
              const reason = detailAny.error?.message
                || detail.confidence?.explanation
                || detail.summary?.[0]
                || 'Prediction generation failed.';
              enqueue(makeEvent('failed', { code: 'GENERATION_FAILED', message: reason }));
              done = true;
              break;
            }

            if (detail.status === 'completed') {
              if (detail.sources?.length > 0 && detail.sources.length !== lastSourceCount) {
                lastSourceCount = detail.sources.length;
                enqueue(makeEvent('sources', {
                  sources: detail.sources.map(s => ({
                    id: s.id,
                    title: s.title,
                    url: s.url,
                    description: s.description,
                  })),
                }));
              }

              if (detail.outcomes?.length > 0 && detail.outcomes.length !== lastOutcomeCount) {
                lastOutcomeCount = detail.outcomes.length;
                enqueue(makeEvent('outcomes', {
                  outcomes: detail.outcomes.map(o => ({
                    label: o.label,
                    probability: o.probability,
                    rationale: o.rationale,
                  })),
                }));
              }

              if (detail.report && detail.report.length > lastReportLength) {
                const delta = detail.report.slice(lastReportLength);
                enqueue(makeEvent('report_delta', { delta }));
              }

              enqueue(makeEvent('completed', { id: detail.id }));
              done = true;
              break;
            }
          } catch {
            // transient ES error — keep polling
          }
        }

        clearInterval(keepaliveTimer);

        if (!done) {
          enqueue(makeEvent('failed', { code: 'SERVICE_UNAVAILABLE', message: 'Stream timeout' }));
        }

        try { controller.close(); } catch { /* already closed */ }
      };

      poll();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildSnapshotFromPrediction(
  prediction: PredictionDetail | PredictionProgress,
): Record<string, unknown> {
  if ('progress' in prediction && prediction.status === 'processing') {
    const prog = prediction as PredictionProgress;
    const progAny = prog as any;
    return {
      stage: prog.progress?.stage || 'planning',
      message: prog.progress?.message || 'Planning focused research queries',
      queries: progAny.progress?.queries || [],
      sources: progAny.progress?.sources || [],
      draftOutcomes: progAny.progress?.draftOutcomes || [],
      reportPreview: progAny.progress?.reportPreview || '',
    };
  }

  const detail = prediction as PredictionDetail;
  return {
    stage: 'writing_report',
    message: 'Prediction complete',
    queries: [],
    sources: (detail.sources || []).map(s => ({
      id: s.id, title: s.title, url: s.url, description: s.description,
    })),
    draftOutcomes: (detail.outcomes || []).map(o => ({
      label: o.label, probability: o.probability, rationale: o.rationale,
    })),
    reportPreview: detail.report || '',
  };
}
