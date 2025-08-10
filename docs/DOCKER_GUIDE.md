# 🐳 MindScroll Docker Development Guide

**Complete guide for dockerizing and running MindScroll backend with Docker**

## 📋 Quick Reference

### Essential Commands
```bash
# Build with test gate (tests must pass first!)
make build

# Start development environment
make dev

# Check all services health
make health

# View logs from all containers
make logs

# Stop all services
make down

# Clean up Docker resources
make clean
```

---

## 🏗️ Docker Architecture

### What Gets Containerized
```
┌─────────────────────────────────────────┐
│              Docker Stack               │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Backend │  │ Worker  │  │  Redis  │ │
│  │API :3001│  │ Process │  │  :6379  │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│        │           │           │        │
│  ┌─────▼───────────▼───────────▼─────┐  │
│  │        Docker Network            │  │
│  │       mindscroll-network         │  │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
            │                  │
    ┌───────▼────────┐  ┌─────▼─────┐
    │   Supabase     │  │Cloudflare │
    │ (PostgreSQL)   │  │    R2     │
    └────────────────┘  └───────────┘
```

### Services Overview
- **Backend API**: Node.js Express server with Prisma ORM
- **Worker Process**: Bull Queue job processor for async tasks
- **Redis**: Local containerized Redis for job queue storage
- **External**: Supabase PostgreSQL & Cloudflare R2 (not containerized)

---

## 🔧 File Structure

### Docker Files
```
/Users/mohitdhawan/Microlearn/
├── Makefile                    # Easy Docker commands
├── docker-compose.yml          # Development environment
├── docker-compose.prod.yml     # Production environment
└── backend/
    ├── Dockerfile              # Production build with test gate
    ├── Dockerfile.dev          # Development build with hot reload
    ├── .dockerignore           # Build optimization
    ├── ecosystem.config.js     # PM2 configuration
    └── scripts/
        └── docker-health.js    # Container health checks
```

### Docker Images Created
```bash
# After running 'make build':
docker images | grep mindscroll

# Expected output:
mindscroll-backend        latest    abcd1234    5 minutes ago    234MB
mindscroll-worker         latest    efgh5678    5 minutes ago    234MB
redis                     7-alpine  ijkl9012    1 hour ago       32MB
```

---

## 🚀 Step-by-Step Docker Setup

### Step 1: Build Images with Test Gate
```bash
cd /Users/mohitdhawan/Microlearn

# This command will:
# 1. Run integration tests first (MUST pass)
# 2. Build optimized Docker images
# 3. Tag images appropriately
make build
```

**What happens during build:**
```
Building mindscroll-backend...
Stage 1/3: TEST_STAGE
 ├── Installing dependencies...
 ├── Running integration tests...
 │   ✅ Database connection test
 │   ✅ Redis connection test  
 │   ✅ Cloudflare R2 test
 │   ✅ API endpoint tests
 └── All tests passed! ✨

Stage 2/3: BUILD_STAGE
 ├── Copying source code...
 ├── Installing production deps...
 └── Setting up PM2 config...

Stage 3/3: PRODUCTION_STAGE  
 ├── Creating minimal runtime...
 ├── Setting up non-root user...
 └── Configuring health checks...

Successfully built mindscroll-backend:latest
```

### Step 2: Start Development Environment
```bash
# Start all containers in background
make dev

# Expected output:
Creating mindscroll-redis-dev ... done
Creating mindscroll-backend-dev ... done  
Creating mindscroll-worker-dev ... done

✅ Development environment started!
🔗 Backend API: http://localhost:3001
🔗 Health check: http://localhost:3001/health
📊 Logs: make logs
```

### Step 3: Verify Everything Works
```bash
# Check health of all services
make health

# Expected output:
🏥 Checking service health...
✅ Redis: PONG
✅ Backend API: {"status":"OK","message":"MindScroll API is running"}
✅ Worker Process: Active
✅ Database: Connected to Supabase
✅ Storage: Cloudflare R2 accessible

# Test API endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api
```

---

## 📊 Container Management

### Development Commands
```bash
# Start development stack
make dev

# View real-time logs
make logs

# View specific service logs
make logs-api     # Backend API logs
make logs-worker  # Worker process logs  
make logs-redis   # Redis logs

# Restart specific service
docker-compose restart api
docker-compose restart worker

# Scale services (if needed)
docker-compose scale worker=2
```

### Production Commands  
```bash
# Start production stack
make prod

# Check production status
make prod-status

# View production logs
make prod-logs

# Restart production services
make prod-restart
```

### Maintenance Commands
```bash
# Stop all services
make down

# Clean up Docker resources
make clean

# Rebuild everything from scratch
make rebuild

# Update containers to latest images
make update
```

---

## 🔍 Debugging & Troubleshooting

### Common Issues

#### 1. Build Fails with Test Errors
```bash
# Error example:
Building mindscroll-backend...
Stage 1/3: TEST_STAGE
❌ Integration tests failed!
Error: Could not connect to database

# Solution:
# Check your .env.production file
cat backend/.env.production | grep DATABASE_URL

# Run tests locally first
cd backend && node scripts/test-full-stack.js
```

