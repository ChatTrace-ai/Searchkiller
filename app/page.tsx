'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { SearchInput } from '@/components/SearchInput';

export default function HomePage() {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSearch = async (keyword: string) => {
    setIsSearching(true);
    router.push(`/research?q=${encodeURIComponent(keyword)}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <motion.div
        className="text-center"
        initial={mounted ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-google-blue to-blue-400 bg-clip-text text-transparent">
          Searchkiller
        </h1>
        <p className="text-gray-600 mb-12 text-lg">
          输入关键词，AI 自动生成深度研究报告
        </p>
      </motion.div>

      <motion.div
        className="w-full max-w-2xl"
        initial={mounted ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <SearchInput onSearch={handleSearch} isLoading={isSearching} />
      </motion.div>

      <motion.div
        className="mt-8 flex flex-wrap gap-2 justify-center"
        initial={mounted ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {['Gemini 医疗多模态', 'AI Agent 架构趋势', '量子计算商业化'].map((tag) => (
          <button
            key={tag}
            onClick={() => handleSearch(tag)}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-full hover:border-google-blue hover:text-google-blue transition-colors"
          >
            {tag}
          </button>
        ))}
      </motion.div>
    </main>
  );
}
