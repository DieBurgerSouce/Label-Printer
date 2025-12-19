# ==================================
# Screenshot Algo Backend Dockerfile
# Optimized multi-stage build
# ==================================

# Build arguments for versioning
ARG NODE_VERSION=20
ARG BUILD_DATE
ARG VERSION=1.0.0
ARG VCS_REF

# ==================================
# Stage 1: Dependencies
# ==================================
FROM node:${NODE_VERSION}-bookworm-slim AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci && npm cache clean --force

# ==================================
# Stage 2: Builder
# ==================================
FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy Prisma schema first (for generation)
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript
RUN npm run build

# ==================================
# Stage 3: Production Dependencies
# ==================================
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# ==================================
# Stage 4: Production Runtime
# ==================================
FROM node:${NODE_VERSION}-bookworm-slim AS production

# Labels for container management
LABEL org.opencontainers.image.title="Screenshot Algo Backend" \
      org.opencontainers.image.description="Enterprise-grade Label Generation System API" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="Screenshot Algo" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/screenshot-algo/backend"

WORKDIR /app

# Install tini for proper init process and runtime dependencies
# Tesseract OCR, Puppeteer/Chrome dependencies, curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    tesseract-ocr \
    tesseract-ocr-deu \
    tesseract-ocr-eng \
    curl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy Prisma schema and generated client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma/

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy package.json for version info
COPY package.json ./

# Create non-root user for security (UID/GID 1000 for Kubernetes compatibility)
RUN groupadd --gid 1000 nodejs && \
    useradd --uid 1000 --gid nodejs --shell /bin/bash --create-home nodejs

# Create data directories
RUN mkdir -p /app/data/screenshots /app/data/uploads /app/data/labels \
             /app/data/cache /app/data/exports /app/data/templates && \
    chown -R nodejs:nodejs /app

# Environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    # Disable Puppeteer sandbox in Docker (runs as non-root)
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check (using Kubernetes-compatible endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health/ready || exit 1

# Use tini as init process for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the application with migration
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
