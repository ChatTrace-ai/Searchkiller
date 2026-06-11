# 后端 Evaluator 重构设计文档

> 状态：HITL 协商完成，待实现
> 日期：2026-06-11
> 协商参与者：用户 + AI Agent

## 1. 背景与动机

### 1.1 产品转向

Searchkiller 从"通用研究报告生成器"转向"预测分析引擎"：
- 输入：预测主题（如"世界杯冠军"）
- 输出：概率分析 + 可视化图表
- MVP：固定的世界杯预测，不带缓存

### 1.2 现有 Evaluator 的问题

当前 Evaluator 设计面向**报告内容质量**（4 维 LLM-as-Judge），但 MVP 阶段的核心痛点是**后端工程质量**：
- ES 连接不稳定（`ES_CLOUD_ID` 配置问题）
- API 调用链路长（Plan → Fetch → Generate），任一环节失败需要优雅处理
- 缓存逻辑简陋（30min TTL 的 Map，无命中率监控）
- 数据完整性无校验（Source 对象可能有空字段）

### 1.3 设计原则

1. **不需要 LLM** — 全自动化探针 + 阈值判定，单次评估 <1s
2. **可集成 CI/CD** — `npm run evaluate` 即可运行
3. **复用 HITL 初始化** — 阈值通过 `initializeEvaluator()` 配置
4. **增量实现** — 5 个维度可独立开发和测试

---

## 2. 评分维度（5 维）

### D1: api_reliability（API 可靠性） — 权重 25%

**检测什么**：所有后端 API 端点是否在 SLA 内正常响应

**探针逻辑**：
```
对每个端点发送真实请求：
  POST /api/plan         { keyword: "测试主题" }     → SLA: <10s
  POST /api/research/fetch  { keyword, subQueries }  → SLA: <5s
  POST /api/research/report { sessionId }            → SLA: <120s
  POST /api/evaluate     { action: "stats" }         → SLA: <2s

检查：
  - HTTP 2xx 响应
  - 响应体是合法 JSON
  - 关键字段存在（如 subQueries.length >= 3）
  - 延迟 < SLA 阈值
```

**评分公式**：
```
score = (通过端点数 / 总端点数) × 10
```

**硬阈值**：通过率 > 90%（即至少 90% 端点通过）

**HITL 可配置项**：
- SLA 阈值（每个端点的最大延迟 ms）
- 需要测试的端点列表
- 是否包含 report 端点（需要真实 Gemini 调用）

---

### D2: search_quality（搜索质量） — 权重 25%

**检测什么**：Exa + ES 搜索是否返回足够且相关的结果

**探针逻辑**：
```
使用标准测试查询执行搜索：
  semanticSearch(["世界杯冠军预测 2026"])
  hybridSearch("World Cup 2026 champion prediction")

检查：
  - Exa 返回来源数 >= min_exa_sources（默认 3）
  - ES 返回来源数 >= min_es_sources（默认 0，允许 ES 宕机）
  - 去重后总来源数 >= min_total_sources（默认 3）
  - snippet 非空率 >= 80%
  - 无重复 URL
```

**评分公式**：
```
sub_scores = [
  exa_count >= threshold ? 1 : exa_count / threshold,
  es_healthy ? 1 : 0.5,        // ES 宕机不直接零分
  dedup_count >= threshold ? 1 : dedup_count / threshold,
  snippet_non_empty_rate,
  no_duplicate_urls ? 1 : 0.8,
]
score = average(sub_scores) × 10
```

**硬阈值**：总来源数 >= 3

**HITL 可配置项**：
- 测试查询（可自定义或使用默认）
- 各来源最低数量
- snippet 非空率阈值

---

### D3: data_integrity（数据完整性） — 权重 20%

**检测什么**：管道输出的数据格式和完整性

**探针逻辑**：
```
对 /api/plan 的输出校验：
  - subQueries 是 string[]
  - length 在 [3, 5] 范围
  - 每条 query 非空

对 /api/research/fetch 的输出校验：
  - sessionId 是 UUID 格式
  - sources 是 Source[]
  - 每个 Source: title 非空, url 合法, text 非空
  - 无重复 URL

对 contextCache 校验：
  - sessionId 存在于 cache
  - cache 中的 keyword, subQueries, formattedContext 非空
```

**评分公式**：
```
score = (通过校验项 / 总校验项) × 10
```

**硬阈值**：0 个 invalid 字段（严格模式），或 invalid < 2（宽松模式）

---

### D4: cache_effectiveness（缓存有效性） — 权重 15%

**检测什么**：缓存是否正常工作

**探针逻辑**：
```
1. 发送 fetch 请求 → 获取 sessionId
2. 用同一 sessionId 请求 report → 应命中缓存
3. 等待 TTL 过期 → 重新请求 → 应 404 或重新生成
4. 检查缓存大小不超过合理值
```

**评分公式**：
```
sub_scores = [
  cache_hit ? 1 : 0,
  cache_data_complete ? 1 : 0,
  cache_size_reasonable ? 1 : 0,
]
score = average(sub_scores) × 10
```

**硬阈值**：cache 命中率 > 0（至少能命中一次）

**注意**：MVP 阶段"不带缓存"——此维度在 MVP 中可设为 weight=0 禁用，后续再启用。

---

### D5: graceful_degradation（优雅降级） — 权重 15%

**检测什么**：当部分服务不可用时，系统是否仍能返回有意义的结果

