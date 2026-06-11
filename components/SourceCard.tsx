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
    <div className="border-t border-laplace-border p-4 bg-laplace-card">
      <p className="text-xs text-laplace-muted mb-2 uppercase tracking-widest">Reference sources</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <motion.a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-laplace-parchment border border-laplace-border rounded-lg text-laplace-muted hover:border-laplace-sage hover:text-laplace-sage transition-colors truncate max-w-[200px]"
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
