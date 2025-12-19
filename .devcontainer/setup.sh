#!/bin/bash
# Development Container Setup Script - Screenshot_Algo

set -e

echo "🚀 Setting up development environment..."

# Install dependencies
echo "📦 Installing npm dependencies..."
npm ci || npm install

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium firefox

# Generate Prisma client (if prisma directory exists)
if [ -d "prisma" ]; then
    echo "🔧 Generating Prisma client..."
    npx prisma generate

    echo "🗄️ Running database migrations..."
    npx prisma migrate dev --name init || true
fi

# Setup git hooks
if [ -f "package.json" ] && grep -q "husky" package.json; then
    echo "🪝 Setting up Git hooks..."
    npx husky install || true
fi

# Create local environment file if not exists
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
fi

# Verify setup
echo ""
echo "✅ Development environment ready!"
echo ""
echo "📋 Available commands:"
echo "   npm run dev          - Start development servers"
echo "   npm run test         - Run tests"
echo "   npm run lint         - Run linting"
echo "   npm run build        - Build for production"
echo ""
echo "🔗 Services:"
echo "   Frontend:   http://localhost:3000"
echo "   Backend:    http://localhost:4000"
echo "   PostgreSQL: localhost:5432"
echo "   Redis:      localhost:6379"
echo ""
