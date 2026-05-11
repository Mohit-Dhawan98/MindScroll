# 🚀 Epigram Production Deployment Guide

**Complete deployment guide for Epigram (formerly MindScroll) - AI-powered spaced repetition learning platform**

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Service Configuration](#service-configuration) 
- [Local Testing & Verification](#local-testing--verification)
- [Direct Node.js Deployment (Recommended)](#direct-nodejs-deployment-recommended)
- [Docker Setup (Alternative)](#docker-setup-alternative)
- [AWS EC2 Deployment](#aws-ec2-deployment)
- [Production Process Management](#production-process-management)
- [SSL & Domain Setup](#ssl--domain-setup)
- [Security & Privacy Features](#security--privacy-features)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

---

## 🔧 Prerequisites

### Required Accounts & Services
- [x] **AWS Account** (EC2 for backend hosting)
- [x] **Supabase Account** (PostgreSQL database with transaction pooler)
- [x] **Cloudflare Account** (R2 file storage)
- [x] **DuckDNS Account** (Free dynamic DNS)
- [x] **Vercel Account** (Frontend hosting)
- [x] **OpenAI Account** (AI processing)
- [x] **Anthropic Account** (AI processing)

### Local Development Requirements
```bash
# Required software
node --version    # v20.x.x (ES modules support)
npm --version     # 10.x.x
redis-server --version # 7.x.x
git --version     # 2.x.x
pm2 --version     # 5.x.x
```

---

## 🏗️ Service Configuration

### 1. Supabase Setup (Critical: Use Transaction Pooler)
```bash
# 1. Create project at https://supabase.com
# 2. Database Settings → Connection String:
# ⚠️ IMPORTANT: Use TRANSACTION POOLER (port 6543) not Session Pooler (port 5432)
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true"

# 3. Settings → API → Copy keys:
SUPABASE_URL="https://PROJECT.supabase.co"
SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."
```

**Why Transaction Pooler?**
- Session pooler causes "prepared statement already exists" errors with Prisma
- Transaction pooler with `pgbouncer=true` flag disables prepared statements
- More reliable for production workloads

### 2. Cloudflare R2 Setup
```bash
# 1. R2 → Create bucket: "epigram-uploads"
# 2. R2 → Manage R2 API tokens → Create token
# 3. Permissions: Admin Read & Write
# 4. Copy S3-compatible credentials:
CLOUDFLARE_R2_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY_ID="20_character_key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="40_character_secret"
CLOUDFLARE_R2_BUCKET_NAME="epigram-uploads"
```

### 3. AI Services Setup
```bash
# OpenAI: https://platform.openai.com/api-keys
OPENAI_API_KEY="sk-proj-..."

# Anthropic: https://console.anthropic.com/settings/keys  
ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### 4. Production Environment File
**Location:** `/backend/.env.production`
```bash
# Database (CRITICAL: Use transaction pooler)
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true"
WORKER_DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true"
SUPABASE_URL="https://PROJECT.supabase.co"
SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."

# Redis (Local on EC2)
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT=6379

# AI Services
OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-api03-..."

# File Storage
STORAGE_TYPE="cloudflare"
CLOUDFLARE_R2_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY_ID="20_char_key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="40_char_secret"
CLOUDFLARE_R2_BUCKET_NAME="epigram-uploads"

# Server Configuration
PORT=3001
NODE_ENV=production
CORS_ORIGIN="https://epigram-lake.vercel.app,https://your-domain.com"

# File Upload Limits (50MB)
MAX_FILE_SIZE=52428800
MAX_REQUEST_SIZE=52428800
TRUST_PROXY=true

# Security
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

---

## ✅ Local Testing & Verification

### 1. Test Security Features Locally
```bash
cd backend

# Apply security migration (adds userId, approvedForGlobal columns)
node apply-security-migration.js

# Test with 2 different user accounts
# 1. Upload different books from each account
# 2. Verify mutual exclusion (users only see their own uploads)
# 3. Test admin approval workflow

# Test PDF fingerprinting (duplicate prevention)
# 1. Try uploading same PDF twice
# 2. Should get 409 error with duplicate message
```

### 2. Test Process Management
```bash
# Test PM2 ecosystem config
pm2 start ecosystem.config.cjs --env production
pm2 status
# Should show: mindscroll-api (2 instances), mindscroll-worker (1 instance)

# Test timestamp-based job IDs (prevents collisions)
curl http://localhost:3001/api/upload/content
# Upload should work without job ID conflicts
```

---

## 🚀 Direct Node.js Deployment (Recommended)

**Why Direct Deployment over Docker?**
- Simpler to debug and maintain
- Better performance for AI/ML workloads
- Easier file system access for processing
- More cost-effective resource usage

### 1. EC2 Instance Setup

#### Launch Instance
- **AMI:** Ubuntu Server 22.04 LTS
- **Type:** t3.small or larger (t3.micro may struggle with AI processing)
- **Key Pair:** ED25519 type  
- **Security Group:**
  - SSH (22): My IP
  - HTTP (80): 0.0.0.0/0
  - HTTPS (443): 0.0.0.0/0
  - Custom (3001): 0.0.0.0/0 (for backend API)

#### System Setup
```bash
# SSH into instance
ssh -i ~/.ssh/your-key.pem ubuntu@YOUR_EC2_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (ES modules support)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install PM2 & Nginx
sudo npm install -g pm2
sudo apt install -y nginx

# Verify installations
node --version    # Should be v20.x.x
redis-cli ping    # Should return PONG
pm2 --version     # Should be 5.x.x
```

### 2. Deploy Application

#### Clone & Setup
```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/Microlearn.git
cd MindScroll

# Copy production environment
cp backend/.env.production.example backend/.env.production
nano backend/.env.production  # Edit with actual values

# Install dependencies
cd backend && npm install
```

#### Database Setup
```bash
# Generate Prisma client for PostgreSQL
npx prisma generate

# Apply security migrations (adds user privacy features)
node apply-security-migration.js

# Verify in Supabase dashboard:
# - content table has userId and approvedForGlobal columns
# - content_uploads table has fingerprint column
```

---

## 🔄 Production Process Management

### PM2 Configuration Issues & Solutions

#### Problem: ES Modules vs CommonJS
```bash
# ❌ This will fail with "require is not defined"
pm2 start ecosystem.config.js

# ✅ Use the CommonJS version
pm2 start ecosystem.config.cjs --env production
```

#### Problem: Docker Paths in Config
The ecosystem config is designed for Docker containers (`/app` paths) but we're running directly on EC2.

**Solution 1: Use the working .cjs config (Recommended)**
```bash
cd backend
pm2 start ecosystem.config.cjs --env production
```

**Solution 2: Manual PM2 Start (Simpler)**
```bash
cd backend
pm2 delete all

# Start API server (cluster mode for performance)
pm2 start src/index.js --name "mindscroll-api" --env production -i max

# Start worker (single instance to avoid job conflicts)  
pm2 start src/services/worker.js --name "mindscroll-worker" --env production -i 1

# Verify 3 processes total (2 API + 1 Worker)
pm2 status
```

#### Expected PM2 Output
```
┌────┬──────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name                 │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼──────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ mindscroll-api       │ default     │ 1.0.0   │ cluster │ 26929    │ 20s    │ 0    │ online    │ 0%       │ 160.2mb  │ ubuntu   │ disabled │
│ 2  │ mindscroll-api       │ default     │ 1.0.0   │ cluster │ 26959    │ 10s    │ 0    │ online    │ 0%       │ 178.4mb  │ ubuntu   │ disabled │
│ 1  │ mindscroll-worker    │ default     │ 1.0.0   │ fork    │ 26930    │ 20s    │ 0    │ online    │ 0%       │ 151.4mb  │ ubuntu   │ disabled │
└────┴──────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

#### Auto-start on Boot
```bash
# Save PM2 configuration
pm2 save

# Generate startup script
pm2 startup

# Run the command it outputs (usually starts with 'sudo env...')
```

#### Health Checks
```bash
# Test API locally
curl localhost:3001/api
curl localhost:3001/health

# Check logs
pm2 logs --lines 20

# Monitor processes
pm2 monit
```

---

## 🔐 SSL & Domain Setup

### 1. DuckDNS Configuration
```bash
# 1. Sign up at https://www.duckdns.org
# 2. Create domain: epigram.duckdns.org  
# 3. Point to your EC2 Elastic IP
# 4. Test DNS propagation
dig epigram.duckdns.org  # Should return your EC2 IP
```

### 2. Let's Encrypt SSL
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d epigram.duckdns.org

# Verify auto-renewal
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Nginx Configuration
```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/default
```

**Complete Nginx Configuration:**
```nginx
upstream backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name epigram.duckdns.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name epigram.duckdns.org;

    # SSL Configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/epigram.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/epigram.duckdns.org/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # File Upload Configuration (50MB limit)
    client_max_body_size 50M;
    client_body_timeout 300s;
    client_header_timeout 300s;

    # Proxy Configuration
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://backend/health;
        access_log off;
    }
}
```

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Test HTTPS
curl https://epigram.duckdns.org/api
```

---

## 🔐 Security & Privacy Features

### 1. User Content Privacy System

#### Database Schema Changes
```sql
-- Applied by apply-security-migration.js
ALTER TABLE "content" 
ADD COLUMN "userId" TEXT NULL,
ADD COLUMN "approvedForGlobal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "content_uploads"
ADD COLUMN "fingerprint" TEXT NULL;

-- Foreign key constraint
ALTER TABLE "content" 
ADD CONSTRAINT "Content_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "users"("id");

-- Index for fast lookups
CREATE INDEX "content_uploads_fingerprint_idx" ON "content_uploads" ("fingerprint");
```

#### Content Visibility Rules
1. **Global Library** (`/api/library/content`):
   - Shows curated content (non-USER_UPLOADED)
   - Shows USER_UPLOADED content only if `approvedForGlobal = true`
   - Users cannot see other users' private uploads

2. **My Uploads** (`/api/library/my-uploads`):
   - Shows only content where `userId = current_user_id`
   - Includes approval status badges (Private/Public)
   - Allows users to see their upload statistics

3. **Content Access Control**:
   - Individual content endpoint checks ownership
   - Returns 403 for accessing private content of other users
   - Allows access to own content + approved global content

### 2. PDF Fingerprinting (Duplicate Prevention)
```javascript
// Implemented in upload controller
const fingerprint = generatePDFFingerprint(file.buffer); // SHA-256 hash
const duplicate = await checkDuplicatePDF(fingerprint, userId);

// Prevents:
// - Same user uploading identical PDF twice
// - Users uploading PDFs already in global library  
// - Allows re-upload if another user's content is private
```

### 3. Admin Content Management
```bash
# Bulk approve user content for global library
node admin-approve-content.js --list-pending
node admin-approve-content.js CONTENT_ID_1 CONTENT_ID_2
node admin-approve-content.js --approve-all
node admin-approve-content.js --revoke CONTENT_ID
```

### 4. Frontend Privacy Features

#### Tabbed Interface
- **Discover Tab**: Global approved content only
- **My Uploads Tab**: User's private uploads with status badges  
- **My Learning Tab**: User's enrolled content with progress

#### Status Badges
- 🔒 **Private**: Only visible to uploader
- ✅ **Public**: Approved for global library
- ⏳ **Pending**: Awaiting admin approval (future feature)

---

## 🔧 Troubleshooting

### Common Production Issues

#### 1. 502 Bad Gateway Errors
```bash
# Check if PM2 processes are running
pm2 status

# If no processes found
cd ~/MindScroll/backend
pm2 start ecosystem.config.cjs --env production

# Check logs for errors
pm2 logs --lines 20

# Test API locally
curl localhost:3001/api
```

#### 2. Database Connection Issues
```bash
# Common error: "prepared statement already exists"
# Solution: Ensure using transaction pooler with pgbouncer=true

# Check connection string in .env.production
grep DATABASE_URL backend/.env.production
# Should be: port 6543 with pgbouncer=true

# Test connection
cd backend && npx prisma db push
```

#### 3. Job ID Collisions (Duplicate Jobs)
```bash
# Old issue: Sequential job IDs caused conflicts
# Solution: Implemented timestamp-based UUIDs

# Check queueService.js for generateJobId function
# Job IDs now format: job_1734123456789_123456
```

#### 4. Upload Failures
```bash
# Check file size limits
grep MAX_FILE_SIZE backend/.env.production  # Should be 52428800 (50MB)

# Check Nginx body size
sudo grep client_max_body_size /etc/nginx/sites-available/default

# Test R2 connection
cd backend && node -e "
const r2 = require('./src/utils/r2StreamingStorage.js');
r2.testConnection().then(console.log).catch(console.error);
"
```

#### 5. CORS Issues
```bash
# Update CORS_ORIGIN in .env.production
CORS_ORIGIN="https://epigram-lake.vercel.app,https://epigram.duckdns.org"

# Restart PM2 after environment changes
pm2 restart all --update-env
```

### Debug Commands
```bash
# Check all services health
curl https://epigram.duckdns.org/health
curl https://epigram.duckdns.org/api

# Monitor real-time logs
pm2 logs --lines 0

# Check system resources  
free -h          # Memory usage
df -h            # Disk usage
top              # CPU usage

# Test database connectivity
cd backend && npx prisma db push --preview-feature

# Check Redis
redis-cli ping   # Should return PONG

# Nginx status
sudo systemctl status nginx
sudo nginx -t    # Test configuration
```

---

## 🛠️ Maintenance & Migration

### Regular Maintenance Tasks

#### Daily
```bash
# Check application health
curl https://epigram.duckdns.org/health

# Monitor PM2 processes
pm2 status
pm2 logs --lines 50

# Check system resources
df -h && free -h
```

#### Weekly
```bash
# Update dependencies (carefully)
cd backend && npm audit fix

# Check for security updates
sudo apt update && sudo apt list --upgradable

# Review logs for errors
pm2 logs --lines 500 | grep ERROR

# Restart PM2 processes (clears memory)
pm2 restart all
```

#### Monthly
```bash
# Backup database (Supabase provides automatic backups)
# Check SSL certificate expiry (auto-renewed)
# Review and clean upload storage
# Performance monitoring review
```

### Migration to Larger Instance

#### Pre-Migration Checklist
```bash
# 1. Document current setup
pm2 save                           # Save PM2 configuration
sudo cp -r /etc/nginx /backup/     # Backup Nginx config
cp backend/.env.production /backup/ # Backup environment

# 2. Test deployment scripts
git pull origin main
pm2 restart all --update-env

# 3. Verify all services working
curl https://epigram.duckdns.org/api
```

#### Migration Process
1. **Launch new EC2 instance** (larger size)
2. **Follow this deployment guide** exactly
3. **Copy environment variables** from backup
4. **Update DuckDNS** to point to new IP
5. **Test thoroughly** before switching traffic
6. **Update Vercel** environment with new API URL

#### Post-Migration
```bash
# Test all endpoints
curl https://epigram.duckdns.org/api
curl https://epigram.duckdns.org/health

# Test user upload flow
# Test learning session flow
# Test admin functions

# Monitor for 24h before terminating old instance
```

### Scaling Considerations

#### When to Scale Up
- CPU usage consistently > 80%
- Memory usage > 85%
- Response times > 500ms
- Upload processing queue backing up

#### Horizontal Scaling (Future)
- Add load balancer (AWS Application Load Balancer)
- Scale PM2 API instances: `pm2 scale mindscroll-api +2`
- Consider separate worker instances
- Database connection pooling optimization

#### Vertical Scaling
- **t3.small** → **t3.medium** (2GB → 4GB RAM)
- **t3.medium** → **t3.large** (4GB → 8GB RAM)
- For AI processing: **c5.large** or **c5.xlarge**

---

## 📊 Monitoring & Alerts

### Key Metrics
- **Response Time**: < 200ms (API), < 2s (upload processing)
- **Memory Usage**: < 80% (sustained)
- **CPU Usage**: < 70% (average)
- **Disk Usage**: < 80%
- **Error Rate**: < 1%

### Health Endpoints
```bash
# Application health
GET /health
# Returns: {"status":"ok","timestamp":"2025-08-13T14:30:00.000Z"}

# API information  
GET /api
# Returns: {"name":"Epigram API","version":"1.0.0",...}

# PM2 process info
pm2 jlist  # JSON output for monitoring tools
```

### Log Monitoring
```bash
# Critical error patterns to watch
pm2 logs | grep -E "(ERROR|FATAL|Database.*failed|Redis.*failed)"

# Upload processing issues
pm2 logs mindscroll-worker | grep "❌"

# Performance issues
pm2 logs | grep -E "(timeout|slow|memory)"
```

---

## 📞 Support & Troubleshooting Guide

### Self-Diagnosis Steps
1. **Check service status**: `pm2 status`
2. **Test API locally**: `curl localhost:3001/api`
3. **Check recent logs**: `pm2 logs --lines 50`
4. **Verify database**: `cd backend && npx prisma db push`
5. **Test external access**: `curl https://epigram.duckdns.org/api`

### Common Solutions
- **502 errors**: Restart PM2 services
- **Database errors**: Check connection string format
- **Upload failures**: Verify file size limits and R2 credentials
- **CORS errors**: Update CORS_ORIGIN environment variable
- **Job conflicts**: Restart to reset timestamp-based job IDs

### Emergency Recovery
```bash
# Full service restart
pm2 delete all
cd ~/MindScroll/backend
pm2 start ecosystem.config.cjs --env production

# If PM2 config fails, manual start:
pm2 start src/index.js --name "api" --env production -i max
pm2 start src/services/worker.js --name "worker" --env production

# Nginx restart
sudo systemctl restart nginx

# Redis restart
sudo systemctl restart redis-server
```

**Last Updated:** August 2025  
**Version:** v0.3 - Production Ready with Security & Privacy Features  
**Tested on:** Ubuntu 22.04 LTS, Node.js 20.x, PM2 5.x