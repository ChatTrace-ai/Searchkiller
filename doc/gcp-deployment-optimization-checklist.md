# G-RapidAgent — Google Cloud 部署优化清单

> 生成时间: 2026-06-11  
> 范围: 从本地开发 → 生产级 GCP Cloud Run 部署所需的全部改造项  
> 前提: GCP 账户预算充足

---

## 阶段 0: 部署前审计（当前状态）

### 当前 GCP 服务清单

| 服务 | 用途 | 状态 |
|------|------|------|
| Vertex AI (Gemini 2.5 Flash) | 查询规划、知识抽取、LLM Judge | ✅ 已接入 |
| Vertex AI (Gemini 2.5 Pro) | 报告生成、思维导图 | ✅ 已接入 |
| Cloud Run | 应用托管 | 📋 已有配置，未部署 |
| Artifact Registry | Docker 镜像 | 📋 已有配置 |
| Cloud Build | CI/CD 构建 | 📋 已有 workflow |
| Secret Manager | API 密钥存储 | 📋 已有配置 |
| IAM + WIF | GitHub Actions 认证 | 📋 已有配置 |
| Google Custom Search | 搜索（stub） | ❌ 未实现 |

### 当前已知问题

| # | 问题 | 严重程度 | 影响 |
|---|------|----------|------|
| 1 | 11 个 Gemini 调用点中只有 1 个有重试逻辑 | 🔴 P0 | 429 错误导致用户看到 500 |
| 2 | Gemini 2.5 Pro 有 10 QPM 硬限制 | 🔴 P0 | 多用户并发时 Pro 成为瓶颈 |
| 3 | 使用区域端点而非 global endpoint | 🟡 P1 | 无法利用多区域共享池 |
| 4 | Harness 循环可能超 Cloud Run 300s timeout | 🔴 P0 | 长任务被强制终止 |
| 5 | 无流式超时（设计文档写了 30s 但未实现） | 🟡 P1 | Pro 报告生成卡住无法恢复 |
| 6 | 设计文档/代码不一致（p-limit 5 vs 3） | 🟢 P2 | 困惑，非功能性 |
| 7 | `RATE_LIMITED` API 错误码已定义但未使用 | 🟡 P1 | 前端无法区分限流和服务器错误 |

---

## 阶段 1: Gemini API 弹性改造 🔴 必须完成

### 1.1 创建统一 Gemini Client Wrapper

- [ ] 新建 `lib/gemini-client.ts`，封装以下能力:
  - 指数退避重试 (base 1500ms, max 3 retries, jitter)
  - 并发控制 (p-limit, Flash: 5, Pro: 2)
  - 超时控制 (generateObject: 30s, generateText: 120s, streamText: 180s)
  - 429/503/RESOURCE_EXHAUSTED 错误分类
  - Circuit breaker (5 次连续失败后断路 30s)
  - 结构化日志 (调用模型、延迟、成功/失败)
- [ ] 所有 Gemini 调用迁移到 wrapper:
  - `app/api/plan/route.ts`
  - `app/api/research/report/route.ts`
  - `app/api/research/mindmap/route.ts`
  - `lib/prediction-generator.ts`
  - `lib/harness-adapter.ts` (planSubQueries + SearchkillerReportGenerator)
  - `agents/evaluator/llm-judge.ts`
- [ ] 删除 `lib/knowledge-extractor.ts` 中的重复重试逻辑，统一使用 wrapper
- [ ] 单元测试: mock 429 → 验证重试 → 验证成功

### 1.2 API 路由错误处理

- [ ] 所有 `/api/*` 路由添加 try/catch
- [ ] 429 → 返回 `{ error: { code: "RATE_LIMITED" } }` + HTTP 429
- [ ] 503 → 返回 `{ error: { code: "SERVICE_UNAVAILABLE" } }` + HTTP 503
- [ ] 前端展示友好的限流提示（非通用错误页）

### 1.3 切换到 Global Endpoint

- [ ] 修改 `.env.example` 和环境变量配置:
  ```
  GOOGLE_VERTEX_LOCATION=global    # 改为 global
  ```
- [ ] 验证 `@ai-sdk/google-vertex` 支持 `global` location
  - 如不支持，需在 SDK 层面使用 `global` endpoint URL
- [ ] 测试 global endpoint 在国内/WSL 网络环境下的延迟

---

## 阶段 2: 长任务异步化 🔴 必须完成

### 2.1 Harness 反馈循环异步化

- [ ] 将 `/api/evaluate` 的 `startLoop` + `loopNext` 改为异步模式:
  - 方案 A (推荐): SSE (Server-Sent Events) 流式推送每轮结果
  - 方案 B: 分离 start (返回 loopId) + poll (轮询状态) 两个端点
  - 方案 C: WebSocket 双向通信
- [ ] 每轮独立运行，不在单个 HTTP 请求内循环
- [ ] Cloud Run timeout 保持 300s（单轮足够）

