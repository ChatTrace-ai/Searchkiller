import { fetch as undiciFetch, ProxyAgent } from 'undici';
import type { FetchFunction } from '@ai-sdk/provider-utils';

/** Node fetch ignores HTTP_PROXY; route outbound API calls through a local proxy when set. */
export function createProxyFetch(): FetchFunction | undefined {
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  if (!proxyUrl) return undefined;

  const dispatcher = new ProxyAgent(proxyUrl);
  return ((input, init) =>
    undiciFetch(
      input as Parameters<typeof undiciFetch>[0],
      { ...init, dispatcher } as Parameters<typeof undiciFetch>[1],
    )) as FetchFunction;
}
