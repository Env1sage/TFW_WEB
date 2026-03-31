# ── Stage 1: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production=false

# Copy source
COPY . .

# Build client (Vite → dist/client) and server (tsc → dist/server)
RUN npm run build:client && npm run build:server

# ── Stage 2: Production ──
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Install only production deps
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy uploads directory structure (will be mounted as volume)
RUN mkdir -p uploads

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    chown -R appuser:nodejs /app
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server/index.js"]
