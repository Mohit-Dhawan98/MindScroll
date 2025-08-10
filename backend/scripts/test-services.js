#!/usr/bin/env node
/**
 * Test all production services before deployment
 * Run: node scripts/test-services.js
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import AWS from 'aws-sdk';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Force load .env.production (override any existing .env)
const envPath = path.join(__dirname, '../.env.production');
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('Failed to load .env.production:', result.error);
  process.exit(1);
}

console.log(`Loading environment from: ${envPath}`);

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

// Test results
const results = {
  passed: [],
  failed: []
};

/**
 * Test Supabase Database Connection
 */
async function testSupabase() {
  log.info('Testing Supabase database connection...');
  const prisma = new PrismaClient();
  
  try {
    // Test connection
    await prisma.$connect();
    log.success('Connected to Supabase database');
    
    // Test query
    const userCount = await prisma.user.count();
    log.success(`Database query successful. Users: ${userCount}`);
    
    results.passed.push('Supabase Database');
    return true;
  } catch (error) {
    log.error(`Supabase connection failed: ${error.message}`);
    results.failed.push('Supabase Database');
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Test Redis Connection (Local)
 */
async function testRedis() {
  log.info('Testing Redis connection...');
  
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Test connection
    const pong = await redis.ping();
    if (pong === 'PONG') {
      log.success('Redis connection successful');
      
      // Test set/get
      await redis.set('test:key', 'test-value');
      const value = await redis.get('test:key');
      await redis.del('test:key');
      
      if (value === 'test-value') {
        log.success('Redis read/write successful');
        results.passed.push('Redis');
        redis.disconnect();
        return true;
      }
    }
    
    throw new Error('Redis ping failed');
  } catch (error) {
    log.error(`Redis connection failed: ${error.message}`);
    log.warn('Make sure Redis is running locally: redis-server');
    results.failed.push('Redis');
    return false;
  }
}

/**
 * Test Cloudflare R2 Storage
 */
async function testCloudflareR2() {
  log.info('Testing Cloudflare R2 storage...');
  
  try {
    // Configure S3-compatible client for R2
    const s3 = new AWS.S3({
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      region: 'auto'
    });
    
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const testKey = `test/test-${Date.now()}.txt`;
    const testContent = 'MindScroll R2 test file';
    
    // Test upload
    await s3.putObject({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain'
    }).promise();
    
    log.success('R2 upload successful');
    
    // Test download
    const downloaded = await s3.getObject({
      Bucket: bucketName,
      Key: testKey
    }).promise();
    
    if (downloaded.Body.toString() === testContent) {
      log.success('R2 download successful');
      
      // Cleanup
      await s3.deleteObject({
        Bucket: bucketName,
        Key: testKey
      }).promise();
      
      log.success('R2 delete successful');
      results.passed.push('Cloudflare R2');
      return true;
    }
    
    throw new Error('Downloaded content mismatch');
  } catch (error) {
    log.error(`Cloudflare R2 test failed: ${error.message}`);
    log.warn('Check your R2 credentials and bucket name');
    results.failed.push('Cloudflare R2');
    return false;
  }
}

/**
 * Test Environment Variables
 */
function testEnvironmentVariables() {
  log.info('Checking environment variables...');
  
  const required = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'REDIS_URL',
    'CLOUDFLARE_R2_ENDPOINT',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'JWT_SECRET'
  ];
  
  const missing = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
      log.error(`Missing: ${key}`);
    } else {
      // Hide sensitive values
      const value = key.includes('KEY') || key.includes('SECRET') 
        ? '***' 
        : process.env[key].substring(0, 20) + '...';
      log.success(`Found: ${key} = ${value}`);
    }
  }
  
  if (missing.length === 0) {
    results.passed.push('Environment Variables');
    return true;
  } else {
    results.failed.push(`Environment Variables (${missing.length} missing)`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n' + colors.blue + '═══════════════════════════════════════════');
  console.log('  MindScroll Production Services Test');
  console.log('═══════════════════════════════════════════' + colors.reset + '\n');
  
  // Check environment
  log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log.info(`Config file: .env.production\n`);
  
  // Run tests
  const envOk = testEnvironmentVariables();
  console.log('');
  
  if (envOk) {
    const supabaseOk = await testSupabase();
    console.log('');
    
    const redisOk = await testRedis();
    console.log('');
    
    const r2Ok = await testCloudflareR2();
    console.log('');
  }
  
  // Summary
  console.log(colors.blue + '═══════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════' + colors.reset);
  
  if (results.passed.length > 0) {
    console.log(colors.green + '\n✓ Passed:' + colors.reset);
    results.passed.forEach(test => console.log(`  - ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log(colors.red + '\n✗ Failed:' + colors.reset);
    results.failed.forEach(test => console.log(`  - ${test}`));
  }
  
  // Final result
  const allPassed = results.failed.length === 0;
  console.log('');
  
  if (allPassed) {
    console.log(colors.green + '🎉 All services are ready for production!' + colors.reset);
    process.exit(0);
  } else {
    console.log(colors.red + '❌ Some services are not configured properly.' + colors.reset);
    console.log(colors.yellow + 'Please fix the issues above before deploying.' + colors.reset);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});