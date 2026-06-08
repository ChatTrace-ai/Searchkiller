'use client';

import { motion } from 'framer-motion';

export function LoadingStates() {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-google-blue rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </div>
        <p className="text-gray-400 text-sm">正在分析关键词并抓取数据...</p>
      </motion.div>
    </div>
  );
}
