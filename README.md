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

# 3. Configure environment
cp .env.example .env
# Fill in: GOOGLE_CLOUD_PROJECT, EXA_API_KEY, ES_CLOUD_ID, ES_API_KEY

# 4. Run development server
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

Searchkiller uses a **Planner + Evaluator** dual-agent architecture with a **Harness Framework** for iterative quality improvement:

- **Planner**: Decomposes tasks, generates execution traces, orchestrates the research pipeline.
- **Evaluator (HITL)**: Judges execution outcomes with mandatory human-in-the-loop approval.
- **Harness Framework**: 4-layer decoupled architecture for iterative feedback loops.

### Harness Pipeline (Full-Auto)

```
keyword → Plan (Flash, 6s) → Fetch (Exa+ES, 1s) → Generate (Pro, 72s) → Judge (Flash, 5s) → score
                                                                              ↓
                                               iterate with feedback ← FAIL (score < threshold)
                                               approve + archive    ← PASS (score >= threshold)
```

**Components**: Handoff Protocol | Sprint Contract | LLM-as-Judge | Feedback Loop Engine

See [doc/harness-engineering.html](doc/harness-engineering.html) for the full technical documentation with interactive diagrams.

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
| Framework | Next.js 16 (App Router, Turbopack) |
| Runtime | React 19 + TypeScript 5.4 |
| AI Models | Gemini 2.5 Pro / Flash via Vertex AI (`@ai-sdk/google-vertex`) |
| AI SDK | Vercel AI SDK v6 (`ai@^6.0`) + Zod 4 |
| Web Search | Exa.ai semantic search (`exa-js@^2.13`) |
| Internal Search | Elasticsearch Serverless (BM25 + kNN) |
| Visualization | react-d3-tree + Framer Motion 12 |
| Styling | TailwindCSS |
| Deployment | Docker → GCP Cloud Run |

## Parallel Development

Uses `git worktree` for isolated feature branches:
```bash
bash scripts/worktree-new.sh my-feature
# Creates ../Searchkiller-my-feature on branch feat/my-feature
```

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
| `doc/` | — | Technical documentation (harness-engineering.html) |

## License

Hackathon project — not yet licensed.
