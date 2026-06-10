import { fetch as undiciFetch, ProxyAgent } from 'undici';

/** Node fetch ignores HTTP_PROXY; route outbound API calls through a local proxy when set. */
export function createProxyFetch(): typeof fetch | undefined {
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  if (!proxyUrl) return undefined;

  const dispatcher = new ProxyAgent(proxyUrl);
  return (input, init) =>
    undiciFetch(input, { ...init, dispatcher }) as Promise<Response>;
}
