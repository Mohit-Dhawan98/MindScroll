# ============================================================================
# MindScroll - Docker Management Makefile
# ============================================================================
# Enterprise-grade Docker workflow automation
# 
# Usage:
#   make help          # Show all available commands
#   make test          # Run tests locally
#   make build         # Build production image with test gate
#   make dev           # Start development environment
#   make prod          # Start production environment
#   make clean         # Clean up Docker resources
# ============================================================================

# ===================
# Configuration
# ===================
DOCKER_REGISTRY ?= mindscroll
IMAGE_NAME ?= mindscroll-backend
VERSION ?= latest
COMPOSE_PROJECT_NAME ?= mindscroll

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# ===================
# Helper Functions
# ===================
define log_info
	@echo "$(BLUE)ℹ️  $(1)$(NC)"
endef

define log_success
	@echo "$(GREEN)✅ $(1)$(NC)"
endef

define log_warning
	@echo "$(YELLOW)⚠️  $(1)$(NC)"
endef

define log_error
	@echo "$(RED)❌ $(1)$(NC)"
endef

# ===================
# Default target
# ===================
.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)🚀 MindScroll Docker Management$(NC)"
	@echo ""
	@echo "$(YELLOW)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(BLUE)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Environment Variables:$(NC)"
	@echo "  DOCKER_REGISTRY     Docker registry prefix (default: mindscroll)"
	@echo "  IMAGE_NAME          Docker image name (default: mindscroll-backend)"
	@echo "  VERSION             Image version tag (default: latest)"
	@echo "  COMPOSE_PROJECT_NAME Project name for compose (default: mindscroll)"

# ===================
# Testing
# ===================
.PHONY: test
test: ## Run tests locally (without Docker)
	$(call log_info,"Running local tests...")
	@cd backend && npm test
	$(call log_success,"Tests completed successfully!")

.PHONY: test-docker
test-docker: ## Run tests in Docker container
	$(call log_info,"Running tests in Docker...")
	@docker build --target test-stage -t $(IMAGE_NAME)-test:$(VERSION) ./backend
	$(call log_success,"Docker tests completed successfully!")

.PHONY: lint
lint: ## Run ESLint locally
	$(call log_info,"Running ESLint...")
	@cd backend && npm run lint
	$(call log_success,"Linting completed successfully!")

# ===================
# Building
# ===================
.PHONY: build
build: ## Build production image with test gate
	$(call log_info,"Building production image with test gate...")
	@docker build \
		-t $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION) \
		-t $(DOCKER_REGISTRY)/$(IMAGE_NAME):latest \
		./backend
	$(call log_success,"Production image built successfully!")
	@docker images | grep $(IMAGE_NAME)

.PHONY: build-dev
build-dev: ## Build development image
	$(call log_info,"Building development image...")
	@docker build \
		-f ./backend/Dockerfile.dev \
		-t $(DOCKER_REGISTRY)/$(IMAGE_NAME):dev \
		./backend
	$(call log_success,"Development image built successfully!")

.PHONY: build-no-cache
build-no-cache: ## Build production image without cache
	$(call log_info,"Building production image without cache...")
	@docker build --no-cache \
		-t $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION) \
		-t $(DOCKER_REGISTRY)/$(IMAGE_NAME):latest \
		./backend
	$(call log_success,"Production image built successfully (no cache)!")

# ===================
# Development Environment
# ===================
.PHONY: dev
dev: ## Start development environment
	$(call log_info,"Starting development environment...")
	@docker-compose up -d
	$(call log_success,"Development environment started!")
	@echo "$(YELLOW)Services:$(NC)"
	@echo "  API:    http://localhost:3001"
	@echo "  Health: http://localhost:3001/health"
	@echo "  Redis:  localhost:6379"
	@echo ""
	@echo "$(YELLOW)Useful commands:$(NC)"
	@echo "  make logs      # View logs"
	@echo "  make status    # View service status"
	@echo "  make dev-stop  # Stop development environment"

