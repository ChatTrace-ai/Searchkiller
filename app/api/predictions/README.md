# Prediction API

Elasticsearch-backed v1 API for listing, creating, reading, and refreshing predictions.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/predictions` | Create a prediction or reuse an unexpired result |
| `GET /api/predictions/popular` | Cursor-paginated featured predictions |
| `GET /api/predictions/:id` | Prediction progress or completed detail |
| `POST /api/predictions/:id/refresh` | Restart the real generation pipeline |

Predictions are persisted in Elasticsearch. Creation and refresh trigger an
asynchronous pipeline (Plan → Exa → Analyze → Report) via `lib/prediction-generator`.
