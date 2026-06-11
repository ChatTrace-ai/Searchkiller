# Laplace's Demon

**Laplace's Demon** is an AI prediction engine built for the Google Cloud Hackathon. Ask any forward-looking question and get a probability-grounded research report with cited sources — powered by Gemini 2.5, Exa.ai neural search, and Elasticsearch's hybrid retrieval engine.

**Repository:** [github.com/ChatTrace-ai/Searchkiller](https://github.com/ChatTrace-ai/Searchkiller)

## Quick Start

```bash
# 1. Clone
git clone git@github.com:ChatTrace-ai/Searchkiller.git
cd Searchkiller

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in: GOOGLE_CLOUD_PROJECT, EXA_API_KEY, ES_CLOUD_ID, ES_API_KEY

# 4. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and ask a prediction question.

## Architecture

```
User question
  → Gemini Flash (query planner: 3–5 sub-queries)
  → Elasticsearch kNN cache (check for existing knowledge)
  → Exa.ai (semantic web search for uncovered queries)
  → Gemini extracts structured knowledge → index back to ES
  → Gemini Pro (evidence reasoning + probability estimation)
  → Streaming report with SSE real-time progress
```

## The Elastic Backbone

Elasticsearch is the central nervous system of Laplace's Demon:

- **Knowledge Cache (kNN)** — Dense vector store for incremental knowledge. Cosine similarity ≥ 0.85 eliminates redundant external searches.
- **Hybrid Retrieval (BM25 + kNN + RRF)** — Combines keyword precision with semantic understanding via Reciprocal Rank Fusion.
- **Prediction Persistence** — Every prediction, its sources, and reasoning chains are stored as structured documents.
- **Knowledge Graph Evolution** — Related queries enrich each other's evidence base over time.

## Multi-Agent System

Laplace's Demon uses a **Planner + Evaluator** dual-agent architecture with a **Harness Framework** for iterative quality improvement:

- **Planner**: Decomposes tasks, generates execution traces, orchestrates the research pipeline.
- **Evaluator**: Judges execution outcomes across 5 dimensions with automated backend probes.
- **Harness Framework**: 4-layer decoupled architecture for iterative feedback loops.

### Harness Pipeline

```
question → Plan (Flash, 6s) → Fetch (ES+Exa, 1s) → Generate (Pro, 72s) → Judge (Flash, 5s) → score
                                                                              ↓
                                               iterate with feedback ← FAIL (score < threshold)
                                               approve + archive    ← PASS (score ≥ threshold)
```

**Components**: Handoff Protocol | Sprint Contract | LLM-as-Judge | Backend Probes | Feedback Loop Engine

See [doc/harness-engineering.html](doc/harness-engineering.html) for the full technical documentation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Runtime | React 19 + TypeScript 5.4 |
| AI Models | Gemini 2.5 Pro / Flash via Vertex AI (`@ai-sdk/google-vertex`) |
| AI SDK | Vercel AI SDK v6 (`ai@^6.0`) + Zod 4 |
| Web Search | Exa.ai semantic search (`exa-js@^2.13`) |
| Knowledge Store | Elasticsearch Serverless (BM25 + kNN + RRF) |
| Visualization | react-d3-tree + Framer Motion 12 |
| Styling | TailwindCSS |
| Deployment | Docker → GCP Cloud Run |
| CI/CD | GitHub Actions → Artifact Registry → Cloud Run |

## Directory Overview

| Directory | Layer | Purpose |
|-----------|-------|---------|
| `harness/` | L0 | Generic feedback loop framework (IJudge, IReportGenerator interfaces) |
| `agents/` | L1 | Planner + Evaluator + LLM-Judge (implements harness interfaces) |
| `app/` | L2 | Next.js pages and API routes |
| `lib/` | L3 | Shared utilities + harness adapter (sole bridge between L0 and L1) |
| `components/` | — | React UI components |
| `.agents/` | — | Runtime file store (handoffs, contracts, loops, traces) |
| `tests/` | — | Unit, integration, and E2E pipeline tests |
| `scripts/` | — | SSOT verification and automation tools |
| `doc/` | — | Technical documentation |

## Deployment

```bash
# One-click deploy to Cloud Run
bash scripts/deploy-cloud-run.sh
```

See [doc/cloud-run-deploy-guide.md](doc/cloud-run-deploy-guide.md) for detailed instructions.

## License

[MIT](LICENSE)
