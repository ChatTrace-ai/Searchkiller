'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface SearchInputProps {
  onSearch: (keyword: string) => void;
  isLoading?: boolean;
}

export function SearchInput({ onSearch, isLoading }: SearchInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSearch(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="输入研究关键词，例如：Gemini 2.5 在医疗诊断中的多模态应用趋势"
        className="w-full px-6 py-4 bg-surface-50 border border-surface-200 rounded-2xl text-white placeholder-gray-500 text-lg focus:outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 transition-all"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={!value.trim() || isLoading}
        className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2 bg-google-blue text-white rounded-xl font-medium hover:bg-google-blue-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? (
          <motion.div
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          '研究'
        )}
      </button>
    </form>
  );
}
