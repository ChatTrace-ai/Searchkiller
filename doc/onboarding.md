# Searchkiller — 新人引导手册 (从零到一)

本文档是新成员的唯一入口。从头到尾阅读一遍，你将理解**产品做了什么**以及**工程治理体系如何保证确定性**。

---

## 第一部分：程序架构

### 1.1 Searchkiller 是什么？

Searchkiller 是一个关键词驱动的流式调研智能体。用户输入任意探究性关键词（例如「Gemini 2.5 在医疗诊断中的多模态应用趋势」），系统会并行实时输出两份结果：

- 左侧面板：结构化的 **Markdown 分析报告**。
- 右侧面板：交互式**思维导图树**。

两个流同时推进 — 用户看到报告「逐字打出」的同时，脑图也在「生长」。

### 1.2 核心数据管道

```
用户关键词
  │
  ▼
Gemini 2.5 Flash  ──→  3~5 条子查询（为语义搜索优化）
  │
  ▼
Exa.ai（神经搜索）──→  高质量网页清洗正文
Elasticsearch      ──→  内部文档（BM25 + kNN 混合检索，RRF 排序）
  │
  ▼  （合并上下文，缓存到 sessionId）
  │
  ├──→  Gemini 2.5 Pro  ──→  streamText()    ──→  Markdown 报告
  └──→  Gemini 2.5 Pro  ──→  streamObject()  ──→  思维导图 JSON（react-d3-tree）
```

管道包含**四个阶段**，各自由独立 API 路由承载：

| 阶段 | API 路由 | 模型 / 服务 | 职责 |
|------|----------|-------------|------|
| 规划 | `POST /api/plan` | Gemini Flash | 将关键词拆解为 3~5 条子查询 |
| 抓取 | `POST /api/research/fetch` | Exa.ai + Elasticsearch | 并发网页抓取 + 内部 RAG |
| 报告 | `POST /api/research/report` | Gemini Pro | 流式输出 Markdown 分析报告 |
| 脑图 | `POST /api/research/mindmap` | Gemini Pro | 流式输出结构化树 JSON |

### 1.3 技术栈一览

