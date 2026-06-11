# api/ — API Route Handlers

Next.js Route Handlers for research, prediction, and evaluation workflows.

## Routes

| Endpoint | Input | Output |
|----------|-------|--------|
| `/api/plan` | `{keyword}` | `{subQueries: string[]}` |
| `/api/research/fetch` | `{keyword, subQueries}` | `{sessionId, sources}` |
| `/api/research/report` | `{sessionId}` | Streaming Markdown text |
| `/api/research/mindmap` | `{sessionId}` | Streaming JSON (tree structure) |
| `GET /api/predictions/popular` | `{cursor?, limit?, category?}` | Cursor-paginated prediction summaries |
| `POST /api/predictions` | `{question}` | Create or reuse prediction |
| `GET /api/predictions/:id` | Path ID | Progress or completed prediction detail |
| `POST /api/predictions/:id/refresh` | Path ID | Restart prediction generation |

| `POST /api/evaluate` | `{action, ...}` | HITL evaluation (initialize/config/evaluate/evaluate_trace/stats) |

## Session Model

`/api/research/fetch` creates an in-memory session keyed by `sessionId`. The `report` and `mindmap` routes consume that session's cached context for streaming generation.

Prediction v1 persists records in Elasticsearch and runs the real generation
pipeline (Plan → Exa → Analyze → Report) asynchronously on create and refresh.
