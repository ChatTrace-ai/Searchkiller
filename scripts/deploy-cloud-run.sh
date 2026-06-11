#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  Laplace's Demon — Cloud Run One-Click Deploy Script
#  Usage: bash scripts/deploy-cloud-run.sh
# ============================================================

# ---- Configuration ----
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-project-9e90fc5d-28d6-4d46-b0e}"
REGION="${GOOGLE_CLOUD_REGION:-us-central1}"
SERVICE="searchkiller"
REPO="searchkiller"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/app:latest"

# Secrets from .env (read if available)
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  echo "📄 Reading secrets from .env"
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

EXA_KEY="${EXA_API_KEY:-}"
ES_CID="${ES_CLOUD_ID:-}"
ES_KEY="${ES_API_KEY:-}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Laplace's Demon — Cloud Run Deployment             ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Project:  $PROJECT_ID"
echo "║  Region:   $REGION"
echo "║  Service:  $SERVICE"
echo "║  Image:    $IMAGE"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ---- Step 0: Auth check ----
echo "🔐 Step 0: Checking gcloud authentication..."
ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)
if [ -z "$ACCOUNT" ]; then
  echo "  ⚠️  No active account. Running gcloud auth login..."
  gcloud auth login
  ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)')
fi
echo "  ✅ Authenticated as: $ACCOUNT"

gcloud config set project "$PROJECT_ID"
echo "  ✅ Project set to: $PROJECT_ID"

# ---- Step 1: Enable APIs ----
echo ""
echo "🔧 Step 1: Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  --quiet
echo "  ✅ APIs enabled"

# ---- Step 2: Create Artifact Registry repo ----
echo ""
echo "📦 Step 2: Creating Artifact Registry repository..."
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Searchkiller Docker images" \
  2>/dev/null || echo "  ℹ️  Repository already exists"
echo "  ✅ Repository ready"

# ---- Step 3: Build and push image ----
echo ""
echo "🏗️  Step 3: Building Docker image with Cloud Build..."
echo "  This may take 5-10 minutes..."
gcloud builds submit --tag "$IMAGE" .
echo "  ✅ Image built and pushed"

# ---- Step 4: Create Secrets ----
echo ""
echo "🔑 Step 4: Setting up Secret Manager..."

create_or_update_secret() {
  local name=$1
  local value=$2
  if [ -z "$value" ]; then
    echo "  ⚠️  $name: no value provided, skipping"
    return
  fi
  if gcloud secrets describe "$name" --quiet 2>/dev/null; then
    echo "  ℹ️  Updating $name..."
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --quiet
  else
    echo "  📝 Creating $name..."
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --quiet
  fi
}

create_or_update_secret "exa-api-key" "$EXA_KEY"
create_or_update_secret "es-cloud-id" "$ES_CID"
create_or_update_secret "es-api-key" "$ES_KEY"
echo "  ✅ Secrets configured"

# ---- Step 5: Grant IAM permissions ----
echo ""
echo "🔒 Step 5: Granting IAM permissions..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUN_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$RUN_SA" \
  --role roles/aiplatform.user \
  --quiet >/dev/null 2>&1
echo "  ✅ Vertex AI access granted"

for s in exa-api-key es-cloud-id es-api-key; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member "serviceAccount:$RUN_SA" \
    --role roles/secretmanager.secretAccessor \
    --quiet >/dev/null 2>&1 || true
done
echo "  ✅ Secret access granted"

# ---- Step 6: Deploy to Cloud Run ----
echo ""
echo "🚀 Step 6: Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --port 8080 \
  --memory 1Gi \
  --cpu 2 \
  --timeout 300 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_REGION=$REGION,GOOGLE_VERTEX_PROJECT=$PROJECT_ID,GOOGLE_VERTEX_LOCATION=$REGION,NEXT_PUBLIC_PREDICTION_STREAM_MODE=real,AUTO_REFRESH_FEATURED=true" \
  --set-secrets "EXA_API_KEY=exa-api-key:latest,ES_CLOUD_ID=es-cloud-id:latest,ES_API_KEY=es-api-key:latest"
echo "  ✅ Deployed!"

# ---- Step 7: Get URL and verify ----
echo ""
echo "🌐 Step 7: Verifying deployment..."
URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  🎉 DEPLOYMENT SUCCESSFUL!                          ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Service URL: $URL"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✅ Health check: HTTP $HTTP_CODE — Service is healthy!"
else
  echo "  ⚠️  Health check: HTTP $HTTP_CODE — Service may still be starting up"
  echo "  Try again in 30 seconds: curl -s $URL"
fi

echo ""
echo "📋 Hackathon Submission Info:"
echo "  - Hosted URL: $URL"
echo "  - Code Repo:  https://github.com/ChatTrace-ai/Searchkiller"
echo ""
echo "🔍 Quick API test:"
echo "  curl -s '$URL/api/predictions/popular?limit=2' | python3 -m json.tool"
echo ""
