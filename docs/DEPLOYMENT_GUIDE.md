# 🚀 MindScroll Production Deployment Guide

**Complete deployment guide for MindScroll - AI-powered spaced repetition learning platform**

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Service Configuration](#service-configuration) 
- [Local Testing & Verification](#local-testing--verification)
- [Docker Setup](#docker-setup)
- [AWS EC2 Deployment](#aws-ec2-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

---

## 🔧 Prerequisites

### Required Accounts & Services
- [x] **AWS Account** (EC2 for backend hosting)
- [x] **Supabase Account** (PostgreSQL database)
- [x] **Cloudflare Account** (R2 file storage)
- [x] **GitHub Account** (code repository)
- [x] **OpenAI Account** (AI processing)
- [x] **Anthropic Account** (AI processing)

### Local Development Requirements
```bash
# Required software
node --version    # v20.x.x
npm --version     # 10.x.x
docker --version  # 24.x.x
redis-server --version # 7.x.x
git --version     # 2.x.x
```

---

## 🏗️ Service Configuration

### 1. Supabase Setup
```bash
# 1. Create project at https://supabase.com
# 2. Database Settings → Connection String:
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"

# 3. Settings → API → Copy keys:
SUPABASE_URL="https://PROJECT.supabase.co"
SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."
```

### 2. Cloudflare R2 Setup
```bash
# 1. R2 → Create bucket: "mindscroll-uploads"
# 2. R2 → Manage R2 API tokens → Create token
# 3. Permissions: Admin Read & Write
# 4. Copy S3-compatible credentials:
CLOUDFLARE_R2_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY_ID="20_character_key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="40_character_secret"
CLOUDFLARE_R2_BUCKET_NAME="mindscroll-uploads"
```

### 3. AI Services Setup
```bash
# OpenAI: https://platform.openai.com/api-keys
OPENAI_API_KEY="sk-proj-..."

# Anthropic: https://console.anthropic.com/settings/keys  
ANTHROPIC_API_KEY="sk-ant-api03-..."

# Google (optional): https://makersuite.google.com/app/apikey
GOOGLE_AI_API_KEY="AIza..."
```

### 4. Production Environment File
**Location:** `/backend/.env.production`
```bash
# Database
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
SUPABASE_URL="https://PROJECT.supabase.co"
SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."

# Redis (Local on EC2)
REDIS_URL="redis://localhost:6379"

# AI Services
OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-api03-..."
GOOGLE_AI_API_KEY="AIza..."

# File Storage
STORAGE_TYPE="cloudflare"
CLOUDFLARE_R2_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY_ID="20_char_key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="40_char_secret"
CLOUDFLARE_R2_BUCKET_NAME="mindscroll-uploads"

# Server
PORT=3001
NODE_ENV=production
CORS_ORIGIN="https://mindscroll.vercel.app,https://your-domain.com"

# Security
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

---

## ✅ Local Testing & Verification

### 1. Test All Services
```bash
cd backend

# Install dependencies
npm install

# Test production services
node scripts/test-services.js
# ✅ Should show all services passing

# Run full-stack integration test
node scripts/test-full-stack.js
# ✅ Should show: "All integration tests passed! Ready for production!"
```

### 2. Database Migration
```bash
# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations to Supabase
npx prisma migrate deploy

# Verify tables created in Supabase dashboard
```

### 3. Manual Verification
```bash
# Start backend locally with production config
NODE_ENV=production npm start

# Test endpoints:
curl http://localhost:3001/health
curl http://localhost:3001/api

# Check logs for:
# ✅ "MindScroll API server running on port 3001"
# ✅ "Content processing worker started"
# ✅ No database/Redis connection errors
```

---

## 🐳 Docker Setup

### Docker Architecture
```
┌─────────────────────────────────────────┐
│              Docker Stack               │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Backend │  │ Worker  │  │  Redis  │ │
│  │  :3001  │  │ Process │  │  :6379  │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                    │                    │
│  ┌─────────────────▼─────────────────┐  │
│  │           Nginx Proxy            │  │
│  │              :80/:443            │  │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
            │                  │
    ┌───────▼────────┐  ┌─────▼─────┐
    │   Supabase     │  │Cloudflare │
    │ (PostgreSQL)   │  │    R2     │
    └────────────────┘  └───────────┘
```

### File Structure
```
/Users/mohitdhawan/Microlearn/
├── Makefile                    # Easy commands
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production
└── backend/
    ├── Dockerfile              # Production build with test gate
    ├── Dockerfile.dev          # Development build
    ├── .dockerignore           # Build optimization
    ├── ecosystem.config.js     # PM2 configuration
    └── scripts/
        └── docker-health.js    # Health checks
```

### Development Commands
```bash
# Start development environment
make dev

# View logs
make logs

# Test locally
make test

# Health check
make health

# Stop everything
make down
```

### Production Build
```bash
# Build with mandatory test gate (tests must pass)
make build

# Start production stack
make prod

# Check production status
make prod-status

# View production logs
make prod-logs
```

---

## ☁️ AWS EC2 Deployment

### 1. EC2 Instance Setup

#### Launch Instance
- **AMI:** Ubuntu Server 22.04 LTS
- **Type:** t3.micro (free tier)  
- **Key Pair:** ED25519 type
- **Security Group:** 
  - SSH (22): My IP
  - HTTP (80): 0.0.0.0/0
  - HTTPS (443): 0.0.0.0/0
  - Custom (3001): 0.0.0.0/0

#### Connect & Install
```bash
# SSH into instance
ssh -i ~/.ssh/your-key.pem ubuntu@YOUR_EC2_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
newgrp docker

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install PM2 & Nginx
sudo npm install -g pm2
sudo apt install -y nginx
```

### 2. Deploy Application

#### Clone & Setup
```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/Microlearn.git
cd Microlearn

# Copy production environment
cp backend/.env.production.example backend/.env.production
nano backend/.env.production  # Edit with actual values

# Install dependencies
cd backend && npm install
```

#### Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

#### Docker Deployment
```bash
# Build production images
make build

# Start production stack
make prod

# Verify deployment
make health
curl http://localhost:3001/health
```

### 3. Nginx Configuration
```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/mindscroll

# Add configuration:
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/mindscroll /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Setup
**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Run Integration Tests
        run: |
          cd backend
          npm install
          node scripts/test-services.js
          
      - name: Deploy to EC2
        if: success()
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_KEY }}
          script: |
            cd Microlearn
            git pull origin main
            make build
            make prod-restart
```

### Required Secrets
- `EC2_HOST`: Your EC2 public IP
- `EC2_KEY`: Your private key content

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check DATABASE_URL format
grep DATABASE_URL backend/.env.production

# Test connection
cd backend && npx prisma db push

# Reset migrations if needed
rm -rf prisma/migrations
npx prisma migrate dev --name init
```

#### 2. Redis Connection Failed
```bash
# Check Redis status
redis-cli ping  # Should return PONG

# Restart Redis
sudo systemctl restart redis-server

# Check Redis URL
grep REDIS_URL backend/.env.production
```

#### 3. Docker Build Failed
```bash
# Check test output
make test

# Build with verbose logging
docker build --no-cache -t mindscroll-backend backend/

# Check container logs
docker logs mindscroll-backend
```

#### 4. File Upload Issues
```bash
# Test R2 credentials
cd backend && node scripts/test-services.js

# Check bucket permissions in Cloudflare dashboard
# Verify API token has read/write access
```

#### 5. High Memory Usage
```bash
# Check container resources
docker stats

# Restart PM2 processes
make prod-restart

# Check memory limits in docker-compose.prod.yml
```

### Debug Commands
```bash
# Container shell access
docker exec -it mindscroll-backend sh

# View all logs
make logs

# Health check
make health

# Process status
docker ps -a

# System resources
docker system df
```

---

## 🛠️ Maintenance

### Regular Tasks

#### Daily
```bash
# Check application health
make health

# Review logs
make logs --tail=100

# Check disk space
docker system df
```

#### Weekly  
```bash
# Update dependencies
cd backend && npm audit fix

# Clean up Docker resources
make clean

# Check security updates
sudo apt update && sudo apt list --upgradable
```

#### Monthly
```bash
# Backup database (export from Supabase)
# Review and rotate logs
# Update SSL certificates (auto with Let's Encrypt)
# Performance monitoring review
```

### Scaling

#### Horizontal Scaling
```bash
# Scale backend instances
docker-compose -f docker-compose.prod.yml scale api=3

# Load balancer setup (Nginx upstream)
# Database connection pooling review
```

#### Vertical Scaling
```bash
# Upgrade EC2 instance type
# Increase container memory limits
# Database performance optimization
```

---

## 📊 Monitoring & Metrics

### Health Endpoints
- `GET /health` - Application health
- `GET /api` - API information
- `GET /metrics` - Application metrics (if enabled)

### Log Locations
- Application: `docker logs mindscroll-backend`
- Nginx: `/var/log/nginx/access.log`
- System: `/var/log/syslog`

### Key Metrics to Monitor
- Response time < 200ms
- Memory usage < 80%
- CPU usage < 70%
- Disk usage < 80%
- Error rate < 1%

---

## 🔒 Security Checklist

- [x] Non-root Docker containers
- [x] Environment variables for secrets
- [x] HTTPS with SSL certificates  
- [x] Rate limiting enabled
- [x] CORS configured properly
- [x] Regular security updates
- [x] API key rotation schedule
- [x] Database access restrictions
- [x] File upload validation
- [x] Container security scanning

---

## 📞 Support & Contact

For deployment issues:
1. Check this guide first
2. Review application logs
3. Test each service individually  
4. Check GitHub Issues
5. Create detailed bug report

**Last Updated:** August 2025  
**Version:** v0.3 Production Ready