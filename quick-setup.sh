#!/bin/bash

# Quick Setup for MindScroll
# This addresses the package issues and gets you started quickly

set -e

echo "🚀 Quick setup for MindScroll..."

# Install root dependencies (minimal)
echo "📦 Installing root dependencies..."
npm install concurrently --save-dev

# Backend setup
echo "🔧 Setting up backend..."
cd backend
npm install
cd ..

# Frontend setup  
echo "🎨 Setting up frontend..."
cd frontend
npm install
cd ..

# Create environment file
echo "📝 Setting up environment..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env file"
fi

echo ""
echo "🎉 Basic setup complete!"
echo ""
echo "Next steps:"
echo "1. Set up your database:"
echo "   ./scripts/setup-db.sh"
echo ""
echo "2. Add your API keys to backend/.env:"
echo "   - OPENAI_API_KEY=sk-your-key-here"
echo "   - ANTHROPIC_API_KEY=sk-ant-your-key-here"
echo ""
echo "3. Start the application:"
echo "   npm run dev"
echo ""
echo "For detailed setup instructions, see docs/DATABASE_SETUP.md"