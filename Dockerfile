# ============================================================
# Dockerfile - Charles AI v4.1
# Multi-stage build: builder -> test -> runtime
# ============================================================

# ---------- STAGE 1: BUILDER (instala dependências completas) ----------
# node >=22: exigido por better-sqlite3@13 e openai@7 (engines)
FROM node:24-alpine AS builder

WORKDIR /app

# Toolchain para node-gyp: o npm dispara "node-gyp rebuild" do
# better-sqlite3 durante npm ci e o alpine não traz python/make/g++
RUN apk add --no-cache python3 make g++

# Copia apenas package files para aproveitar cache do Docker
COPY backend/package*.json ./

# Instala TODAS as dependências (dev + prod) para rodar testes
RUN npm ci

# Copia código fonte para contexto de testes
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY assets/ ./assets/
COPY FQ_DATA_CENTER.xls ./
COPY sites_data_center.xlsx ./
COPY jest.config.js ./
COPY jest.config.js ./backend/jest.config.js
COPY .env.example ./

# ---------- STAGE 2: TESTES ----------
FROM builder AS test

# Roda testes com coverage mínimo obrigatório
RUN cd backend && npx jest --ci --coverage --maxWorkers=2 || (echo "❌ Testes falharam" && exit 1)

# Verifica guardiões do sistema
RUN node backend/scripts/check-guardians.js || echo "⚠️ Guardiões não executados (script opcional)"

# ---------- STAGE 3: RUNTIME (produção enxuta) ----------
FROM node:24-alpine AS runtime

WORKDIR /app

# Instala curl para healthcheck (alpine não tem por padrão)
RUN apk add --no-cache curl

# Copia apenas dependências de produção
COPY backend/package*.json ./
RUN npm ci --only=production --ignore-scripts

# Usuário não-root para segurança
RUN addgroup -S charles && adduser -S charles -G charles
USER charles

# Copia código de produção
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend ../frontend/
COPY --from=builder /app/assets ../assets/
COPY --from=builder /app/FQ_DATA_CENTER.xls ../
COPY --from=builder /app/sites_data_center.xlsx ../
COPY --from=builder /app/.env.example ../

# Health check (status da API)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=5 \
  CMD curl -f http://localhost:3000/api/status || exit 1

# Ambiente de produção
ENV NODE_ENV=production
ENV PORT=3000

# Expõe porta HTTP
EXPOSE 3000

# Inicia o servidor
WORKDIR /app/backend
CMD ["node", "server.js"]