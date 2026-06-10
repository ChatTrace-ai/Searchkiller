/** Preload proxy for Node fetch (undici). Only runs when HTTPS_PROXY/HTTP_PROXY is set. */
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
  const { setGlobalDispatcher, ProxyAgent } = require('undici');
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