.PHONY: dev-stop
dev-stop: ## Stop development environment
	$(call log_info,"Stopping development environment...")
	@docker-compose down
	$(call log_success,"Development environment stopped!")

.PHONY: dev-restart
dev-restart: dev-stop dev ## Restart development environment

.PHONY: dev-logs
dev-logs: logs ## Alias for logs command

# ===================
# Production Environment
# ===================
.PHONY: prod
prod: ## Start production environment
	$(call log_info,"Starting production environment...")
	@if [ ! -f .env ]; then \
		echo "$(RED)❌ Missing .env file! Copy .env.example and configure it.$(NC)"; \
		exit 1; \
	fi
	@docker-compose -f docker-compose.prod.yml up -d
	$(call log_success,"Production environment started!")
	@echo "$(YELLOW)Production services started. Check status with 'make prod-status'$(NC)"

.PHONY: prod-stop
prod-stop: ## Stop production environment
	$(call log_info,"Stopping production environment...")
	@docker-compose -f docker-compose.prod.yml down
	$(call log_success,"Production environment stopped!")

.PHONY: prod-restart
prod-restart: prod-stop prod ## Restart production environment

.PHONY: prod-logs
prod-logs: ## View production logs
	@docker-compose -f docker-compose.prod.yml logs -f

.PHONY: prod-status
prod-status: ## Check production service status
	@docker-compose -f docker-compose.prod.yml ps

# ===================
# Monitoring & Logs
# ===================
.PHONY: logs
logs: ## View development logs
	@docker-compose logs -f

.PHONY: logs-api
logs-api: ## View API logs only
	@docker-compose logs -f api

.PHONY: logs-worker
logs-worker: ## View worker logs only
	@docker-compose logs -f worker

.PHONY: logs-redis
logs-redis: ## View Redis logs only
	@docker-compose logs -f redis

.PHONY: status
status: ## Check service status
	@docker-compose ps

.PHONY: health
health: ## Check service health
	$(call log_info,"Checking service health...")
	@curl -f http://localhost:3001/health || $(call log_error,"API health check failed!")
	@docker-compose exec redis redis-cli ping || $(call log_error,"Redis health check failed!")
	$(call log_success,"Health checks completed!")

# ===================
# Database Operations
# ===================
.PHONY: db-migrate
db-migrate: ## Run database migrations
	$(call log_info,"Running database migrations...")
	@docker-compose exec api npx prisma migrate deploy
	$(call log_success,"Database migrations completed!")

.PHONY: db-generate
db-generate: ## Generate Prisma client
	$(call log_info,"Generating Prisma client...")
	@docker-compose exec api npx prisma generate
	$(call log_success,"Prisma client generated!")

.PHONY: db-studio
db-studio: ## Open Prisma Studio
	$(call log_info,"Opening Prisma Studio...")
	@docker-compose exec api npx prisma studio --port 5558

# ===================
# Maintenance & Cleanup
# ===================
.PHONY: clean
clean: ## Clean up Docker resources
	$(call log_warning,"Cleaning up Docker resources...")
	@docker-compose down -v 2>/dev/null || true
	@docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true
	@docker system prune -f
	@docker volume prune -f
	$(call log_success,"Docker cleanup completed!")

.PHONY: clean-all
clean-all: ## Clean all Docker resources (including images)
	$(call log_warning,"Performing deep Docker cleanup...")
	@docker-compose down -v --rmi all 2>/dev/null || true
	@docker-compose -f docker-compose.prod.yml down -v --rmi all 2>/dev/null || true
	@docker system prune -af
	@docker volume prune -f
	@docker image prune -af
	$(call log_success,"Deep Docker cleanup completed!")

.PHONY: clean-volumes
clean-volumes: ## Clean up volumes only
	$(call log_warning,"Cleaning up Docker volumes...")
	@docker volume prune -f
	$(call log_success,"Volume cleanup completed!")

