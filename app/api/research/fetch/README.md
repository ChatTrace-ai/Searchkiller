# fetch/ — Context Retrieval Route

`POST /api/research/fetch` — Takes keyword + sub-queries, performs parallel Exa.ai semantic search and Elasticsearch hybrid retrieval, caches the combined context in-memory, and returns a session ID with source metadata.
