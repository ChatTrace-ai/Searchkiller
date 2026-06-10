import type { ResearchContext } from './schemas';

const contextCache = new Map<string, ResearchContext>();

setInterval(() => {
  const now = Date.now();
  for (const [id, ctx] of contextCache) {
    if (now - ctx.createdAt > 30 * 60 * 1000) {
      contextCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

export { contextCache };
