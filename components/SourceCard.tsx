'use client';

import { motion } from 'framer-motion';

interface Source {
  title: string;
  url: string;
}

interface SourceCardProps {
  sources: Source[];
}

export function SourceCard({ sources }: SourceCardProps) {
  if (sources.length === 0) return null;

  return (
    <div className="border-t border-surface-200 p-4">
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">参考来源</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <motion.a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-surface-50 border border-surface-200 rounded-lg text-gray-300 hover:border-google-blue hover:text-google-blue transition-colors truncate max-w-[200px]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            📎 {source.title}
          </motion.a>
        ))}
      </div>
    </div>
  );
}
