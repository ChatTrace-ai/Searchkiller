import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Searchkiller | AI Research Assistant',
  description: 'Keyword-driven streaming research agent powered by Gemini & Exa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-surface antialiased">
        {children}
      </body>
    </html>
  );
}
