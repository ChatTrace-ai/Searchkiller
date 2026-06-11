'use client';

import { motion } from 'framer-motion';

export function LoadingStates() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-laplace-parchment">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-laplace-green rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </div>
        <p className="text-laplace-muted text-sm">Analyzing sources...</p>
      </motion.div>
    </div>
  );
}
