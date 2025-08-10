/**
 * ============================================================================
 * MindScroll - PM2 Ecosystem Configuration
 * ============================================================================
 * Production-grade process management configuration for Docker containers
 * 
 * Features:
 * - Multi-process clustering for API and Worker
 * - Auto-restart on crashes and memory limits
 * - Log management and rotation
 * - Environment-specific configurations
 * - Health monitoring and graceful shutdowns
 * ============================================================================
 */

const cpus = parseInt(process.env.PM2_INSTANCES) || require('os').cpus().length
const maxMemoryRestart = process.env.PM2_MAX_MEMORY_RESTART || '1G'
const nodeEnv = process.env.NODE_ENV || 'production'

module.exports = {
  apps: [
    /**
     * =====================
     * API Server Process
     * =====================
     */
    {
      name: 'mindscroll-api',
      script: 'src/index.js',
      cwd: '/app',
      
      // Process management
      instances: cpus,
      exec_mode: 'cluster',
      
      // Performance settings
      max_memory_restart: maxMemoryRestart,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Auto-restart configuration
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      
      // Environment
      env: {
        NODE_ENV: nodeEnv,
        PORT: process.env.PORT || 3001,
        PM2_SERVE_PATH: '.',
        PM2_SERVE_PORT: process.env.PORT || 3001,
        PM2_SERVE_SPA: 'false',
        PM2_SERVE_HOMEPAGE: '/health'
      },
      
      // Development environment (not typically used in Docker)
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      
      // Production environment
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001
      },
      
      // Logging configuration
      log_type: 'json',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/app/logs/api-error.log',
      out_file: '/app/logs/api-out.log',
      log_file: '/app/logs/api-combined.log',
      
      // Log rotation
      max_size: '100M',
      retain: 5,
      compress: true,
      
      // Monitoring
      monitoring: false, // Disable PM2+ monitoring (use external monitoring)
      pmx: false,
      
      // Process behavior
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Advanced settings
      node_args: [
        '--max-old-space-size=1024',
        '--optimize-for-size'
      ],
      
      // Health monitoring
      health_check_grace_period: 10000
    },
    
    /**
     * =====================
     * Worker Process
     * =====================
     */
    {
      name: 'mindscroll-worker',
      script: 'src/services/worker.js',
      cwd: '/app',
      
      // Process management (single instance for worker to avoid job conflicts)
      instances: 1,
      exec_mode: 'fork',
      
      // Performance settings
      max_memory_restart: maxMemoryRestart,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Auto-restart configuration
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      
      // Environment
      env: {
        NODE_ENV: nodeEnv,
        WORKER_MODE: 'true',
        WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY || 5,
        WORKER_MAX_JOBS: process.env.WORKER_MAX_JOBS || 100
      },
      
      // Development environment
      env_development: {
        NODE_ENV: 'development',
        WORKER_MODE: 'true'
      },
      
      // Production environment  
      env_production: {
        NODE_ENV: 'production',
        WORKER_MODE: 'true'
      },
      
      // Logging configuration
      log_type: 'json',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/app/logs/worker-error.log',
      out_file: '/app/logs/worker-out.log',
      log_file: '/app/logs/worker-combined.log',
      
      // Log rotation
      max_size: '100M',
      retain: 5,
      compress: true,
      
      // Monitoring
      monitoring: false,
      pmx: false,
      
      // Process behavior
      kill_timeout: 10000, // Workers need more time to finish jobs
      wait_ready: false,
      
      // Advanced settings
      node_args: [
        '--max-old-space-size=1024'
      ],
      
      // Cron restart (restart worker daily to prevent memory leaks)
      cron_restart: '0 2 * * *', // Restart at 2 AM daily
      
      // Health monitoring
      health_check_grace_period: 15000
    }
  ],
  
  /**
   * =====================
   * Deployment Configuration
   * =====================
   */
  deploy: {
    production: {
      user: 'mindscroll',
      host: ['your-production-server.com'],
      ref: 'origin/main',
      repo: 'https://github.com/your-username/mindscroll.git',
      path: '/var/www/mindscroll',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'ForwardAgent=yes'
    },
    
    staging: {
      user: 'mindscroll',
      host: ['your-staging-server.com'], 
      ref: 'origin/develop',
      repo: 'https://github.com/your-username/mindscroll.git',
      path: '/var/www/mindscroll-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
}

/**
 * ============================================================================
 * PM2 Commands for Reference:
 * 
 * Start all processes:
 *   pm2 start ecosystem.config.js
 * 
 * Start only API:
 *   pm2 start ecosystem.config.js --only mindscroll-api
 * 
 * Start only Worker:
 *   pm2 start ecosystem.config.js --only mindscroll-worker
 * 
 * Monitor processes:
 *   pm2 monit
 * 
 * View logs:
 *   pm2 logs
 *   pm2 logs mindscroll-api
 *   pm2 logs mindscroll-worker
 * 
 * Restart processes:
 *   pm2 restart all
 *   pm2 reload ecosystem.config.js
 * 
 * Stop processes:
 *   pm2 stop all
 *   pm2 delete all
 * 
 * Process information:
 *   pm2 list
 *   pm2 describe mindscroll-api
 * 
 * Performance monitoring:
 *   pm2 show mindscroll-api
 *   pm2 prettylist
 * 
 * In Docker (runtime):
 *   pm2-runtime start ecosystem.config.js
 * ============================================================================
 */