# prediction/ — Agent Manifest

## Role
Prediction result page and processing-state orchestration.

## Contents
| Path | Description |
|------|-------------|
| [id]/page.tsx | Polls and renders a prediction by ID |
| prediction-stream-client.ts | Mock and EventSource transport implementations |
| prediction-stream-state.ts | Pure revision checks and event reducer |
| use-prediction-stream.ts | Client stream subscription and fallback state |

## Boundaries
- reads: components/, lib/prediction-types
- writes: NONE
- API calls: GET /api/predictions/:id and optional GET /api/predictions/:id/events
