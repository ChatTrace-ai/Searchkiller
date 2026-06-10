# Harness Feedback Loop — 设计文档

> 状态：**IMPLEMENTED** — 核心引擎已完成  
> 实施日期：2026-06-10

## 1. 目标

将当前的**单次评估**升级为 **多轮迭代反馈循环（5-15 轮）**，实现 Generator ↔ Evaluator 的闭环。

## 2. 核心决策

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 评估方式 | LLM-as-Judge (Gemini API) | 纯 API 调用，速度快成本低 |
| 迭代方式 | 半自动 HITL | 每轮评估后用户确认是否继续 |
| 迭代上限 | 5-15 轮（可配置） | 平衡质量和资源消耗 |
| 应用层面 | 后端报告/脑图质量 | 前端后续留入口 |

## 3. 架构设计

### 3.1 新增文件

```
agents/
├── feedback-loop.ts          # 反馈循环引擎（核心）
├── evaluator/
│   ├── index.ts              # 现有（不动）
│   └── llm-judge.ts          # 新增：LLM-as-Judge 评分器
```

### 3.2 API 扩展

扩展 `POST /api/evaluate` 新增 4 个 action：

| Action | 输入 | 输出 | 说明 |
|--------|------|------|------|
| `start_loop` | `{ keyword, maxRounds?, config? }` | `{ loopId, round:1, report, score, feedback }` | 启动循环，生成第1版并评分 |
| `loop_next` | `{ loopId, userFeedback? }` | `{ round:N, report, score, feedback, delta }` | 根据反馈重生成+再评分 |
| `loop_approve` | `{ loopId }` | `{ status:'approved', finalReport, goldenId }` | 将当前版本标记为 golden |
| `loop_status` | `{ loopId }` | `{ rounds[], currentRound, bestScore, state }` | 查看循环状态 |

### 3.3 HITL 流程

```
用户调用 start_loop(keyword)
  │
  ▼
后端生成第1版报告 → LLM-as-Judge 评分 → 返回 {round:1, report, score, feedback}
  │
  ▼
用户查看评分和反馈
  ├── 满意 → loop_approve(loopId) → 标记 golden，结束
  ├── 不满意 → loop_next(loopId, userFeedback?) → 生成第2版...
  └── 放弃 → 不再调用，循环超时自动归档
  
循环继续直到：
  • 用户 approve
  • 达到 maxRounds 上限
  • 评分达到 hard threshold（自动 approve）
```

### 3.4 LLM-as-Judge 评分维度（待评分标准组件细化）

初步 4 维：
- **事实准确性** (Factual Accuracy)
- **结构完整性** (Structural Completeness)
- **信息深度** (Depth of Analysis)
- **引用质量** (Citation Quality)

每维 1-10 分，加权总分 + 硬阈值。

## 4. 实际实现

### 4.1 新增文件清单

| 文件 | 行数 | 功能 |
|------|------|------|
| `agents/handoff.ts` | ~285 | 结构化 Handoff 协议 — 类型化合约 + 文件存储 + Reset |
| `agents/sprint-contract.ts` | ~280 | Sprint 合约 — 协商验收标准 + 4维评分 + 硬阈值 |
| `agents/evaluator/llm-judge.ts` | ~120 | LLM-as-Judge — Gemini Flash 评分 + 结构化反馈 |
| `agents/feedback-loop.ts` | ~300 | 反馈循环引擎 — 整合上述三者的完整 HITL 迭代循环 |
| `tests/handoff.unit.test.ts` | ~170 | Handoff 协议单元测试 (7 tests) |
| `tests/sprint-contract.unit.test.ts` | ~200 | Sprint 合约单元测试 (12 tests) |
| `tests/llm-judge.unit.test.ts` | ~80 | LLM-Judge 辅助函数测试 (3 tests) |

### 4.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `agents/planner/index.ts` | TraceRecord + PlanResult 增加 handoffId 字段 |
| `agents/evaluator/index.ts` | evaluate() 加载关联 HandoffDocument，EvaluationRecord 携带 handoffId |
| `app/api/evaluate/route.ts` | 新增 6 个 feedback loop API actions |

### 4.3 API 扩展

`POST /api/evaluate` 新增的 actions:

| Action | 输入 | 输出 |
|--------|------|------|
| `start_loop` | `{ keyword, subQueries?, sources?, maxRounds? }` | `{ loop, latestRound, sprintComplete }` |
| `loop_next` | `{ loopId, userFeedback? }` | `{ loop, latestRound, sprintComplete }` |
| `loop_approve` | `{ loopId }` | `{ status, loop, summary }` |
| `loop_cancel` | `{ loopId, reason? }` | `{ status, loop }` |
| `loop_status` | `{ loopId }` | `{ loop, summary }` |
| `loop_list` | — | `{ loops, count }` |

### 4.4 .agents/ 目录结构

```
.agents/
├── evaluator-config.json     # HITL 初始化的评估配置
├── traces/                   # 执行追踪记录
├── golden/                   # 通过审批的高质量结果
├── failures/                 # 未通过的结果
├── handoffs/                 # 结构化 Handoff 文档
│   └── _archive/             # 归档的旧 Handoff
├── contracts/                # Sprint 合约
└── loops/                    # 反馈循环状态
```

## 5. 依赖关系（已实现）

```
agents/handoff.ts         ← 文件存储、类型化合约、Reset/Archive
agents/sprint-contract.ts ← 4维评分维度、硬阈值、合约生命周期
agents/evaluator/llm-judge.ts ← Gemini Flash 评分、结构化反馈
agents/feedback-loop.ts   ← 整合上述三者 + HITL 循环
app/api/evaluate/route.ts ← HTTP API 入口
```

## 6. 前端入口（待实现）

研究页面 `app/research/page.tsx` 新增"评估并优化"按钮，调用 `start_loop` 进入迭代模式。
