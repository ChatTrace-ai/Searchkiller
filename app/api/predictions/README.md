# Prediction API

Mock-backed v1 API for listing, creating, reading, and refreshing predictions.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/predictions` | Create a prediction or reuse an unexpired result |
| `GET /api/predictions/popular` | Cursor-paginated featured predictions |
| `GET /api/predictions/:id` | Prediction progress or completed detail |
| `POST /api/predictions/:id/refresh` | Restart mock generation |

The in-memory repository simulates a two-second generation cycle and exposes the
same response contract intended for the future persistent implementation.
