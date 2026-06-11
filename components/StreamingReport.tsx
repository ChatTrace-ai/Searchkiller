'use client';

import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

interface StreamingReportProps {
  content: string;
  isStreaming: boolean;
}

export function StreamingReport({ content, isStreaming }: StreamingReportProps) {
  if (!content && !isStreaming) return null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="prose-report">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      {isStreaming && (
        <motion.span
          className="inline-block w-2 h-5 bg-laplace-sage ml-1"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </div>
  );
}
