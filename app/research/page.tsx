'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { StreamingReport } from '@/components/StreamingReport';
import { SourceCard } from '@/components/SourceCard';
import { LoadingStates } from '@/components/LoadingStates';

type Phase = 'planning' | 'fetching' | 'streaming' | 'done';

interface Source {
  title: string;
  url: string;
}

function ResearchContent() {
  const searchParams = useSearchParams();
  const keyword = searchParams.get('q') || '';
  const startedKeywordRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>('planning');
  const [sources, setSources] = useState<Source[]>([]);
  const [reportContent, setReportContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startResearch = useCallback(async () => {
    if (!keyword) return;

    try {
      setPhase('planning');
      setReportContent('');

      const planRes = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const planBody = await planRes.json();
      if (!planRes.ok) {
        throw new Error(planBody.error || 'Planning failed');
      }
      const { subQueries } = planBody;

      setPhase('fetching');
      const fetchRes = await fetch('/api/research/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, subQueries }),
      });
      const fetchBody = await fetchRes.json();
      if (!fetchRes.ok) {
        throw new Error(fetchBody.error || 'Source fetching failed');
      }
      const { sessionId: sid, sources: src } = fetchBody;
      setSources(src);

      setPhase('streaming');
      await streamReport(sid);
      setPhase('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Research failed');
    }
  }, [keyword]);

  const streamReport = async (sid: string) => {
    const reportRes = await fetch('/api/research/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    });

    if (!reportRes.ok) {
      const body = await reportRes.json().catch(() => ({}));
      throw new Error(body.error || 'Report generation failed');
    }

    const reportReader = reportRes.body?.getReader();
    if (!reportReader) {
      throw new Error('Report stream unavailable');
    }

    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reportReader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      setReportContent(text);
    }

    if (!text.trim()) {
      throw new Error('Report content is empty');
    }
  };

  useEffect(() => {
    if (!keyword || startedKeywordRef.current === keyword) return;
    startedKeywordRef.current = keyword;
    startResearch();
  }, [keyword, startResearch]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-laplace-parchment">
        <div className="text-center">
          <p className="text-xl mb-2 text-[#2C2417]">Something went wrong</p>
          <p className="text-sm text-laplace-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (phase === 'planning' || phase === 'fetching') {
    return <LoadingStates />;
  }

  return (
    <div className="h-screen flex flex-col bg-laplace-parchment">
      <header className="flex items-center justify-between px-6 py-3 border-b border-laplace-border bg-laplace-parchment">
        <a href="/" className="text-laplace-green font-semibold">Laplace&apos;s Demon</a>
        <span className="text-sm text-laplace-muted truncate max-w-md">{keyword}</span>
        <div className="flex items-center gap-2">
          {phase === 'streaming' && (
            <motion.div
              className="w-2 h-2 bg-laplace-sage rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <span className="text-xs text-laplace-muted">
            {phase === 'streaming' ? 'Generating report...' : 'Complete'}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-laplace-parchment">
        <div className="h-full overflow-y-auto">
          {phase === 'streaming' && !reportContent && (
            <p className="p-6 text-sm text-laplace-muted">Generating report, usually takes 1–2 minutes...</p>
          )}
          <StreamingReport
            content={reportContent}
            isStreaming={phase === 'streaming'}
          />
        </div>
      </main>

      <SourceCard sources={sources} />
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<LoadingStates />}>
      <ResearchContent />
    </Suspense>
  );
}
