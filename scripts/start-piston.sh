#!/bin/bash
# Start Piston code execution service for Nova26
# Piston provides sandboxed code execution for TypeScript/JavaScript validation

set -e

echo "=== Nova26 Piston Setup ==="
echo ""

# Check if Piston is already running
if curl -s http://localhost:2000/api/v2/runtimes > /dev/null 2>&1; then
    echo "✅ Piston is already running on http://localhost:2000"
    echo ""
    echo "Available runtimes:"
    curl -s http://localhost:2000/api/v2/runtimes | jq -r '.[].language' 2>/dev/null || curl -s http://localhost:2000/api/v2/runtimes
    exit 0
fi

echo "⚠️  Piston is not running"
echo ""
echo "To start Piston, you have two options:"
echo ""
echo "Option 1: Docker (recommended)"
echo "  docker run -d --name nova26-piston -p 2000:2000 ghcr.io/engineer-man/piston"
echo ""
echo "Option 2: Direct binary"
echo "  Download from: https://github.com/engineer-man/piston"
echo ""
echo "After starting Piston, install TypeScript runtime:"
echo "  curl -X POST http://localhost:2000/api/v2/packages \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"language\":\"typescript\",\"version\":\"5.0.3\"}'"
echo ""

# Offer to start with Docker
read -p "Start Piston with Docker now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v docker &> /dev/null; then
        echo "Starting Piston with Docker..."
        docker run -d --name nova26-piston -p 2000:2000 ghcr.io/engineer-man/piston
        echo ""
        echo "Waiting for Piston to start..."
        sleep 3
        
        if curl -s http://localhost:2000/api/v2/runtimes > /dev/null 2>&1; then
            echo "✅ Piston started successfully!"
            echo ""
            echo "Installing TypeScript runtime..."
            curl -s -X POST http://localhost:2000/api/v2/packages \
                -H 'Content-Type: application/json' \
                -d '{"language":"typescript","version":"5.0.3"}' || true
            echo ""
            echo "✅ Setup complete!"
            echo "Piston is now running on http://localhost:2000"
        else
            echo "❌ Failed to start Piston"
            exit 1
        fi
    else
        echo "❌ Docker is not installed"
        exit 1
    fi
fi
