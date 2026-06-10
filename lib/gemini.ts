import { createVertex } from '@ai-sdk/google-vertex';

const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT,
  location: process.env.GOOGLE_VERTEX_LOCATION ?? 'global',
});

export const flashModel = vertex('gemini-3.1-flash-lite');
export const proModel = vertex('gemini-3.1-pro-preview');
