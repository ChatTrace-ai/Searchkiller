# api/ — API Route Handlers

Next.js Route Handlers for the research pipeline. All routes accept POST requests with JSON bodies and return JSON or streaming responses.

## Routes

| Endpoint | Input | Output |
|----------|-------|--------|
| `/api/plan` | `{keyword}` | `{subQueries: string[]}` |
| `/api/research/fetch` | `{keyword, subQueries}` | `{sessionId, sources}` |
| `/api/research/report` | `{sessionId}` | Streaming Markdown text |
| `/api/research/mindmap` | `{sessionId}` | Streaming JSON (tree structure) |

| `POST /api/evaluate` | `{action, ...}` | HITL evaluation (initialize/config/evaluate/evaluate_trace/stats) |

## Session Model

`/api/research/fetch` creates an in-memory session keyed by `sessionId`. The `report` and `mindmap` routes consume that session's cached context for streaming generation.
