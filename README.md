# Searchkiller

**Searchkiller**（内部代号 G-RapidAgent）是一个面向 Google Cloud Hackathon 的关键词驱动流式调研智能体。输入任意探究性关键词，即可获得结构化行业分析报告与交互式思维导图，由 Gemini 2.5、Exa.ai 语义搜索与 Elasticsearch 混合检索驱动。

**Repository:** [github.com/ChatTrace-ai/Searchkiller](https://github.com/ChatTrace-ai/Searchkiller)

## Quick Start

```bash
# 1. Clone
git clone git@github.com:ChatTrace-ai/Searchkiller.git
cd Searchkiller

# 2. Install dependencies
npm install

# 3. Configure Google Cloud (Vertex AI — uses GCP credits, no API key)
gcloud config set project YOUR_PROJECT_ID
gcloud auth application-default login
gcloud services enable aiplatform.googleapis.com

# 4. Configure environment
cp .env.example .env
# Fill in: GOOGLE_CLOUD_PROJECT, EXA_API_KEY, ES_CLOUD_ID, ES_API_KEY

# 5. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter a research keyword.

## Architecture

```
User keyword
  → Gemini Flash (query planner: 3-5 sub-queries)
  → Exa.ai (semantic web scraping, parallel)
  → Elasticsearch (hybrid BM25 + kNN against internal docs)
  → Gemini Pro (parallel streaming):
      ├── Markdown analysis report
      └── Structured mind-map JSON → react-d3-tree
```

## Multi-Agent System

Searchkiller uses a **Planner + Evaluator** dual-agent architecture:

- **Planner**: Decomposes tasks, generates execution traces, orchestrates the research pipeline.
- **Evaluator (HITL)**: Judges execution outcomes with mandatory human-in-the-loop approval before finalizing any evaluation state.

See [AGENTS.md](AGENTS.md) for the full system manifest.

## Repository as Trace System

Every directory (except `doc/`) contains:
- `README.md` — Human onboarding and context
- `AGENT.md` — Machine-readable operational manifest

Run verification:
```bash
bash scripts/verify-dual-md.sh   # Check dual-markdown compliance
python scripts/lint-agent-md.py  # Validate AGENT.md schemas
python scripts/uniformize.py     # Auto-fix structural drift
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Edge Runtime) |
| AI Models | Gemini 2.5 Pro / Flash via Vertex AI |
| Web Search | Exa.ai semantic search |
| Internal Search | Elasticsearch Serverless (BM25 + kNN) |
| Visualization | react-d3-tree + Framer Motion |
| Styling | TailwindCSS |
| Deployment | Docker → GCP Cloud Run |

## Parallel Development

Uses `git worktree` for isolated feature branches:
```bash
bash scripts/worktree-new.sh my-feature
# Creates ../Searchkiller-my-feature on branch feat/my-feature
```

## Directory Overview

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js pages and API routes |
| `components/` | React UI components |
| `lib/` | Shared utilities (Gemini, Exa, ES clients, schemas) |
| `agents/` | Planner + Evaluator agent logic |
| `.agents/` | Runtime trace store (schemas, golden benchmarks, failures) |
| `scripts/` | SSOT verification and automation tools |
| `doc/` | Read-only external reference material |

## License

Hackathon project — not yet licensed.
