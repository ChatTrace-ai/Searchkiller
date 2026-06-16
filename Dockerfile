# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN mkdir -p public

# Bake public env vars into the client bundle at build time.
# These are safe to hard-code: they configure frontend behaviour, not secrets.
ENV NEXT_PUBLIC_PREDICTION_STREAM_MODE=real
ENV NEXT_PUBLIC_APP_URL=https://g-rapid-agent-445462299562.us-central1.run.app

RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
