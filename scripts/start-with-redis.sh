#!/bin/bash
# Start Redis for Nova26 parallel task execution

set -e

echo "=== Nova26 Redis Setup ==="
echo ""

# Check if Redis is already running
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is already running"
    exit 0
fi

echo "⚠️  Redis is not running"
echo ""
echo "To start Redis, you have options:"
echo ""
echo "Option 1: Docker (recommended)"
echo "  docker run -d --name nova26-redis -p 6379:6379 redis:alpine"
echo ""
echo "Option 2: Homebrew (macOS)"
echo "  brew install redis"
echo "  brew services start redis"
echo ""
echo "Option 3: Direct installation"
echo "  Download from: https://redis.io/download"
echo ""

# Offer to start with Docker
read -p "Start Redis with Docker now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v docker &> /dev/null; then
        echo "Starting Redis with Docker..."
        docker run -d --name nova26-redis -p 6379:6379 redis:alpine
        echo ""
        sleep 2
        
        if redis-cli ping > /dev/null 2>&1; then
            echo "✅ Redis started successfully!"
            echo "Redis is now running on redis://localhost:6379"
        else
            echo "❌ Failed to start Redis"
            exit 1
        fi
    else
        echo "❌ Docker is not installed"
        exit 1
    fi
fi