| 层级 | 选型 | 理由 |
|------|------|------|
| 框架 | Next.js 15 App Router | RSC + Edge Runtime，一键 Docker 部署 |
| 语言 | TypeScript + React 18 | 高频流式状态更新下的类型安全 |
| AI 模型 | Gemini 2.5 Pro / Flash | Flash 负责速度（规划器），Pro 负责深度（报告 + 脑图） |
| 外网搜索 | Exa.ai | 神经语义搜索，自动清洗 HTML 为纯文本 |
| 内网检索 | Elasticsearch Serverless | BM25 + kNN 混合检索（RRF），对齐私有数据 |
| 可视化 | react-d3-tree + Framer Motion | 交互式树 + 流式「生长」动画 |
| 样式 | TailwindCSS | 深色科技风，Google Blue (#4285F4) 主色 |
| 部署 | Docker → GCP Cloud Run | Standalone 构建，自动伸缩，min-instances=1 |

### 1.4 目录地图

```
Searchkiller/
│
├── app/                    ← Next.js 页面 + API 路由
│   ├── page.tsx               首页（搜索输入框）
│   ├── research/page.tsx      调研仪表盘（双栏流式渲染）
│   └── api/
│       ├── plan/              关键词 → 子查询
│       ├── research/
│       │   ├── fetch/         Exa + ES → 会话缓存
│       │   ├── report/        Gemini Pro → Markdown 流
│       │   └── mindmap/       Gemini Pro → JSON 流
│       └── evaluate/          Evaluator 生命周期（HITL 初始化 + 自治评估）
│
├── components/             ← React UI 组件（客户端渲染，Framer Motion 动效）
│   ├── SearchInput.tsx        关键词输入表单
│   ├── StreamingReport.tsx    实时 Markdown 面板
│   ├── MindMap.tsx            D3 树 + 自定义节点
│   ├── SourceCard.tsx         参考来源链接卡片
│   └── LoadingStates.tsx      阶段感知的加载动画
│
├── lib/                    ← 纯共享工具库（零副作用）
│   ├── gemini.ts              Gemini Flash + Pro 模型实例
│   ├── exa.ts                 Exa.ai 语义搜索客户端
│   ├── elasticsearch.ts       ES 混合检索客户端
│   └── schemas.ts             Zod Schema + TypeScript 接口
│
├── agents/                 ← 多智能体编排逻辑
│   ├── planner/index.ts       Trace 发射 + 任务分解
│   ├── evaluator/index.ts     HITL 初始化 + 自治评估
│   ├── mcp/playwright-bridge.ts  Playwright 测试运行桥接
│   └── recycle.ts             反馈循环引擎
│
├── .agents/                ← 运行时 Trace 存储（git-ignored JSON）
│   ├── schemas/               JSON Schema 定义（单一事实源）
│   ├── traces/                执行追踪记录
│   ├── golden/                通过评估的模式（仅追加）
│   ├── failures/              失败模式 + root_cause
│   └── evaluator-config.json  HITL 初始化的评估器配置
│
├── tests/                  ← Playwright 测试套件
│   ├── evaluate.api.test.ts   API 端点测试
│   ├── homepage.ui.test.ts    浏览器 UI 测试
│   └── agent.state.test.ts    Agent 状态完整性测试
│
├── scripts/                ← SSOT 验证 + 自动化脚本
│   ├── verify-dual-md.sh      检查 README.md + AGENT.md 合规性
│   ├── lint-agent-md.py       校验 AGENT.md 结构
│   ├── uniformize.py          自动生成缺失的 stub
│   ├── worktree-new.sh        创建隔离的 feature worktree
│   └── worktree-list.sh       列出活跃的 worktree
│
├── doc/                    ← 纯人类参考文档（只读，无 AGENT.md）
├── AGENTS.md               ← 根级 Agent 清单（< 100 行）
├── README.md               ← 根级人类引导
├── Dockerfile              ← 多阶段 Node 20 Alpine → Cloud Run
└── package.json            ← npm scripts: dev, build, test:e2e, test:api, test:ui
```

### 1.5 请求生命周期（用户搜索时发生了什么）

```
浏览器                          服务器                           外部服务
──────                          ──────                           ────────
page.tsx
  │
  ├─ POST /api/plan ──────────→ route.ts
  │                                │
  │                                ├─ Gemini Flash ──────────→ Vertex AI
  │                                │                    ←── subQueries[]
  │  ◄── { subQueries } ──────────┘
  │
  ├─ POST /api/research/fetch ──→ route.ts
  │                                │
  │                                ├─ Exa.searchAndContents ─→ Exa.ai
  │                                ├─ ES hybridSearch ───────→ Elastic Cloud
  │                                │
  │                                └─ cache(sessionId, context)
  │  ◄── { sessionId, sources } ───┘
  │
  ├─ POST /api/research/report ─→ route.ts ─→ Gemini Pro streamText()
  │  ◄── 流式 Markdown ─────────── text chunks ──────────────→ StreamingReport
  │
  └─ POST /api/research/mindmap → route.ts ─→ Gemini Pro streamObject()
     ◄── 流式 JSON ─────────────── tree chunks ─────────────→ MindMap
```

`report` 和 `mindmap` 两个流**并行执行** — 用户同时看到两个面板在更新。

---

## 第二部分：Harness Engineering（治理工程）

### 2.1 什么是 Harness Engineering？

在 Searchkiller 中，**仓库本身就是 Agent 的运行时**。`.agents/` 目录下的文件系统充当确定性状态机。每个 Agent 动作都会在磁盘上产生一条 Trace 记录。这种模式叫做 **Harness Engineering** — 仓库结构约束了 Agent 的行为边界，使所有行为可审计，防止不确定性。

三个核心原则：

1. **仓库即 Trace 系统** — 每次 Agent 动作都写一条 JSON trace 到 `.agents/traces/`。
2. **双 Markdown 隔离** — 每个目录同时包含 `README.md`（给人看）+ `AGENT.md`（给机器看）。
3. **HITL 初始化自治** — 人类配置一次 Evaluator，之后它自主运行，无需人类干预。

### 2.2 两个 Agent

```
                    ┌───────────────────────────────┐
                    │        Human（HITL）           │
                    │  定义评估标准                    │
                    └───────────┬───────────────────┘
                                │ initialize（一次性）
                                ▼
┌──────────────┐         ┌──────────────────┐
│   Planner    │──trace──│   Evaluator      │
│              │         │  （自治运行）       │
│ 分解关键词，   │         │                  │
│ 发射 trace   │         │ 加载配置，         │
│ (PENDING)    │         │ 执行检查，         │
│              │         │ 路由裁决           │
└──────────────┘         └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
           .agents/golden/             .agents/failures/
           (APPROVED)                  (REJECTED + root_cause)
```

**Planner**（`agents/planner/index.ts`）：
- 接收关键词 + 子查询。
- 创建 SHA-256 内容寻址的 Trace 记录。
- 写入 `.agents/traces/{id}.json`，verdict 为 `PENDING`。
- 委托给 Evaluator。

**Evaluator**（`agents/evaluator/index.ts`）：
- 必须**先由人类初始化**（这就是 HITL 步骤）。
- 人类定义：标准、阈值、自定义规则、Playwright 测试配置。
- 配置持久化到 `.agents/evaluator-config.json`。
- 初始化后，Evaluator 对每条 Trace **自主**运行：
  - 加载 Trace + 持久化配置。
  - 执行质量检查（Schema 合法？输出非空？命中已知失败模式？延迟是否达标？自定义规则通过？Playwright 测试通过？）。
  - 全部通过 → `APPROVED` → 写入 `.agents/golden/`。
  - 任意失败 → `REJECTED` → 写入 `.agents/failures/`，附带 `root_cause` 和 `lesson`。

### 2.3 Recycle Pattern（回收模式 / 反馈循环）

每次评估**恰好路由到一个**存储：

| 存储 | 路径 | 策略 | 用途 |
|------|------|------|------|
| Golden 基准库 | `.agents/golden/` | 仅追加 | 回归测试基线 |
| 失败模式池 | `.agents/failures/` | 按 `root_cause` 可查询 | 预筛选未来 Trace |

在评估新 Trace 之前，Evaluator 会检查 `.agents/failures/` 中是否有相似历史失败，并附带警告。这形成了一个自我改进的闭环：

```
评估 → 失败 → 记录 root_cause → 下次评估检查失败池 → 规避重复错误
```

### 2.4 双 Markdown 模式

除 `doc/` 外的每个目录都包含两个文件：

| 文件 | 受众 | 内容 |
|------|------|------|
| `README.md` | 人类 | 引导说明、意图、高层上下文 |
| `AGENT.md` | 机器 | 文件清单、读写边界、不变量 |

`AGENT.md` 遵循严格结构：`## Role`、`## Contents`（表格）、`## Boundaries`（读/写权限）。由 `scripts/lint-agent-md.py` 强制校验。

验证合规性：
```bash
bash scripts/verify-dual-md.sh   # 22 个目录，0 个缺失
python scripts/lint-agent-md.py  # 22 个 AGENT.md，0 个错误
```

### 2.5 权限层级

import 方向**只能向下**，任何低层都不能引用高层。

```
L0  根配置         (AGENTS.md, package.json)
 ↓
L1  agents/        编排逻辑；读 L2，写 .agents/
 ↓
L2  app/           路由 + 页面；读 L3；禁止引入 agents/
 ↓
L3  lib/           纯工具函数；零副作用
 ↓
L4  components/    仅 UI；读 lib/ 类型；不直接调 API
 ↓
L5  scripts/       验证工具；可读一切，不写任何东西
```

### 2.6 SSOT 强制执行

所有结构化数据按 `.agents/schemas/` 下的 JSON Schema 校验：

| Schema 文件 | 校验对象 |
|-------------|---------|
| `trace.schema.json` | `.agents/traces/` 中的 Trace 记录 |
| `evaluation.schema.json` | `golden/` 和 `failures/` 中的裁决 |
| `evaluator-config.schema.json` | HITL 初始化的 Evaluator 配置 |
| `agent-md.schema.json` | 所有 `AGENT.md` 文件的结构 |

### 2.7 Playwright MCP 桥接

Evaluator 可选地将 Playwright 测试纳入质量检查。当 `config.playwright.enabled` 为 true 时，它会调用 `agents/mcp/playwright-bridge.ts`，执行测试套件并将结构化结果（通过/失败/跳过）反馈到裁决流程中。

三个测试项目：
- `api` — 测试 `/api/evaluate` 和 `/api/plan` 端点。
- `ui` — 测试首页渲染、导航、暗色主题。
- `state` — 测试 `.agents/` 目录完整性、配置生命周期、Trace 路由。

### 2.8 Git Worktree 工作流

使用隔离的 worktree 并行开发特性 — 不需要切换分支：

```bash
bash scripts/worktree-new.sh my-feature
# 创建: ../Searchkiller-my-feature/ 在 feat/my-feature 分支上

cd ../Searchkiller-my-feature
npm install && npm run dev

# 完成后：
git worktree remove ../Searchkiller-my-feature
```

---

## 新人快速上手

```bash
# 1. 克隆仓库
git clone git@github.com:ChatTrace-ai/Searchkiller.git
cd Searchkiller

# 2. 安装依赖
npm install
npx playwright install chromium   # 用于测试

# 3. 配置环境变量
cp .env.example .env
# 填入: GOOGLE_CLOUD_PROJECT, EXA_API_KEY, ES_CLOUD_ID, ES_API_KEY

# 4. 启动开发服务器
npm run dev

# 5. 初始化 Evaluator（HITL — 只需执行一次）
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "initialize",
    "initialized_by": "你的名字",
    "criteria": {
      "require_schema_valid": true,
      "require_output_non_empty": true,
      "reject_known_failure_patterns": true
    },
    "thresholds": { "max_latency_ms": 30000 },
    "auto_approve": true
  }'

# 6. 验证仓库结构
bash scripts/verify-dual-md.sh
python scripts/lint-agent-md.py

# 7. 运行测试
npm run test:e2e
```

---

## 延伸阅读

| 主题 | 文档 |
|------|------|
| 系统清单（Agent 权限、Trace 契约） | [AGENTS.md](../AGENTS.md) |
| Evaluator API 参考 + 配置 Schema | [harness-engineering.md](harness-engineering.md) |
| 原始设计文档（含 Mermaid 架构图） | [2026-06-07-g-rapid-agent-design.md](2026-06-07-g-rapid-agent-design.md) |
| Cloud Run 部署指南 | [cloud-run-deploy-guide.md](cloud-run-deploy-guide.md) |
| GitHub Actions CI/CD | [github-actions-setup.md](github-actions-setup.md) |
