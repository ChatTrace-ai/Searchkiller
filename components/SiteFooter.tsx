import { GitFork, Sparkles } from 'lucide-react';
import { BrandMark } from './BrandMark';

export function SiteFooter() {
  return (
    <footer className="border-t border-laplace-border bg-laplace-footer">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <BrandMark />
          <p className="mt-2 text-sm text-laplace-muted">
            Evidence-based forecasts with transparent sources and analysis.
          </p>
        </div>

        <nav aria-label="Project links" className="flex flex-wrap items-center gap-5 text-sm">
          <a
            href="https://github.com/ChatTrace-ai/Searchkiller"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-laplace-muted hover:text-[#2C2417]"
          >
            <GitFork className="h-4 w-4" />
            GitHub
          </a>
          <a
            href="https://ai.google.dev/gemini-api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-laplace-muted hover:text-laplace-sage"
          >
            <Sparkles className="h-4 w-4 text-laplace-sage" />
            Powered by Gemini
          </a>
        </nav>
      </div>
    </footer>
  );
}