### 2.2 预测生成异步化

- [ ] `generateRealPrediction()` 已是 fire-and-forget ✅
- [ ] 添加进度查询端点 `/api/predictions/[id]/progress`
- [ ] 添加超时保护: 单个预测 > 5 分钟自动标记失败

---

## 阶段 3: Vertex AI 配额优化 🟡 强烈建议

### 3.1 DSQ Tier 升级规划

| Tier | 30 天消费 | Flash TPM | Pro TPM | 适用场景 |
|------|-----------|-----------|---------|----------|
| Tier 1 | $10-$250 | 2M | 500K | 开发/测试 |
| Tier 2 | $250-$2K | 4M | 1M | 小规模生产 |
| Tier 3 | >$2K | 10M | 2M | 正式生产 |

- [ ] 确认当前消费 Tier（登录 GCP Console → Billing）
- [ ] 评估是否需要购买 Provisioned Throughput (保证吞吐)
- [ ] 设置 Budget Alert: 50% / 80% / 100% 预算阈值

### 3.2 模型选择优化

- [ ] 评估将以下 Pro 调用降级为 Flash:
  - `mindmap/route.ts` — 结构化输出，Flash 可能足够
  - 预测管线的报告生成 — 质量要求低于主报告
- [ ] 保留 Pro 用于: 主研究报告、Harness 反馈循环的报告
- [ ] 测量 Flash vs Pro 质量差异，记录到 `doc/model-comparison.md`

### 3.3 响应缓存

- [ ] Plan 端点: 相同 keyword → 缓存子查询 (TTL 1 小时)
- [ ] Report: 相同 sessionId → 缓存报告结果 (TTL 30 分钟)
- [ ] 知识抽取: ✅ 已有 ES 缓存
- [ ] 使用 Cloud Memorystore (Redis) 或内存 LRU 缓存

---

## 阶段 4: Cloud Run 生产配置 🔴 必须完成

### 4.1 资源配置

- [ ] 确认 `memory=1Gi` 是否足够 (Next.js SSR + AI SDK + 并发)
  - 建议先部署后监控，可能需要 2Gi
- [ ] CPU=2 对于 I/O 密集型应用合适
- [ ] `min-instances=1` 避免冷启动 (成本 ~$2-5/天)
  - 生产环境考虑 `min-instances=2` 做高可用
- [ ] `max-instances=10` — 根据用户量调整
  - 计算: 每实例并发 ~80 请求（Cloud Run 默认）
  - 10 实例 → 800 并发
- [ ] 设置 `--concurrency=80`（默认 80，与 Node.js 事件循环匹配）

### 4.2 服务账号安全

- [ ] **不要使用** Compute Engine 默认服务账号
- [ ] 创建专用服务账号 `g-rapid-agent-sa@PROJECT.iam.gserviceaccount.com`
- [ ] 最小权限:
  ```
  roles/aiplatform.user          # Vertex AI
  roles/secretmanager.secretAccessor  # Secret Manager
  roles/logging.logWriter        # Cloud Logging
  roles/monitoring.metricWriter  # Cloud Monitoring
  ```
- [ ] 修改 deploy.yml 使用专用 SA

### 4.3 网络与安全

- [ ] 评估是否需要 `--allow-unauthenticated`:
  - 如果面向公网用户: 保持，但添加 Cloud Armor/WAF
  - 如果仅内部使用: 改为 `--no-allow-unauthenticated` + IAP
- [ ] 配置 Cloud Armor (DDoS 防护 + Rate Limiting)
- [ ] 设置自定义域名 + HTTPS (Cloud Run 自动提供 SSL)
- [ ] 添加 CORS 配置（如果前端和 API 分离部署）

### 4.4 环境变量与密钥

- [ ] 所有敏感信息通过 Secret Manager:
  - `EXA_API_KEY` ✅ 已配置
  - `ES_CLOUD_ID` ✅ 已配置
  - `ES_API_KEY` ✅ 已配置
- [ ] **不要**将 `GOOGLE_VERTEX_*` 放入 Secret Manager（ADC 自动处理）
- [ ] 验证 Secret Manager 版本轮换策略

---

## 阶段 5: CI/CD 加固 🟡 强烈建议

### 5.1 GitHub Actions 改进

- [ ] deploy.yml 已有完整管线 ✅ (lint → build → deploy → smoke test)
- [ ] 添加: 集成测试步骤（不依赖真实 Gemini 的单元测试）
- [ ] 添加: Dockerfile build cache (GitHub Actions cache)
- [ ] 添加: 回滚机制 (保留最近 3 个镜像 tag)
- [ ] WIF 配置验证:
  - `WIF_PROVIDER` secret 已设置？
  - `WIF_SERVICE_ACCOUNT` secret 已设置？
  - `GCP_PROJECT_ID` secret 已设置？

