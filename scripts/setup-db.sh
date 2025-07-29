#!/bin/bash

# Database Setup Script for MindScroll
# This script helps set up the database for local development

set -e

echo "🗄️ Setting up MindScroll database..."

# Function to check if PostgreSQL is installed
check_postgresql() {
    if command -v psql &> /dev/null; then
        echo "✅ PostgreSQL found"
        return 0
    else
        echo "❌ PostgreSQL not found"
        return 1
    fi
}

# Function to check if PostgreSQL is running
check_postgresql_running() {
    if pg_isready -q; then
        echo "✅ PostgreSQL is running"
        return 0
    else
        echo "❌ PostgreSQL is not running"
        return 1
    fi
}

# Function to setup PostgreSQL database
setup_postgresql() {
    echo "📊 Setting up PostgreSQL database..."
    
    # Check if database and user already exist
    if psql postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='mindscroll_user'" | grep -q 1; then
        echo "✅ User 'mindscroll_user' already exists"
    else
        echo "👤 Creating user 'mindscroll_user'..."
        psql postgres -c "CREATE USER mindscroll_user WITH PASSWORD 'mindscroll_pass';"
    fi
    
    if psql postgres -lqt | cut -d \| -f 1 | grep -qw mindscroll_db; then
        echo "✅ Database 'mindscroll_db' already exists"
    else
        echo "🗃️ Creating database 'mindscroll_db'..."
        psql postgres -c "CREATE DATABASE mindscroll_db OWNER mindscroll_user;"
        psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE mindscroll_db TO mindscroll_user;"
    fi
}

# Function to setup SQLite (alternative)
setup_sqlite() {
    echo "📊 Setting up SQLite database..."
    echo "DATABASE_URL=\"file:./dev.db\"" > backend/.env.local
    echo "✅ SQLite configuration added to .env.local"
}

# Main setup logic
main() {
    echo "Choose your database setup:"
    echo "1) PostgreSQL (recommended)"
    echo "2) SQLite (easier setup)"
    echo "3) I'll set up my own cloud database"
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            if check_postgresql; then
                if check_postgresql_running; then
                    setup_postgresql
                else
                    echo "🔧 Starting PostgreSQL..."
                    if command -v brew &> /dev/null; then
                        brew services start postgresql
                        sleep 2
                        if check_postgresql_running; then
                            setup_postgresql
                        else
                            echo "❌ Failed to start PostgreSQL. Please start it manually."
                            exit 1
                        fi
                    else
                        echo "❌ Please start PostgreSQL manually and run this script again."
                        exit 1
                    fi
                fi
            else
                echo "📥 PostgreSQL not found. Installing..."
                if command -v brew &> /dev/null; then
                    brew install postgresql
                    brew services start postgresql
                    sleep 3
                    setup_postgresql
                else
                    echo "❌ Please install PostgreSQL manually:"
                    echo "   - Visit: https://postgresapp.com/"
                    echo "   - Or use: brew install postgresql"
                    exit 1
                fi
            fi
            
            # Set DATABASE_URL in .env
            echo "🔧 Configuring database connection..."
            if [ ! -f backend/.env ]; then
                cp backend/.env.example backend/.env
            fi
            
            # Update DATABASE_URL in .env file
            if grep -q "DATABASE_URL=" backend/.env; then
                sed -i '' 's|DATABASE_URL=.*|DATABASE_URL="postgresql://mindscroll_user:mindscroll_pass@localhost:5432/mindscroll_db"|' backend/.env
            else
                echo 'DATABASE_URL="postgresql://mindscroll_user:mindscroll_pass@localhost:5432/mindscroll_db"' >> backend/.env
            fi
            ;;
            
        2)
            echo "🔧 Setting up SQLite..."
            if [ ! -f backend/.env ]; then
                cp backend/.env.example backend/.env
            fi
            
            # Update DATABASE_URL for SQLite
            if grep -q "DATABASE_URL=" backend/.env; then
                sed -i '' 's|DATABASE_URL=.*|DATABASE_URL="file:./dev.db"|' backend/.env
            else
                echo 'DATABASE_URL="file:./dev.db"' >> backend/.env
            fi
            
            # Update Prisma schema for SQLite
            sed -i '' 's/provider = "postgresql"/provider = "sqlite"/' backend/prisma/schema.prisma
            echo "✅ Updated Prisma schema for SQLite"
            ;;
            
        3)
            echo "🌐 Cloud database setup..."
            echo "Please update your backend/.env file with your cloud database URL"
            echo "Popular options:"
            echo "  - Neon: https://neon.tech"
            echo "  - Supabase: https://supabase.com"
            echo "  - Railway: https://railway.app"
            echo ""
            echo "Copy your connection string to DATABASE_URL in backend/.env"
            ;;
            
        *)
            echo "❌ Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    # Initialize Prisma
    echo "🔧 Initializing Prisma..."
    cd backend
    
    # Generate Prisma client
    npm run db:generate
    
    # Run migrations
    echo "🔄 Running database migrations..."
    npm run migrate
    
    cd ..
    
    echo ""
    echo "🎉 Database setup completed!"
    echo ""
    echo "Next steps:"
    echo "1. Add your API keys to backend/.env:"
    echo "   - OPENAI_API_KEY"
    echo "   - ANTHROPIC_API_KEY"
    echo "2. Run: npm run dev"
    echo ""
    echo "Database connection: $(grep DATABASE_URL backend/.env)"
}

# Run main function
main "$@"