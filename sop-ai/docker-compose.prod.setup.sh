#!/bin/bash
# Production setup script for SOP AI Chatbot
# Run this after deploying to set up the application

set -e

echo "🚀 Setting up SOP AI Chatbot for production..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env <<EOF
JWT_SECRET=$(openssl rand -base64 32)
CHROMA_URL=http://chromadb:8000
OLLAMA_URL=http://ollama:11434
NODE_ENV=production
EOF
    echo "✅ Created .env file with random JWT_SECRET"
else
    echo "✅ .env file already exists"
fi

# Build and start services
echo "🏗️  Building Docker images..."
docker-compose -f docker-compose.prod.yml build

echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Pull Ollama models
echo "📥 Pulling Ollama models (this may take several minutes)..."
docker exec sop-ai-ollama ollama pull qwen2.5:3b || echo "⚠️  Failed to pull qwen2.5:3b, you may need to retry"
docker exec sop-ai-ollama ollama pull nomic-embed-text || echo "⚠️  Failed to pull nomic-embed-text, you may need to retry"

# Seed database
echo "🌱 Seeding database..."
docker exec sop-ai-app npm run seed || echo "⚠️  Database may already be seeded"

# Index SOPs
echo "📚 Indexing SOP documents..."
docker exec sop-ai-app npm run index || echo "⚠️  Indexing failed, check logs"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Service status:"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "🔍 Check logs with: docker-compose -f docker-compose.prod.yml logs -f"
echo "🌐 Application should be available at http://localhost:3000"

