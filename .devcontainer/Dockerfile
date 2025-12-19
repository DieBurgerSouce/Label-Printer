# Development Container Dockerfile - Screenshot_Algo
FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    gnupg \
    lsb-release \
    ca-certificates \
    build-essential \
    python3 \
    python3-pip \
    postgresql-client \
    redis-tools \
    jq \
    vim \
    nano \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright dependencies
RUN npx playwright install-deps

# Install global npm packages
RUN npm install -g \
    typescript \
    ts-node \
    nodemon \
    prisma \
    eslint \
    prettier \
    @playwright/test \
    jest

# Install detect-secrets for security scanning
RUN pip3 install detect-secrets --break-system-packages

# Create non-root user
RUN useradd -m -s /bin/bash developer \
    && mkdir -p /workspace \
    && chown -R developer:developer /workspace

# Set working directory
WORKDIR /workspace

# Switch to non-root user
USER developer

# Set environment variables
ENV NODE_ENV=development
ENV PATH="/home/developer/.local/bin:$PATH"

# Default command
CMD ["sleep", "infinity"]