**探针逻辑（故障注入）**：
```
场景 1: ES 不可用
  - 设置 ES_CLOUD_ID="" 或模拟连接超时
  - 调用 fetchSources() → 应仍返回 Exa 结果（>0 条）
  - 不应抛出未捕获异常

场景 2: Exa 不可用
  - 设置 EXA_API_KEY="" 或模拟 API 错误
  - 调用 fetchSources() → 应仍返回 ES 结果（如果 ES 可用）
  - 不应抛出未捕获异常

场景 3: 两者均不可用
  - 调用 fetchSources() → 应返回空数组 []
  - 调用 startLoop() → 应返回有意义的错误（而非崩溃）

场景 4: sessionId 无效
  - 调用 report(invalidSessionId) → 应返回 404
  - 不应 500 或崩溃
```

**评分公式**：
```
score = (通过降级场景数 / 总场景数) × 10
```

**硬阈值**：系统在任何场景下不崩溃（no uncaught exceptions）

---

## 3. 实现架构

### 3.1 文件结构

```
agents/evaluator/
├── index.ts              ← 现有 HITL 初始化 + 评估入口（重构）
├── llm-judge.ts          ← 保留（用于内容质量评估，可选启用）
├── probes/               ← 新增：自动化探针
│   ├── api-reliability.ts     D1 探针
│   ├── search-quality.ts      D2 探针
│   ├── data-integrity.ts      D3 探针
│   ├── cache-effectiveness.ts D4 探针
│   └── graceful-degradation.ts D5 探针
└── backend-evaluator.ts  ← 新增：后端评估协调器
```

### 3.2 核心接口

```typescript
interface ProbeResult {
  dimension: string;
  score: number;          // 0-10
  passed: boolean;        // score >= hardThreshold
  details: ProbeDetail[];
  durationMs: number;
}

interface ProbeDetail {
  check: string;          // 检查项名称
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

interface BackendEvalConfig {
  dimensions: {
    name: string;
    weight: number;
    hardThreshold: number;
    enabled: boolean;
  }[];
  apiEndpoints: {
    path: string;
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
    slaMs: number;
  }[];
  searchTestQueries: string[];
  baseUrl: string;        // 默认 http://localhost:3000
}

interface BackendEvalResult {
  timestamp: string;
  weightedScore: number;
  allPassed: boolean;
  probes: ProbeResult[];
  config: BackendEvalConfig;
}
```

### 3.3 与现有代码的关系

| 现有模块 | 处理方式 |
|----------|---------|
| `evaluator/index.ts` | 保留 HITL 初始化框架，增加 `BackendEvalConfig` 类型 |
| `evaluator/llm-judge.ts` | 保留不动，可选启用（用于内容质量补充评估） |
| `harness/sprint-contract.ts` | 保留，`ScoreDimension` 类型兼容新维度 |
| `harness/feedback-loop.ts` | 保留，后端评估结果可注入到 loop 中 |
| `lib/harness-adapter.ts` | 新增 `runBackendEval()` 导出 |

### 3.4 HITL 初始化流程

```
POST /api/evaluate
{
  "action": "initialize_backend",
  "initialized_by": "developer_name",
  "config": {
    "dimensions": [
      { "name": "api_reliability",      "weight": 0.25, "hardThreshold": 9, "enabled": true },
      { "name": "search_quality",       "weight": 0.25, "hardThreshold": 6, "enabled": true },
      { "name": "data_integrity",       "weight": 0.20, "hardThreshold": 8, "enabled": true },
      { "name": "cache_effectiveness",  "weight": 0.15, "hardThreshold": 0, "enabled": false },
      { "name": "graceful_degradation", "weight": 0.15, "hardThreshold": 8, "enabled": true }
    ],
    "baseUrl": "http://localhost:3000",
    "searchTestQueries": ["世界杯 2026 冠军预测", "World Cup champion prediction"]
  }
}
```

---

## 4. 实现策略

**先完整 MVP，后优化性能。** 一次性实现全部 5 个探针，确保结果可验证后再做性能优化。

| 步骤 | 内容 |
|------|------|
| 1 | 探针框架 + 类型定义 + BackendEvaluator 协调器 |
| 2 | 5 个探针全部实现（api, search, integrity, cache, degradation） |
| 3 | 集成测试：dev server 运行下跑全量评估 |
| 4 | HITL 初始化 API 接入 |
| 5 | 结果可验证后，再优化性能瓶颈 |

---

## 5. 测试策略

```bash
# 单维度测试
npx tsx tests/probes/api-reliability.test.ts
npx tsx tests/probes/search-quality.test.ts

# 全维度评估（需要 dev server 运行）
npm run dev &
npx tsx tests/backend-eval.integration.test.ts

# CI 模式（headless，无交互）
npx tsx agents/evaluator/backend-evaluator.ts --ci --base-url=http://localhost:3000
```

---

## 6. HITL 决策记录

| 决策 | 选项 | 结论 | 理由 |
|------|------|------|------|
| 评估对象 | 报告内容 vs 后端服务质量 | **后端服务质量** | 当前痛点是 ES 连接、API 稳定性 |
| 评估方式 | LLM-Judge vs 自动化探针 | **自动化探针** | 不需要 LLM，速度快，可集成 CI |
| 维度数量 | 4 维 vs 5 维 | **5 维**（含 graceful_degradation） | 用户明确要求优雅降级评估 |
| cache 维度 | 启用 vs 禁用 | **MVP 阶段禁用** (weight=0) | MVP 策略"不带缓存" |
