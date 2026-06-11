# Prediction Detail Page

Client-rendered prediction result pages under `/prediction/:id`. The page keeps
the existing detail polling for final status and uses a prediction stream client
for live queries, sources, draft outcomes, and report text.

`NEXT_PUBLIC_PREDICTION_STREAM_MODE=real` enables the real EventSource client.
Any other value uses the default Mock stream for frontend development.
