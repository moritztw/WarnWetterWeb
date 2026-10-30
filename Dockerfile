# =============================================================================
# Stage 1: Frontend-Build & Bereinigung der Dev-Abhängigkeiten
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

COPY index.html tsconfig.json vite.config.ts server.ts ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

# =============================================================================
# Stage 2: Schlankes, gehärtetes Laufzeit-Image (Non-Root)
# =============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-warnings"
ENV TZ=Europe/Berlin

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/server.ts ./server.ts
COPY --from=builder --chown=node:node /app/src/shared ./src/shared

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

CMD ["node", "server.ts"]
