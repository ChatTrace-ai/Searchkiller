import { createVertex } from '@ai-sdk/google-vertex';
import { createProxyFetch } from './proxy-fetch';

const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
  location:
    process.env.GOOGLE_VERTEX_LOCATION ??
    process.env.GOOGLE_CLOUD_REGION ??
    'global',
  fetch: createProxyFetch(),
});

export const flashModel = vertex('gemini-3.1-flash-lite');
export const proModel = vertex('gemini-3.1-pro-preview');
