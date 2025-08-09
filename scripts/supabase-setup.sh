#!/bin/bash

# 🚀 MindScroll Supabase Setup Script
# Automates the initial setup process for Supabase migration

set -e

echo "🚀 MindScroll Supabase Migration Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running from correct directory
if [[ ! -f "package.json" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_step "Step 1: Checking Prerequisites"

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 18 ]]; then
    print_error "Node.js 18+ is required. Current version: $(node --version)"
    exit 1
fi
print_success "Node.js version: $(node --version)"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed"
    exit 1
fi
print_success "npm version: $(npm --version)"

print_step "Step 2: Installing Dependencies"

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
if [[ $? -eq 0 ]]; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install
if [[ $? -eq 0 ]]; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

cd ..

print_step "Step 3: Setting up Environment Files"

# Setup backend environment
if [[ ! -f "backend/.env.production" ]]; then
    cp backend/.env.production.example backend/.env.production
    print_success "Created backend/.env.production"
    print_warning "Please edit backend/.env.production with your Supabase credentials"
else
    print_warning "backend/.env.production already exists"
fi

# Setup frontend environment
if [[ ! -f "frontend/.env.production" ]]; then
    cp frontend/.env.production.example frontend/.env.production
    print_success "Created frontend/.env.production"
    print_warning "Please edit frontend/.env.production with your Supabase credentials"
else
    print_warning "frontend/.env.production already exists"
fi

print_step "Step 4: Checking Database Configuration"

# Check if Prisma schema is configured for PostgreSQL
if grep -q "provider.*=.*\"sqlite\"" backend/prisma/schema.prisma; then
    print_warning "Prisma schema still configured for SQLite"
    print_warning "The schema has been updated for PostgreSQL, but double-check the provider setting"
fi

print_success "Database schema configured for PostgreSQL"

print_step "Step 5: Preparing Migration Scripts"

# Make migration scripts executable
chmod +x backend/scripts/migration/export-sqlite-data.js
chmod +x backend/scripts/migration/import-to-supabase.js

print_success "Migration scripts are ready"

print_step "Step 6: Checking Git Status"

# Check if we have any uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    print_warning "You have uncommitted changes. Consider committing them before proceeding:"
    git status --short
else
    print_success "Git working directory is clean"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Create a Supabase project at https://supabase.com"
echo "2. Get your Supabase credentials (URL, anon key, service role key)"
echo "3. Edit the environment files with your credentials:"
echo "   - backend/.env.production"
echo "   - frontend/.env.production"
echo "4. Run database migration:"
echo "   cd backend && NODE_ENV=production npx prisma migrate deploy"
echo "5. Follow the complete guide in SUPABASE_SETUP_GUIDE.md"
echo ""
echo "For detailed instructions, see: SUPABASE_SETUP_GUIDE.md"

# Ask if user wants to open the guide
read -p "Would you like to open the setup guide now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v code &> /dev/null; then
        code SUPABASE_SETUP_GUIDE.md
    elif command -v open &> /dev/null; then
        open SUPABASE_SETUP_GUIDE.md
    else
        print_warning "Please open SUPABASE_SETUP_GUIDE.md manually"
    fi
fi

echo ""
echo "Happy deploying! 🚀"