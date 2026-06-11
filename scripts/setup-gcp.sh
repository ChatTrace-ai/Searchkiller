#!/usr/bin/env bash
set -euo pipefail

# G-RapidAgent — GCP MVP 部署脚本
# 用法: bash scripts/setup-gcp.sh <PROJECT_ID>
#
# 前置条件:
#   1. gcloud CLI 已安装并认证 (gcloud auth login)
#   2. Docker 已安装 (方式 B) 或使用 Cloud Build (方式 A)
#   3. 已准备好 EXA_API_KEY, ES_CLOUD_ID, ES_API_KEY

PROJECT_ID="${1:?Usage: bash scripts/setup-gcp.sh <PROJECT_ID>}"
REGION="us-central1"
SERVICE_NAME="g-rapid-agent"
REGISTRY="${REGION}-docker.pkg.dev"
REPO_NAME="g-rapid-agent"
IMAGE_NAME="app"
SA_NAME="g-rapid-agent-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== G-RapidAgent GCP Setup ==="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "SA:       $SA_EMAIL"
echo ""

# ─────────────────────────────────────────────────────
# Step 1: Enable required APIs
# ─────────────────────────────────────────────────────
echo "[1/7] Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID" --quiet

# ─────────────────────────────────────────────────────
# Step 2: Create dedicated service account
# ─────────────────────────────────────────────────────
echo "[2/7] Creating service account..."
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  echo "  Service account already exists, skipping."
else
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="G-RapidAgent Cloud Run SA" \
    --project="$PROJECT_ID"
fi

echo "  Granting IAM roles..."
for ROLE in roles/aiplatform.user roles/secretmanager.secretAccessor roles/logging.logWriter roles/monitoring.metricWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --condition=None \
    --quiet 2>/dev/null || true
done

# ─────────────────────────────────────────────────────
# Step 3: Create Artifact Registry repository
# ─────────────────────────────────────────────────────
echo "[3/7] Creating Artifact Registry repository..."
if gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo "  Repository already exists, skipping."
else
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="G-RapidAgent container images" \
    --project="$PROJECT_ID"
fi

# ─────────────────────────────────────────────────────
# Step 4: Create secrets (interactive — prompts for values)
# ─────────────────────────────────────────────────────
echo "[4/7] Setting up Secret Manager..."
create_secret() {
  local name="$1"
  local desc="$2"
  if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo "  Secret '$name' already exists, skipping."
  else
    echo "  Enter value for $name ($desc):"
    read -rs SECRET_VALUE
    echo -n "$SECRET_VALUE" | gcloud secrets create "$name" --data-file=- --project="$PROJECT_ID"
    echo "  Created secret: $name"
  fi
}

create_secret "exa-api-key" "Exa.ai API key"
create_secret "es-cloud-id" "Elasticsearch Cloud ID"
create_secret "es-api-key" "Elasticsearch API key"

# ─────────────────────────────────────────────────────
# Step 5: Build and push Docker image
# ─────────────────────────────────────────────────────
echo "[5/7] Building Docker image via Cloud Build..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

gcloud builds submit "$APP_DIR" \
  --tag "${REGISTRY}/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest" \
  --project="$PROJECT_ID" \
  --quiet

# ─────────────────────────────────────────────────────
# Step 6: Deploy to Cloud Run
# ─────────────────────────────────────────────────────
echo "[6/7] Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image="${REGISTRY}/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=300 \
  --service-account="$SA_EMAIL" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_REGION=${REGION}" \
  --set-secrets="EXA_API_KEY=exa-api-key:latest,ES_CLOUD_ID=es-cloud-id:latest,ES_API_KEY=es-api-key:latest" \
  --project="$PROJECT_ID" \
  --quiet

# ─────────────────────────────────────────────────────
# Step 7: Smoke test
# ─────────────────────────────────────────────────────
echo "[7/7] Running smoke test..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)')

echo "  Service URL: $SERVICE_URL"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL" --max-time 30)
if [ "$HTTP_CODE" = "200" ]; then
  echo "  Health check: PASSED (HTTP 200)"
else
  echo "  Health check: WARNING (HTTP $HTTP_CODE) — service may still be starting"
fi

PLAN_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/plan" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "AI Agent smoke test"}' \
  --max-time 60)

if echo "$PLAN_RESPONSE" | grep -q "subQueries"; then
  echo "  Plan API: PASSED"
else
  echo "  Plan API: WARNING — response: ${PLAN_RESPONSE:0:200}"
fi

echo ""
echo "=== Deployment Complete ==="
echo "URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "  1. Set up Budget Alerts: https://console.cloud.google.com/billing"
echo "  2. Monitor Vertex AI: https://console.cloud.google.com/vertex-ai/model-garden"
echo "  3. View logs: gcloud run services logs read $SERVICE_NAME --region=$REGION"