### 5.2 分环境部署

- [ ] 创建 staging 环境:
  - Cloud Run service: `g-rapid-agent-staging`
  - 独立 Secret Manager secrets
  - PR 触发 → 部署 staging → 手动审批 → 部署 prod
- [ ] production 保护:
  - main 分支保护规则
  - 部署需要 manual approval

---

## 阶段 6: 可观测性 🟡 强烈建议

### 6.1 日志

- [ ] 结构化日志: 所有 Gemini 调用记录 `{model, latency_ms, status, tokens_used}`
- [ ] Cloud Logging 集成 (Cloud Run 自动捕获 stdout/stderr)
- [ ] 日志 severity 分级: INFO (成功调用) / WARNING (重试) / ERROR (失败)
- [ ] 创建日志路由: Gemini 错误 → Pub/Sub → 告警

### 6.2 监控

- [ ] Cloud Monitoring Dashboard:
  - Gemini 调用成功率
  - P50/P95/P99 延迟
  - 429 错误率
  - Cloud Run 实例数 / CPU / Memory
- [ ] 使用 Vertex AI Model Garden Monitoring (DSQ 用量)
- [ ] 自定义 metrics (OpenTelemetry 或 Cloud Monitoring API):
  - `gemini_calls_total{model, status}`
  - `gemini_latency_seconds{model}`
  - `gemini_tokens_used{model, direction}`

### 6.3 告警

- [ ] Budget Alert: 50% / 80% / 100%
- [ ] Gemini 429 rate > 10% in 5min → PagerDuty/Slack
- [ ] Cloud Run error rate > 5% in 5min → alert
- [ ] Cloud Run instance count approaching max → alert
- [ ] Elasticsearch 连接失败 → alert

---

## 阶段 7: 外部依赖容灾 🟢 可选

### 7.1 Elasticsearch

- [ ] 确认 Elastic Cloud region 与 Cloud Run region 接近
- [ ] ES 连接超时配置 (当前 kNN 3s, indexing 5s — 合理)
- [ ] ES 不可用时的降级策略: 跳过知识缓存，直接调用 Gemini
- [ ] 监控 ES 响应延迟和可用性

### 7.2 Exa.ai

- [ ] 确认 Exa 免费额度 (1000 searches/month) 是否够生产
  - 不够 → 升级 Exa 付费计划
- [ ] Exa 不可用时的降级: 只使用 ES hybrid search

---

## 阶段 8: 性能优化 🟢 可选

### 8.1 Docker 镜像优化

- [ ] 当前 Dockerfile 已是多阶段构建 ✅
- [ ] 添加 `.dockerignore`: 排除 `tests/`, `doc/`, `.agents/`, `node_modules/`
- [ ] 考虑使用 `distroless` 基础镜像替代 `node:20-alpine`
- [ ] 测量镜像大小，目标 < 200MB

### 8.2 Next.js 优化

- [ ] `output: 'standalone'` ✅ 已配置
- [ ] 检查 `next.config.ts` 是否有不必要的重写/中间件
- [ ] API 路由: 考虑 Edge Runtime 适配性
  - `@ai-sdk/google-vertex` 使用 `google-auth-library`，需要 Node.js Runtime
  - **不要**将 Gemini 路由改为 Edge Runtime

### 8.3 前端性能

- [ ] 确认 `React Server Components` 使用情况
- [ ] 静态页面 ISR/SSG（首页、文档页）
- [ ] 动态路由 (research, predictions) 保持 SSR

---

## 执行顺序建议

```
Week 1: 阶段 1 (Gemini 弹性) + 阶段 4.2 (服务账号)
        ↓ 最关键的防护层
Week 2: 阶段 2 (异步化) + 阶段 4.1 (资源配置)
        ↓ 解决超时问题
Week 3: 阶段 3 (配额优化) + 阶段 5 (CI/CD)
        ↓ 初次部署到 staging
Week 4: 阶段 6 (可观测性) + 阶段 7/8 (容灾/性能)
        ↓ 切换到 production
```

---

## 快速启动：最小可行部署 (MVP)

如果你想**尽快部署**，只做以下 5 项即可上线：

1. ✅ `lib/gemini-client.ts` — 统一重试 wrapper
2. ✅ 服务账号 + IAM 权限
3. ✅ Secret Manager 配置
4. ✅ `gcloud run deploy` 执行部署
5. ✅ Smoke test 验证

总耗时预估: **2-3 小时** (不含代码改造)

---

## 参考链接

- [Vertex AI Dynamic Shared Quota](https://cloud.google.com/vertex-ai/generative-ai/docs/dynamic-shared-quota)
- [Cloud Run 部署最佳实践](https://cloud.google.com/run/docs/tips/general)
- [Gemini 2.5 模型限制 FAQ](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/faq)
- [Workload Identity Federation 设置](https://cloud.google.com/iam/docs/workload-identity-federation)
