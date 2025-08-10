#!/usr/bin/env node

/**
 * ============================================================================
 * MindScroll - Docker Health Check Script
 * ============================================================================
 * Comprehensive health check for Docker containers that tests:
 * 1. Database connectivity (Supabase PostgreSQL)
 * 2. Redis connectivity
 * 3. Essential environment variables
 * 4. File system permissions
 * 5. Memory usage
 * 
 * Exit codes:
 *   0 = Healthy (all checks passed)
 *   1 = Unhealthy (one or more checks failed)
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Health check configuration
const HEALTH_CHECK_CONFIG = {
  timeout: 10000, // 10 seconds
  retries: 3,
  checkInterval: 1000 // 1 second between retries
}

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

/**
 * Logging utilities
 */
const logger = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  debug: (msg) => {
    if (process.env.DEBUG_HEALTH_CHECK) {
      console.log(`${colors.cyan}🐛 ${msg}${colors.reset}`)
    }
  }
}

/**
 * Health check results tracker
 */
class HealthChecker {
  constructor() {
    this.checks = []
    this.startTime = Date.now()
  }

  addCheck(name, status, details = '') {
    this.checks.push({
      name,
      status,
      details,
      timestamp: new Date().toISOString()
    })
    
    if (status === 'pass') {
      logger.success(`${name}`)
    } else if (status === 'warning') {
      logger.warning(`${name} - ${details}`)
    } else {
      logger.error(`${name} - ${details}`)
    }
  }

  getResults() {
    const endTime = Date.now()
    const duration = endTime - this.startTime
    
    const passed = this.checks.filter(c => c.status === 'pass').length
    const warnings = this.checks.filter(c => c.status === 'warning').length
    const failed = this.checks.filter(c => c.status === 'fail').length
    
    return {
      summary: {
        total: this.checks.length,
        passed,
        warnings,
        failed,
        duration: `${duration}ms`
      },
      checks: this.checks,
      healthy: failed === 0
    }
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(healthChecker) {
  logger.info('Checking database connectivity...')
  
  let prisma
  try {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    })
    
    // Test basic connectivity
    await prisma.$connect()
    
    // Test query execution
    const result = await prisma.$queryRaw`SELECT 1 as test`
    
    if (result && result[0] && result[0].test === 1) {
      healthChecker.addCheck('Database Connectivity', 'pass')
    } else {
      healthChecker.addCheck('Database Connectivity', 'fail', 'Query test failed')
    }
    
  } catch (error) {
    logger.debug(`Database error: ${error.message}`)
    healthChecker.addCheck('Database Connectivity', 'fail', error.message)
  } finally {
    if (prisma) {
      await prisma.$disconnect()
    }
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(healthChecker) {
  logger.info('Checking Redis connectivity...')
  
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  let redis
  
  try {
    redis = new Redis(redisUrl, {
      connectTimeout: 5000,
      lazyConnect: true,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 2
    })
    
    // Test connection
    await redis.connect()
    
    // Test basic operations
    const testKey = `health_check_${Date.now()}`
    await redis.set(testKey, 'test_value', 'EX', 5) // Expire in 5 seconds
    const value = await redis.get(testKey)
    await redis.del(testKey)
    
    if (value === 'test_value') {
      healthChecker.addCheck('Redis Connectivity', 'pass')
    } else {
      healthChecker.addCheck('Redis Connectivity', 'fail', 'Read/write test failed')
    }
    
    // Check Redis memory usage
    const info = await redis.info('memory')
    const memoryUsage = info.match(/used_memory_human:([^\r\n]+)/)
    if (memoryUsage) {
      logger.debug(`Redis memory usage: ${memoryUsage[1]}`)
    }
    
  } catch (error) {
    logger.debug(`Redis error: ${error.message}`)
    healthChecker.addCheck('Redis Connectivity', 'fail', error.message)
  } finally {
    if (redis) {
      await redis.quit()
    }
  }
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables(healthChecker) {
  logger.info('Checking environment variables...')
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET'
  ]
  
  const optionalEnvVars = [
    'REDIS_URL',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME'
  ]
  
  // Check required variables
  let missingRequired = []
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar)
    }
  }
  
  if (missingRequired.length > 0) {
    healthChecker.addCheck('Required Environment Variables', 'fail', 
      `Missing: ${missingRequired.join(', ')}`)
  } else {
    healthChecker.addCheck('Required Environment Variables', 'pass')
  }
  
  // Check optional variables
  let missingOptional = []
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar)
    }
  }
  
  if (missingOptional.length > 0) {
    healthChecker.addCheck('Optional Environment Variables', 'warning', 
      `Missing: ${missingOptional.join(', ')}`)
  } else {
    healthChecker.addCheck('Optional Environment Variables', 'pass')
  }
}

/**
 * Check file system permissions
 */
function checkFileSystemPermissions(healthChecker) {
  logger.info('Checking file system permissions...')
  
  const directories = [
    '/app/logs',
    '/app/storage/cache',
    '/app/storage/extracted-text',
    '/app/uploads'
  ]
  
  let permissionErrors = []
  
  for (const dir of directories) {
    try {
      // Check if directory exists and is writable
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      // Test write access
      const testFile = path.join(dir, '.health_check_test')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      
      logger.debug(`Directory ${dir} is writable`)
      
    } catch (error) {
      permissionErrors.push(`${dir}: ${error.message}`)
      logger.debug(`Directory ${dir} error: ${error.message}`)
    }
  }
  
  if (permissionErrors.length > 0) {
    healthChecker.addCheck('File System Permissions', 'fail', 
      permissionErrors.join('; '))
  } else {
    healthChecker.addCheck('File System Permissions', 'pass')
  }
}

