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
        throw new Error(planBody.error || '查询规划失败');
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
        throw new Error(fetchBody.error || '文献抓取失败');
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
      throw new Error(body.error || '报告生成失败');
    }

    const reportReader = reportRes.body?.getReader();
    if (!reportReader) {
      throw new Error('报告流不可用');
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
      throw new Error('报告内容为空');
    }
  };

  useEffect(() => {
    if (!keyword || startedKeywordRef.current === keyword) return;
    startedKeywordRef.current = keyword;
    startResearch();
  }, [keyword, startResearch]);

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
    <div className="h-screen flex flex-col bg-white">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <a href="/" className="text-google-blue font-semibold">Searchkiller</a>
        <span className="text-sm text-gray-600 truncate max-w-md">{keyword}</span>
        <div className="flex items-center gap-2">
          {phase === 'streaming' && (
            <motion.div
              className="w-2 h-2 bg-green-400 rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <span className="text-xs text-gray-500">
            {phase === 'streaming' ? '生成报告中...' : '完成'}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-y-auto bg-white">
          {phase === 'streaming' && !reportContent && (
            <p className="p-6 text-sm text-gray-500">正在生成报告，通常需要 1–2 分钟...</p>
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
