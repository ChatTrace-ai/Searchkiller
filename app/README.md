# app/ — Next.js App Router

The application layer containing pages and API route handlers.

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `page.tsx` | Prediction search and infinite popular grid |
| `/research` | `research/page.tsx` | Research dashboard with parallel report + mind map streaming |
| `/prediction/:id` | `prediction/[id]/page.tsx` | Prediction probability and analysis dashboard |

## API Routes

| Endpoint | File | Description |
|----------|------|-------------|
| `POST /api/plan` | `api/plan/route.ts` | Gemini Flash query planner (3-5 sub-queries) |
| `POST /api/research/fetch` | `api/research/fetch/route.ts` | Exa + Elasticsearch context retrieval |
| `POST /api/research/report` | `api/research/report/route.ts` | Gemini Pro Markdown report stream |
| `POST /api/research/mindmap` | `api/research/mindmap/route.ts` | Gemini Pro mind-map JSON stream |
| `POST /api/predictions` | `api/predictions/route.ts` | Create or reuse a prediction |
| `GET /api/predictions/popular` | `api/predictions/popular/route.ts` | Cursor-paginated featured predictions |
| `GET /api/predictions/:id` | `api/predictions/[id]/route.ts` | Prediction progress or detail |

## Pipeline

```
keyword → /api/plan → /api/research/fetch → parallel(/api/research/report, /api/research/mindmap)
```
