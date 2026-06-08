# G-RapidAgent Cloud Run 部署指南

## 前置条件

1. 已安装 [gcloud CLI](https://cloud.google.com/sdk/docs/install)
2. GCP 项目已开通以下 API：
   - Cloud Run Admin API
   - Artifact Registry API
   - Vertex AI API
   - Cloud Build API

```bash
# 一键开通所有需要的 API
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  --project=YOUR_PROJECT_ID
```

## 步骤 1：配置 gcloud

```bash
# 登录并设置项目
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region us-central1
```

## 步骤 2：创建 Artifact Registry 仓库

```bash
gcloud artifacts repositories create g-rapid-agent \
  --repository-format=docker \
  --location=us-central1 \
  --description="G-RapidAgent container images"
```

## 步骤 3：构建并推送 Docker 镜像

```bash
cd Hackson/G-RapidAgent

# 方式 A：使用 Cloud Build（推荐，无需本地 Docker）
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/g-rapid-agent/app:latest

# 方式 B：本地构建后推送
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/g-rapid-agent/app:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/g-rapid-agent/app:latest
```

## 步骤 4：设置 Secret Manager（安全存储 API Keys）

```bash
# 创建 secrets
echo -n "your-exa-api-key" | gcloud secrets create exa-api-key --data-file=-
echo -n "your-es-cloud-id" | gcloud secrets create es-cloud-id --data-file=-
echo -n "your-es-api-key" | gcloud secrets create es-api-key --data-file=-

# 给 Cloud Run 服务账号授权读取
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding exa-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding es-cloud-id \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding es-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 步骤 5：部署到 Cloud Run

```bash
gcloud run deploy g-rapid-agent \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/g-rapid-agent/app:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=300 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_REGION=us-central1" \
  --set-secrets="EXA_API_KEY=exa-api-key:latest,ES_CLOUD_ID=es-cloud-id:latest,ES_API_KEY=es-api-key:latest"
```

## 步骤 6：验证部署

```bash
# 获取服务 URL
SERVICE_URL=$(gcloud run services describe g-rapid-agent --region=us-central1 --format='value(status.url)')
echo "App deployed at: $SERVICE_URL"

# 测试 Plan API
curl -X POST "$SERVICE_URL/api/plan" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "Gemini 2.5 在医疗诊断中的多模态应用趋势"}'
```

## 步骤 7：设置自定义域名（可选）

```bash
# 映射域名
gcloud run domain-mappings create \
  --service=g-rapid-agent \
  --domain=your-domain.com \
  --region=us-central1
```

## 快速更新部署

后续代码更新后，重复步骤 3 和 5 即可：

```bash
# 一键更新
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/g-rapid-agent/app:latest && \
gcloud run deploy g-rapid-agent \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/g-rapid-agent/app:latest \
  --region=us-central1
```

## Vertex AI 权限

Cloud Run 默认使用 Compute Engine 默认服务账号。确保它有 Vertex AI User 角色：

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

## 费用估算（Hackathon 期间）

| 资源 | 预估费用 |
|------|----------|
| Cloud Run (min=1, 1Gi) | ~$2-5/天 |
| Vertex AI (Gemini calls) | ~$1-3/天（取决于调用量） |
| Exa.ai | Free tier: 1000 searches/month |
| Elasticsearch Serverless | 按用量计费 |
| **合计** | **< $10/天** |

## 常见问题

**Q: 部署后报 503？**
A: 等待 1-2 分钟让 min-instance 预热。检查 `gcloud run services logs read g-rapid-agent`

**Q: Gemini 调用报权限错误？**
A: 确认服务账号有 `roles/aiplatform.user` 角色（步骤 7）

**Q: 流式响应中断？**
A: 检查 `--timeout=300` 设置，确保 Cloud Run 不会提前断连
