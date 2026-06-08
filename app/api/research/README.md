# research/ — Research Pipeline Routes

Three-stage API for the research pipeline: context fetching, report streaming, and mind-map streaming.

| Route | Endpoint | Description |
|-------|----------|-------------|
| `fetch/` | `POST /api/research/fetch` | Exa + ES retrieval, creates session |
| `report/` | `POST /api/research/report` | Gemini Pro Markdown stream |
| `mindmap/` | `POST /api/research/mindmap` | Gemini Pro tree-JSON stream |