# ===================
# Registry Operations
# ===================
.PHONY: push
push: build ## Build and push to registry
	$(call log_info,"Pushing image to registry...")
	@docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION)
	@docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):latest
	$(call log_success,"Image pushed to registry!")

.PHONY: pull
pull: ## Pull latest image from registry
	$(call log_info,"Pulling latest image from registry...")
	@docker pull $(DOCKER_REGISTRY)/$(IMAGE_NAME):latest
	$(call log_success,"Image pulled from registry!")

# ===================
# Utility Commands
# ===================
.PHONY: shell
shell: ## Open shell in API container
	@docker-compose exec api sh

.PHONY: shell-worker
shell-worker: ## Open shell in worker container  
	@docker-compose exec worker sh

.PHONY: shell-redis
shell-redis: ## Open Redis CLI
	@docker-compose exec redis redis-cli

.PHONY: env-example
env-example: ## Create .env.example file
	$(call log_info,"Creating .env.example file...")
	@echo "# Database (Supabase)" > .env.example
	@echo "DATABASE_URL=postgresql://username:password@host:port/database" >> .env.example
	@echo "DIRECT_URL=postgresql://username:password@host:port/database" >> .env.example
	@echo "" >> .env.example
	@echo "# AI Services" >> .env.example
	@echo "OPENAI_API_KEY=your_openai_api_key" >> .env.example
	@echo "ANTHROPIC_API_KEY=your_anthropic_api_key" >> .env.example
	@echo "" >> .env.example
	@echo "# Storage (Cloudflare R2)" >> .env.example
	@echo "R2_ACCOUNT_ID=your_r2_account_id" >> .env.example
	@echo "R2_ACCESS_KEY_ID=your_r2_access_key" >> .env.example
	@echo "R2_SECRET_ACCESS_KEY=your_r2_secret_key" >> .env.example
	@echo "R2_BUCKET_NAME=your_bucket_name" >> .env.example
	@echo "R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com" >> .env.example
	@echo "" >> .env.example
	@echo "# Authentication" >> .env.example
	@echo "JWT_SECRET=your_super_secret_jwt_key_here" >> .env.example
	@echo "" >> .env.example
	@echo "# CORS (Production)" >> .env.example
	@echo "CORS_ORIGIN=https://yourdomain.com" >> .env.example
	@echo "" >> .env.example
	@echo "# Worker Configuration" >> .env.example
	@echo "PM2_INSTANCES=2" >> .env.example
	@echo "WORKER_CONCURRENCY=5" >> .env.example
	@echo "WORKER_MAX_JOBS=100" >> .env.example
	$(call log_success,".env.example created! Copy to .env and configure.")

# ===================
# CI/CD Helpers
# ===================
.PHONY: ci-test
ci-test: test-docker ## CI: Run tests in Docker (fail-fast)

.PHONY: ci-build
ci-build: ## CI: Build and test production image
	$(call log_info,"CI: Building production image with tests...")
	@docker build --target test-stage -t $(IMAGE_NAME)-test:$(VERSION) ./backend
	@docker build -t $(IMAGE_NAME):$(VERSION) ./backend
	$(call log_success,"CI: Build completed successfully!")

.PHONY: ci-security-scan
ci-security-scan: ## CI: Run security scan on image
	$(call log_info,"CI: Running security scan...")
	@docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy image $(IMAGE_NAME):$(VERSION)
	$(call log_success,"CI: Security scan completed!")

# ===================
# Special Targets
# ===================
.DEFAULT_GOAL := help

# Ensure commands work on macOS and Linux
SHELL := /bin/bash

# =============================================================================
# Quick Start Guide:
# 
# 1. First time setup:
#    make env-example    # Create .env.example
#    cp .env.example .env  # Copy and edit with your values
# 
# 2. Development:
#    make dev           # Start development environment
#    make logs          # View logs
#    make test          # Run tests
# 
# 3. Production:
#    make build         # Build with test gate
#    make prod          # Start production environment
# 
# 4. Maintenance:
#    make clean         # Clean up resources
#    make health        # Check service health
# =============================================================================