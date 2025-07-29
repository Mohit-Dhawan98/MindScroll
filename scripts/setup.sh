#!/bin/bash

# MindScroll Setup Script
# This script sets up the development environment for MindScroll

set -e  # Exit on any error

echo "🚀 Setting up MindScroll development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Create uploads directory
echo "📁 Creating upload directories..."
mkdir -p backend/uploads
mkdir -p backend/logs

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Setup backend
echo "🔧 Setting up backend..."
cd backend

# Install backend dependencies
npm install

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file. Please update with your API keys."
fi

# Generate Prisma client (if Prisma is set up)
echo "🗄️ Setting up database..."
npx prisma generate || echo "⚠️ Prisma generate failed - database setup may be incomplete"

cd ..

# Setup frontend
echo "🎨 Setting up frontend..."
cd frontend

# Install frontend dependencies
npm install

# Create Next.js config if it doesn't exist
if [ ! -f next.config.js ]; then
    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost', 'oaidalleapiprodscus.blob.core.windows.net'],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
}

module.exports = nextConfig
EOF
    echo "📝 Created Next.js configuration"
fi

# Create basic directory structure
mkdir -p src/{components,pages,styles,utils,types,hooks,stores}
mkdir -p public/{images,icons}

cd ..

# Setup mobile (if Flutter is available)
if command -v flutter &> /dev/null; then
    echo "📱 Setting up Flutter mobile app..."
    cd mobile
    flutter pub get || echo "⚠️ Flutter dependencies failed to install"
    cd ..
else
    echo "⚠️ Flutter not found. Skipping mobile setup."
    echo "To set up mobile later, install Flutter and run: cd mobile && flutter pub get"
fi

# Create basic development scripts
echo "📜 Creating development scripts..."

# Create start script
cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting MindScroll development environment..."

# Start backend and frontend concurrently
npm run dev
EOF

chmod +x start-dev.sh

# Create database setup script
cat > scripts/init-db.sh << 'EOF'
#!/bin/bash
echo "🗄️ Initializing database..."

cd backend

# Run Prisma migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed database (if seed script exists)
if [ -f prisma/seed.js ]; then
    node prisma/seed.js
fi

echo "✅ Database initialized successfully"
EOF

chmod +x scripts/init-db.sh

# Create deployment script
cat > scripts/deploy.sh << 'EOF'
#!/bin/bash
echo "🚀 Deploying MindScroll..."

# Build frontend
cd frontend
npm run build

# Build backend (if needed)
cd ../backend
npm run build

echo "✅ Build completed"
EOF

chmod +x scripts/deploy.sh

# Success message
echo ""
echo "🎉 MindScroll setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update backend/.env with your API keys:"
echo "   - OPENAI_API_KEY"
echo "   - ANTHROPIC_API_KEY"
echo "   - DATABASE_URL"
echo "   - JWT_SECRET"
echo ""
echo "2. Set up your database:"
echo "   ./scripts/init-db.sh"
echo ""
echo "3. Start the development environment:"
echo "   ./start-dev.sh"
echo ""
echo "4. Open your browser to:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:3001"
echo ""
echo "📚 For more information, see README.md"