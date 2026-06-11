import { createVertex } from '@ai-sdk/google-vertex';

const vertex = createVertex({
  location: process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1',
  project: process.env.GOOGLE_VERTEX_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'build-placeholder',
});

export const flashModel = vertex('gemini-2.5-flash');
export const proModel = vertex('gemini-2.5-pro');
