关键词型流式分析智能体 (重构自 Company Researcher)

传统的 Company Researcher 仅支持输入单一的公司 URL 并抓取该页面。我们将其重构为一个完全自治的、由关键词驱动的智能调研系统。当用户输入任意探究性关键词（例如 “Gemini 2.5 在医疗诊断中的多模态应用趋势”）时，系统将触发一条高度自动化的流水线。

💡 核心数据流逻辑设计

$$\text{用户输入关键词} \rightarrow \text{Gemini 规划子查询} \rightarrow \text{Exa 语义化并发抓取} \rightarrow \text{Elasticsearch 混合检索过滤} \rightarrow \text{Gemini 流式输出 (Markdown 报告 + 强类型脑图 JSON)}$$

Query Planner（查询规划器）：Gemini 2.5 Flash 接收用户的原始关键词，将其拆解并生成 $3 \sim 5$ 个用于不同检索角度的、针对语义搜索引擎优化的子查询句（Sub-queries）。

Autonomous Semantic Scraping（自治语义抓取）：Next.js 后端并发调用 Exa.ai API。Exa 不依赖关键字匹配，而是进行语义检索，自动寻找最佳回答页面，抓取最干净的语义网页切片（Striped HTML & Text），完全省去了编写爬虫、绕过反爬与提取正文的繁琐过程。

Internal RAG Integration（内部知识对齐）：将抓取到的公网实时信息，与存储在 GCP 托管的 Elasticsearch 中的内部私有研究报告、行业规范进行语义混合匹配。

Coordinated Parallel Streaming（协同流式响应）：Gemini 2.5 Pro 接收海量上下文，利用 Vercel AI SDK 并发流式输出两个管道：

分析报告管道：以标准 Markdown 流式输出一份结构极其严谨的、包含引用来源的行业调研报告。

思维导图数据管道：使用强类型 responseSchema 输出一套包含 name, attributes, children 的树状结构化 JSON 对象。前端直接消费该数据并渲染为 react-d3-tree 思维导图。

🛠️ 谷歌云黑客松高分架构配置表（Keyword-to-Report 版）

层级维度

技术选型

原理与落地场景解析

基础框架

Next.js 16 App Router

充分利用其 React Server Components (RSC) 与 Edge 运行时。一键容器化部署到 GCP Cloud Run，保证高并发下极低延迟的 Edge 边缘流式分发。

前端语言

TypeScript + React 19

保证高复杂度、树状图状态频繁刷新时的类型系统与组件渲染稳定性。

UI 样式

TailwindCSS

用于构建极致优雅的响应式控制台面板。

视觉动效

Framer Motion

专为思维导图的动态展开、数据卡片的淡入淡出、以及打字机输出流设计，营造平滑而强烈的“AI 实时思考与绘制”视觉冲击力。

后端 API

Next.js Route Handlers

通过 app/api/research/route.ts 承载，天然免去搭建外部服务器的开销。

推理大脑

Google Gemini 2.5 (Pro / Flash)

通过 Vercel AI SDK @ai-sdk/google-vertex 适配器直接调用 Vertex AI。利用 Flash 进行秒级查询拆解（Query Planner），利用 Pro 进行百毫秒级的流式深度报告总结与树状 JSON 生成。

外网抓取

Exa.ai SDK / API

通过 exa.searchAndContents() 接收生成的子查询，直接检索并召回互联网高可信度网页的清洗文本（Clean Content），彻底规避传统爬虫开发。

内网检索

Elasticsearch on Google Cloud

存储历史分析报告、企业内部标准文件。与外网抓取数据进行混合检索加权（RRF 算法），提供绝对可信的上下文。

数据可视化

react-d3-tree (思维导图)

前端渲染由 Gemini 强制输出的标准化树状 JSON 结构，并配合 Framer Motion 动态动画展示 AI 自动拆解知识点的全过程。

📝 后端核心路由实现样板（Next.js App Router）

以下为写在 /app/api/research/route.ts 中的核心实现参考。它向您展示了如何接收关键词，调用 Exa 进行语义抓取，并将数据合并输入给 Gemini 生成结构化脑图 JSON 的完整极简流程：

import { google } from '@ai-sdk/google'; // Vercel AI SDK Google adapter
import { streamObject } from 'ai';
import Exa from 'exa-js';
import { z } from 'zod';

const exa = new Exa(process.env.EXA_API_KEY);

// 限制大模型必须流式输出标准的树形 JSON，以便 react-d3-tree 直接渲染
const mindMapSchema = z.object({
  name: z.string().describe('思维导图核心节点名称'),
  children: z.array(z.lazy(() => mindMapSchema)).optional().describe('子分类节点'),
  attributes: z.object({
    summary: z.string().describe('对该节点主题的简短一句话分析或事实支撑'),
    sources: z.array(z.string()).describe('引用的外部网页标题或链接')
  }).optional()
});

export async function POST(req: Request) {
  const { keyword } = await req.json();

  // 1. 调用 Exa 进行互联网高质量语义检索，自动执行数据抓取与正文清洗
  const searchResults = await exa.searchAndContents(keyword, {
    type: "neural",         // 神经/语义搜索，而非关键字匹配
    useAutoprompt: true,    // 自动将关键词转换为适合检索的 Prompts
    numResults: 5,          // 抓取最相关的 5 个高质量页面
    text: true              // 直接返回网页干净的纯文本内容
  });

  // 2. 将抓取到的多个网页正文进行格式化拼接，作为 Gemini 的 Context 上下文
  const formattedContext = searchResults.results.map((r, index) => {
    return `[文献源 #${index + 1}]\n标题: ${r.title}\n链接: ${r.url}\n核心正文内容:\n${r.text.substring(0, 3000)}`;
  }).join('\n\n');

  // 3. 调用 Gemini 2.5 模型，并将清洗后的海量数据作为 RAG 上下文输入
  const result = await streamObject({
    model: google('gemini-2.5-pro'), // 使用 Pro 级模型确保高度符合 Schema 的结构化推理
    schema: mindMapSchema,
    system: `你是一个世界顶尖的行业分析专家。你的任务是根据用户输入的【研究关键词】以及提供的【互联网实时抓取正文】，
    进行深度的逻辑整理。你需要提炼出一套具备严密逻辑层级关系的思维导图。
    要求：
    1. 必须完全基于事实，不得凭空捏造。
    2. 每个分支节点必须包含核心的一句话分析 (summary)。
    3. 标明信息来源 (sources)，引用上下文中的文献标题或链接。`,
    prompt: `研究关键词: "${keyword}"\n\n抓取到的最新网页参考数据:\n${formattedContext}`,
  });

  // 4. 以 Edge 边缘流式响应 (JSON Stream) 返回给 React 前端
  return result.toTextStreamResponse();
}
