# evaluate/ — HITL Evaluation Route

`POST /api/evaluate` — Human-in-the-Loop evaluation endpoint for the Recycle Pattern.

## Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `initiate` | `{keyword, subQueries}` | Start recycle loop, emit trace, pre-screen failures, return traceId |
| `finalize` | `{traceId, signal: {verdict, reviewer, ...}}` | Complete HITL evaluation, route to golden/failures |
| `stats` | `{}` | Return recycle system summary counts |
