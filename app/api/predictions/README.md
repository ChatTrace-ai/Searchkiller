# Prediction API

Elasticsearch-backed v1 API for listing, creating, reading, and refreshing predictions.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/predictions` | Create a prediction or reuse an unexpired result |
| `GET /api/predictions/popular` | Cursor-paginated featured predictions |
| `GET /api/predictions/:id` | Prediction progress or completed detail |
| `GET /api/predictions/:id/events` | Reserved SSE stream for live generation events |
| `POST /api/predictions/:id/refresh` | Restart the real generation pipeline |

Predictions are persisted in Elasticsearch. Creation and refresh trigger an
asynchronous pipeline (Plan → Exa → Analyze → Report) via `lib/prediction-generator`.

## Prediction Event Stream Contract

`GET /api/predictions/:id/events` is the frozen contract for the live generation
stream. The route is reserved but is not implemented in phase one.

Request:

```http
GET /api/predictions/pred_01JXYZ/events
Accept: text/event-stream
```

Expected response headers:

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Each SSE frame uses the event type as the `event` field, the revision as `id`,
and a complete `PredictionStreamEvent` JSON object as `data`:

```text
event: snapshot
id: 1
data: {"type":"snapshot","revision":1,"occurredAt":"2026-06-11T10:00:00Z","data":{"stage":"planning","message":"Planning focused research queries","queries":[],"sources":[],"draftOutcomes":[],"reportPreview":""}}
```

Revisions are positive integers and strictly increase within one prediction.
Consumers must ignore events whose revision is less than or equal to the latest
applied revision. `occurredAt` is an ISO 8601 timestamp.

### Events

| Event | Payload behavior |
|-------|------------------|
| `snapshot` | Full accumulated stream state. It must be the first business event on every connection. |
| `stage` | Replaces the current stage and message. |
| `queries` | Replaces the accumulated search query list. |
| `sources` | Replaces the accumulated source list; source bodies are never exposed. |
| `outcomes` | Replaces the current draft probability list. |
| `report_delta` | Appends `delta` to the current report preview. |
| `completed` | Signals that the client must fetch `GET /api/predictions/:id` for the final detail. |
| `failed` | Stops streaming and exposes a stable error code plus a user-facing message. |

Snapshot example:

```json
{
  "type": "snapshot",
  "revision": 7,
  "occurredAt": "2026-06-11T10:00:12Z",
  "data": {
    "stage": "estimating",
    "message": "Analyzing sources and estimating probabilities",
    "queries": [
      "Latest team form and rankings",
      "Current injuries and squad availability"
    ],
    "sources": [
      {
        "id": "source-1",
        "title": "FIFA World Ranking",
        "url": "https://example.com/ranking",
        "description": "Latest international team rankings"
      }
    ],
    "draftOutcomes": [
      {
        "label": "Spain",
        "probability": 16.4,
        "rationale": "Strong recent form and squad consistency."
      }
    ],
    "reportPreview": "## Forecast analysis\n"
  }
}
```

Delta examples:

```text
event: stage
id: 8
data: {"type":"stage","revision":8,"occurredAt":"2026-06-11T10:00:14Z","data":{"stage":"writing_report","message":"Generating detailed analysis report"}}

event: report_delta
id: 9
data: {"type":"report_delta","revision":9,"occurredAt":"2026-06-11T10:00:15Z","data":{"delta":"Spain leads the current estimate..."}}

event: completed
id: 10
data: {"type":"completed","revision":10,"occurredAt":"2026-06-11T10:00:20Z","data":{"id":"pred_01JXYZ"}}
```

### Responsibilities

- Backend: emit a full `snapshot` first, preserve revision ordering, send
  heartbeat comments, and end with `completed` or `failed`.
- Frontend: apply events idempotently, rebuild from `snapshot`, use the existing
  detail endpoint for final data, and retain polling as the fallback transport.
- Phase one does not add the SSE route, Mock stream, EventSource client, or
  change the existing create/detail endpoint responses.
