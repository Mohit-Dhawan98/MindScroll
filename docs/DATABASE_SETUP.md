# Database Setup Guide

## Option 1: Local PostgreSQL (Recommended for Development)

### Install PostgreSQL on macOS

```bash
# Using Homebrew (recommended)
brew install postgresql
brew services start postgresql

# Or using MacPorts
sudo port install postgresql14
sudo port load postgresql14

# Or download from https://postgresapp.com/
```

### Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# Create user and database
CREATE USER mindscroll_user WITH PASSWORD 'mindscroll_pass';
CREATE DATABASE mindscroll_db OWNER mindscroll_user;
GRANT ALL PRIVILEGES ON DATABASE mindscroll_db TO mindscroll_user;

# Exit PostgreSQL
\q
```

### Set Environment Variables

```bash
# Copy the example file
cp backend/.env.example backend/.env

# Edit the .env file with your settings
DATABASE_URL="postgresql://mindscroll_user:mindscroll_pass@localhost:5432/mindscroll_db"
```

## Option 2: SQLite (Easiest for Development)

If you want to avoid PostgreSQL setup, you can use SQLite:

### Update your .env file:
```bash
DATABASE_URL="file:./dev.db"
```

### Update prisma/schema.prisma:
Change the provider from `postgresql` to `sqlite`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

## Option 3: Cloud Database (Production Ready)

### Neon (Recommended Cloud Option)
1. Go to https://neon.tech
2. Sign up for free account
3. Create a new project
4. Copy the connection string to your .env file

### Supabase
1. Go to https://supabase.com
2. Sign up and create project
3. Go to Settings > Database
4. Copy connection string to .env

### Railway
1. Go to https://railway.app
2. Create new project
3. Add PostgreSQL service  
4. Copy connection string to .env

## Initialize Database

After setting up your database connection:

```bash
# Navigate to backend directory
cd backend

# Generate Prisma client
npm run db:generate

# Run migrations
npm run migrate

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

## Troubleshooting

### Common Issues

**Connection Error:**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL if not running
brew services start postgresql
```

**Permission Error:**
```bash
# Make sure user has correct permissions
psql postgres -c "ALTER USER mindscroll_user CREATEDB;"
```

**Port Already in Use:**
```bash
# Check what's using port 5432
lsof -i :5432

# Kill process if needed (be careful!)
kill -9 <PID>
```

### Database Management Commands

```bash
# Connect to your database
psql "postgresql://mindscroll_user:mindscroll_pass@localhost:5432/mindscroll_db"

# List all tables
\dt

# Describe a table
\d users

# Exit
\q
```

## Environment Variables Needed

Update your `backend/.env` file with these required variables:

```env
# Database
DATABASE_URL="postgresql://mindscroll_user:mindscroll_pass@localhost:5432/mindscroll_db"

# JWT Secret (change this!)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# OpenAI API Key
OPENAI_API_KEY="sk-your-openai-key-here"

# Anthropic Claude API Key  
ANTHROPIC_API_KEY="sk-ant-your-anthropic-key-here"

# Optional: Google Gemini
GOOGLE_AI_API_KEY="your-google-ai-key-here"
```

## Getting API Keys

### OpenAI
1. Go to https://platform.openai.com
2. Sign up / log in
3. Go to API Keys section
4. Create new secret key
5. Copy and paste into .env

### Anthropic Claude
1. Go to https://console.anthropic.com
2. Sign up / log in  
3. Go to API Keys
4. Create new key
5. Copy and paste into .env

### Google Gemini
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Create API key
4. Enable the Generative AI API
5. Copy and paste into .env

You're now ready to run the application!