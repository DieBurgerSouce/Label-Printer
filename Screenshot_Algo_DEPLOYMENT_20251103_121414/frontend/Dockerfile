# ==================================
# Stage 1: Build Stage
# ==================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (explicit to ensure package-lock.json is included)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
# Note: Environment variables for API_URL will be handled by the backend
RUN npm run build

# ==================================
# Stage 2: Production with Nginx (optional - for standalone deployment)
# ==================================
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Create nginx configuration for SPA
RUN echo 'server { \n\
    listen 80; \n\
    server_name localhost; \n\
    root /usr/share/nginx/html; \n\
    index index.html; \n\
    \n\
    # SPA fallback \n\
    location / { \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
    \n\
    # Health check \n\
    location /health { \n\
        access_log off; \n\
        return 200 "healthy\\n"; \n\
        add_header Content-Type text/plain; \n\
    } \n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

# ==================================
# Stage 3: Development Stage
# ==================================
FROM node:20-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