/**
 * Check system resources
 */
function checkSystemResources(healthChecker) {
  logger.info('Checking system resources...')
  
  try {
    const memoryUsage = process.memoryUsage()
    const memoryUsedMB = Math.round(memoryUsage.rss / 1024 / 1024)
    
    logger.debug(`Memory usage: ${memoryUsedMB}MB`)
    
    // Check if memory usage is reasonable (less than 1GB for basic health check)
    if (memoryUsedMB > 1024) {
      healthChecker.addCheck('Memory Usage', 'warning', 
        `High memory usage: ${memoryUsedMB}MB`)
    } else {
      healthChecker.addCheck('Memory Usage', 'pass', `${memoryUsedMB}MB`)
    }
    
    // Check uptime
    const uptimeSeconds = process.uptime()
    const uptimeMinutes = Math.round(uptimeSeconds / 60)
    
    logger.debug(`Process uptime: ${uptimeMinutes} minutes`)
    healthChecker.addCheck('Process Uptime', 'pass', `${uptimeMinutes} minutes`)
    
  } catch (error) {
    logger.debug(`System resources error: ${error.message}`)
    healthChecker.addCheck('System Resources', 'fail', error.message)
  }
}

/**
 * Check application-specific health
 */
function checkApplicationHealth(healthChecker) {
  logger.info('Checking application health...')
  
  try {
    // Check if we're in the right directory
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      healthChecker.addCheck('Application Structure', 'fail', 
        'package.json not found in current directory')
      return
    }
    
    // Check package.json content
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    if (packageJson.name !== 'mindscroll-backend') {
      healthChecker.addCheck('Application Identity', 'warning', 
        `Package name: ${packageJson.name}`)
    } else {
      healthChecker.addCheck('Application Identity', 'pass')
    }
    
    // Check if source files exist
    const srcPath = path.join(process.cwd(), 'src', 'index.js')
    if (!fs.existsSync(srcPath)) {
      healthChecker.addCheck('Application Source', 'fail', 
        'Main application file not found')
    } else {
      healthChecker.addCheck('Application Source', 'pass')
    }
    
  } catch (error) {
    logger.debug(`Application health error: ${error.message}`)
    healthChecker.addCheck('Application Health', 'fail', error.message)
  }
}

/**
 * Main health check function
 */
async function runHealthCheck() {
  const healthChecker = new HealthChecker()
  
  logger.info('🏥 Starting MindScroll health check...')
  logger.info(`Environment: ${process.env.NODE_ENV || 'unknown'}`)
  logger.info(`Process PID: ${process.pid}`)
  
  try {
    // Run all health checks
    checkEnvironmentVariables(healthChecker)
    checkFileSystemPermissions(healthChecker)
    checkSystemResources(healthChecker)
    checkApplicationHealth(healthChecker)
    
    // Async checks
    await checkDatabase(healthChecker)
    await checkRedis(healthChecker)
    
    // Get results
    const results = healthChecker.getResults()
    
    // Output results
    console.log('\n' + '='.repeat(50))
    logger.info(`Health Check Summary`)
    console.log('='.repeat(50))
    console.log(`Total Checks: ${results.summary.total}`)
    console.log(`✅ Passed: ${results.summary.passed}`)
    console.log(`⚠️  Warnings: ${results.summary.warnings}`)
    console.log(`❌ Failed: ${results.summary.failed}`)
    console.log(`⏱️  Duration: ${results.summary.duration}`)
    console.log('='.repeat(50))
    
    if (results.healthy) {
      logger.success('🎉 All critical health checks passed!')
      process.exit(0)
    } else {
      logger.error('💥 One or more critical health checks failed!')
      
      // Output failed checks for debugging
      const failedChecks = results.checks.filter(c => c.status === 'fail')
      if (failedChecks.length > 0) {
        console.log('\n❌ Failed Checks:')
        failedChecks.forEach(check => {
          console.log(`  • ${check.name}: ${check.details}`)
        })
      }
      
      process.exit(1)
    }
    
  } catch (error) {
    logger.error(`Health check failed with error: ${error.message}`)
    logger.debug(`Stack trace: ${error.stack}`)
    process.exit(1)
  }
}

/**
 * Handle process signals gracefully
 */
process.on('SIGTERM', () => {
  logger.warning('Health check received SIGTERM, exiting...')
  process.exit(1)
})

process.on('SIGINT', () => {
  logger.warning('Health check received SIGINT, exiting...')
  process.exit(1)
})

// Set timeout to prevent hanging
setTimeout(() => {
  logger.error('Health check timed out!')
  process.exit(1)
}, HEALTH_CHECK_CONFIG.timeout)

// Run the health check
runHealthCheck().catch((error) => {
  logger.error(`Unhandled error in health check: ${error.message}`)
  process.exit(1)
})

/**
 * ============================================================================
 * Usage Examples:
 * 
 * Basic health check:
 *   node scripts/docker-health.js
 * 
 * With debug output:
 *   DEBUG_HEALTH_CHECK=1 node scripts/docker-health.js
 * 
 * In Docker container:
 *   docker exec container_name node scripts/docker-health.js
 * 
 * As Docker HEALTHCHECK:
 *   HEALTHCHECK CMD node scripts/docker-health.js || exit 1
 * ============================================================================
 */