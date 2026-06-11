# Refresh Prediction

`POST /api/predictions/:id/refresh` moves a completed prediction back into
processing and restarts the real generation pipeline (`lib/prediction-generator`).
A second refresh while processing returns `409`.
