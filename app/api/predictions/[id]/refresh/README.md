# Refresh Prediction

`POST /api/predictions/:id/refresh` moves a completed prediction into the mock
processing state. A second refresh while processing returns `409`.
