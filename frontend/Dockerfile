# ==================================
# Screenshot Algo Frontend Dockerfile
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
FROM node:${NODE_VERSION}-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# ==================================
# Stage 2: Builder
# ==================================
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ==================================
# Stage 3: Production with Nginx
# ==================================
FROM nginx:1.25-alpine AS production

# Labels for container management
LABEL org.opencontainers.image.title="Screenshot Algo Frontend" \
      org.opencontainers.image.description="Enterprise-grade Label Generation System UI" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="Screenshot Algo" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/screenshot-algo/frontend"

# Install tini for proper init process
RUN apk add --no-cache tini

# Create cache and log directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Copy built files to nginx
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# Add security headers configuration
RUN echo 'server_tokens off;' > /etc/nginx/conf.d/security.conf

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["nginx", "-g", "daemon off;"]

# ==================================
# Stage 4: Development
# ==================================
FROM node:${NODE_VERSION}-alpine AS development

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
