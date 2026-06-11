# prediction/ — Agent Manifest

## Role
Prediction result page and processing-state orchestration.

## Contents
| Path | Description |
|------|-------------|
| [id]/page.tsx | Polls and renders a prediction by ID |

## Boundaries
- reads: components/, lib/prediction-types
- writes: NONE
- API calls: GET /api/predictions/:id
