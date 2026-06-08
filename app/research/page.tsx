'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from 'ai/react';
import { experimental_useObject as useObject } from 'ai/react';
import { motion } from 'framer-motion';
import { StreamingReport } from '@/components/StreamingReport';
import { MindMap } from '@/components/MindMap';
import { SourceCard } from '@/components/SourceCard';
import { LoadingStates } from '@/components/LoadingStates';
import { mindMapSchema } from '@/lib/schemas';

type Phase = 'planning' | 'fetching' | 'streaming' | 'done';

interface Source {
  title: string;
  url: string;
}

export default function ResearchPage() {
  const searchParams = useSearchParams();
  const keyword = searchParams.get('q') || '';

  const [phase, setPhase] = useState<Phase>('planning');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [reportContent, setReportContent] = useState('');
  const [mindMapData, setMindMapData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const startResearch = useCallback(async () => {
    if (!keyword) return;

    try {
      // Phase 1: Plan
      setPhase('planning');
      const planRes = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const { subQueries } = await planRes.json();

      // Phase 2: Fetch context
      setPhase('fetching');
      const fetchRes = await fetch('/api/research/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, subQueries }),
      });
      const { sessionId: sid, sources: src } = await fetchRes.json();
      setSessionId(sid);
      setSources(src);

      // Phase 3: Start parallel streams
      setPhase('streaming');
      startStreams(sid);
    } catch (err: any) {
      setError(err.message || 'Research failed');
    }
  }, [keyword]);

  const startStreams = async (sid: string) => {
    // Report stream
    const reportRes = await fetch('/api/research/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    });
    const reportReader = reportRes.body?.getReader();
    const decoder = new TextDecoder();
    if (reportReader) {
      let text = '';
      while (true) {
        const { done, value } = await reportReader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setReportContent(text);
      }
    }

    // Mindmap stream
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
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-surface-200">
        <a href="/" className="text-google-blue font-semibold">G-RapidAgent</a>
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

      {/* Main Content - Split View */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Report */}
        <div className="w-1/2 border-r border-surface-200 overflow-y-auto">
          <StreamingReport
            content={reportContent}
            isStreaming={phase === 'streaming'}
          />
        </div>

        {/* Right: Mind Map */}
        <div className="w-1/2 overflow-hidden">
          <MindMap
            data={mindMapData}
            isStreaming={phase === 'streaming'}
          />
        </div>
      </main>

      {/* Footer: Sources */}
      <SourceCard sources={sources} />
    </div>
  );
}
