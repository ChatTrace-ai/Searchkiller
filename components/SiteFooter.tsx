import { GitFork, Sparkles } from 'lucide-react';
import { BrandMark } from './BrandMark';

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <BrandMark />
          <p className="mt-2 text-sm text-slate-500">
            Evidence-based forecasts with transparent sources and analysis.
          </p>
        </div>

        <nav aria-label="Project links" className="flex flex-wrap items-center gap-5 text-sm">
          <a
            href="https://github.com/ChatTrace-ai/Searchkiller"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-slate-600 hover:text-slate-950"
          >
            <GitFork className="h-4 w-4" />
            GitHub
          </a>
          <a
            href="https://ai.google.dev/gemini-api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-slate-600 hover:text-blue-700"
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            Powered by Gemini
          </a>
        </nav>
      </div>
    </footer>
  );
}
