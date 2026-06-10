'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { StreamingReport } from '@/components/StreamingReport';
import { MindMap } from '@/components/MindMap';
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

  const [phase, setPhase] = useState<Phase>('planning');
  const [sources, setSources] = useState<Source[]>([]);
  const [reportContent, setReportContent] = useState('');
  const [mindMapData, setMindMapData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const startResearch = useCallback(async () => {
    if (!keyword) return;

    try {
      setPhase('planning');
      const planRes = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const { subQueries } = await planRes.json();

      setPhase('fetching');
      const fetchRes = await fetch('/api/research/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, subQueries }),
      });
      const { sessionId: sid, sources: src } = await fetchRes.json();
      setSources(src);

      setPhase('streaming');
      startStreams(sid);
    } catch (err: any) {
      setError(err.message || 'Research failed');
    }
  }, [keyword]);

  const startStreams = async (sid: string) => {
    const decoder = new TextDecoder();

    const reportRes = await fetch('/api/research/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    });
    const reportReader = reportRes.body?.getReader();
    if (reportReader) {
      let text = '';
      while (true) {
        const { done, value } = await reportReader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setReportContent(text);
      }
    }

    const mapRes = await fetch('/api/research/mindmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    });
    const mapReader = mapRes.body?.getReader();
    if (mapReader) {
      let json = '';
      while (true) {
        const { done, value } = await mapReader.read();
        if (done) break;
        json += decoder.decode(value, { stream: true });
        try {
          const parsed = JSON.parse(json);
          setMindMapData(parsed);
        } catch {}
      }
    }

    setPhase('done');
  };

  useEffect(() => {
    startResearch();
  }, [startResearch]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 text-center">
          <p className="text-xl mb-2">出错了</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (phase === 'planning' || phase === 'fetching') {
    return <LoadingStates />;
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-surface-200">
        <a href="/" className="text-google-blue font-semibold">Searchkiller</a>
        <span className="text-sm text-gray-400 truncate max-w-md">{keyword}</span>
        <div className="flex items-center gap-2">
          {phase === 'streaming' && (
            <motion.div
              className="w-2 h-2 bg-green-400 rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <span className="text-xs text-gray-500">
            {phase === 'streaming' ? '分析中...' : '完成'}
          </span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r border-surface-200 overflow-y-auto">
          <StreamingReport
            content={reportContent}
            isStreaming={phase === 'streaming'}
          />
        </div>

        <div className="w-1/2 overflow-hidden">
          <MindMap
            data={mindMapData}
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