#### 2. Container Won't Start
```bash
# Check container logs
docker logs mindscroll-backend-dev

# Common issues:
# - Missing environment variables
# - Port conflicts
# - Database connection issues

# Debug inside container
docker exec -it mindscroll-backend-dev sh
```

#### 3. Services Can't Connect
```bash
# Check network connectivity
docker network ls | grep mindscroll
docker network inspect mindscroll-network

# Test service communication
docker exec mindscroll-backend-dev redis-cli -h redis ping
```

#### 4. Performance Issues
```bash
# Check resource usage
docker stats

# Example output:
CONTAINER           CPU %   MEM USAGE / LIMIT
mindscroll-backend  5.2%    180MiB / 512MiB
mindscroll-worker   3.1%    120MiB / 256MiB
mindscroll-redis    1.2%    15MiB / 64MiB
```

### Debug Commands
```bash
# Enter container shell
docker exec -it mindscroll-backend-dev sh

# Check processes inside container
docker exec mindscroll-backend-dev ps aux

# Check environment variables
docker exec mindscroll-backend-dev env | grep DATABASE

# View container configuration
docker inspect mindscroll-backend-dev
```

---

## ⚡ Performance Optimization

### Image Size Optimization
```bash
# Check image sizes
docker images | grep mindscroll

# Optimized sizes (after multi-stage build):
mindscroll-backend    latest    234MB  # ✅ Good (was ~800MB)
mindscroll-worker     latest    234MB  # ✅ Good 
redis                 7-alpine   32MB  # ✅ Excellent
```

### Build Performance
```bash
# Use build cache for faster rebuilds
make build-cached

# Build without cache (clean build)
make build-clean

# Check build history
docker history mindscroll-backend:latest
```

### Runtime Performance
```bash
# Monitor resource usage
make monitor

# View detailed container stats
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Optimize container resources in docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 512M
      cpus: "0.5"
    reservations:
      memory: 256M
      cpus: "0.25"
```

---

## 🔐 Security Best Practices

### Container Security
```bash
# ✅ Non-root user in containers
# ✅ Minimal Alpine Linux base images
# ✅ No sensitive data in images
# ✅ Read-only filesystem where possible
# ✅ Limited container capabilities

# Scan images for vulnerabilities
docker scan mindscroll-backend:latest

# Check for security best practices
make security-check
```

### Environment Security
```bash
# ✅ Environment variables for secrets
# ✅ .env files not committed to git
# ✅ Separate dev/prod configurations  
# ✅ Network isolation between containers

# Verify no secrets in images
docker history mindscroll-backend:latest --no-trunc
```

---

## 📈 Production Deployment

### Build for Production
```bash
# Create production-optimized images
make build-prod

# Test production stack locally
make prod

# Deploy to remote server
make deploy-remote
```

### Health Monitoring
```bash
# Comprehensive health checks
make health-full

# Set up monitoring alerts
make setup-monitoring

# View health check logs
docker logs mindscroll-backend-prod --tail 50 | grep health
```

---

## 🛠️ Advanced Usage

### Custom Build Options
```bash
# Build specific services
make build-api
make build-worker

# Build with different Node.js version
NODE_VERSION=18 make build

# Build for different architecture
PLATFORM=linux/arm64 make build
```

### Database Operations
```bash
# Run migrations in container
make migrate

# Access database via container
make db-shell

# Backup/restore data
make db-backup
make db-restore
```

### Development Workflows
```bash
# Hot reload development
make dev-watch

# Run tests in container
make test-docker

# Debug with remote debugger
make debug

# Profile application performance
make profile
```

---

## 📚 Docker Compose Reference

### Development (docker-compose.yml)
```yaml
services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
      - "9229:9229"  # Debug port
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
```

### Production (docker-compose.prod.yml)  
```yaml
services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
```

---

## ❓ FAQ

**Q: Do I need to install Redis locally?**
A: No! Redis runs in a Docker container. Just run `make dev`.

**Q: Can I develop without Docker?**  
A: Yes, but Docker ensures consistency. For local dev: `npm start` in backend/.

**Q: How do I update dependencies?**
A: Update package.json, then run `make rebuild` to rebuild containers.

**Q: Can I use this in production?**
A: Yes! Use `make prod` for production-ready containers with PM2.

**Q: How do I debug Node.js in containers?**
A: Development containers expose port 9229. Use VS Code or Chrome DevTools.

**Q: What if tests fail during build?**
A: Fix the failing tests first. Docker build won't proceed until all tests pass.

---

## 📞 Support

### Useful Commands for Support
```bash
# System information
make system-info

# Generate debug report
make debug-report

# Clean and restart everything
make reset
```

### Log Locations
- Application logs: `docker logs mindscroll-backend-dev`
- Build logs: Shown during `make build`
- Health check logs: `make health`

**Last Updated:** August 2025  
**Docker Version:** 24.x  
**Node.js Version:** 20.x