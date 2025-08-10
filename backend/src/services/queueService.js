import Queue from 'bull'
import Redis from 'ioredis'

// queueService is pure queue management - no database operations

// Redis configuration - parse REDIS_URL if available
let redisConfig = {
  host: 'localhost',
  port: 6379,
  password: undefined,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
}

// Parse REDIS_URL if provided (format: redis://[password@]host:port)
if (process.env.REDIS_URL) {
  try {
    const url = new URL(process.env.REDIS_URL)
    redisConfig.host = url.hostname
    redisConfig.port = parseInt(url.port) || 6379
    if (url.password) {
      redisConfig.password = url.password
    }
  } catch (error) {
    console.error('❌ Failed to parse REDIS_URL:', error.message)
  }
} else {
  // Fallback to individual env vars
  redisConfig.host = process.env.REDIS_HOST || 'localhost'
  redisConfig.port = process.env.REDIS_PORT || 6379
  redisConfig.password = process.env.REDIS_PASSWORD || undefined
}

console.log('🔧 Redis Configuration:', {
  host: redisConfig.host,
  port: redisConfig.port,
  hasPassword: !!redisConfig.password
})

// Create Redis connection for Bull
export const redis = new Redis(redisConfig)

// Content processing queue
export const contentProcessingQueue = new Queue('content processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 10, // Keep last 10 completed jobs
    removeOnFail: 50,     // Keep last 50 failed jobs for debugging
    attempts: 3,          // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000,        // Start with 5 second delay
    },
  },
})

// Job types
export const JOB_TYPES = {
  PROCESS_PDF_UPLOAD: 'process-pdf-upload',
  PROCESS_URL_UPLOAD: 'process-url-upload',
  PROCESS_TEXT_UPLOAD: 'process-text-upload',
  GENERATE_CARDS: 'generate-cards',
  PROCESS_CONTENT: 'process-content'
}

// Job status enum
export const JOB_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  PAUSED: 'paused'
}

// Add job to queue (pure queue management, no database operations)
export const addJob = async (jobType, data, options = {}) => {
  try {
    console.log(`📋 Adding job to queue: ${jobType}`, {
      uploadId: data.uploadId,
      userId: data.userId,
      type: data.type
    })

    const job = await contentProcessingQueue.add(jobType, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    })

    console.log(`✅ Job added successfully: ${job.id}`)
    return job
  } catch (error) {
    console.error('❌ Failed to add job to queue:', error)
    throw error
  }
}

// Get job status
export const getJobStatus = async (jobId) => {
  try {
    const job = await contentProcessingQueue.getJob(jobId)
    if (!job) {
      return null
    }

    const state = await job.getState()
    const progress = job.progress()
    const failedReason = job.failedReason

    return {
      id: job.id,
      status: state,
      progress,
      data: job.data,
      failedReason,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null
    }
  } catch (error) {
    console.error('❌ Failed to get job status:', error)
    throw error
  }
}

// Get all jobs for a user upload
export const getJobsByUploadId = async (uploadId) => {
  try {
    // Get all jobs from different states
    const [waiting, active, completed, failed] = await Promise.all([
      contentProcessingQueue.getWaiting(),
      contentProcessingQueue.getActive(),
      contentProcessingQueue.getCompleted(),
      contentProcessingQueue.getFailed()
    ])

    const allJobs = [...waiting, ...active, ...completed, ...failed]
    const uploadJobs = allJobs.filter(job => job.data.uploadId === uploadId)

    return Promise.all(uploadJobs.map(async (job) => {
      const state = await job.getState()
      return {
        id: job.id,
        status: state,
        progress: job.progress(),
        data: job.data,
        failedReason: job.failedReason,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null
      }
    }))
  } catch (error) {
    console.error('❌ Failed to get jobs by upload ID:', error)
    throw error
  }
}

// Clean old jobs
export const cleanOldJobs = async () => {
  try {
    await contentProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed') // Remove completed jobs older than 24 hours
    await contentProcessingQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed') // Remove failed jobs older than 7 days
    console.log('🧹 Old jobs cleaned successfully')
  } catch (error) {
    console.error('❌ Failed to clean old jobs:', error)
  }
}

// Queue event handlers
contentProcessingQueue.on('ready', () => {
  console.log('🚀 Content processing queue is ready')
})

contentProcessingQueue.on('error', (error) => {
  console.error('❌ Queue error:', error)
})

contentProcessingQueue.on('waiting', async (jobId) => {
  console.log(`⏳ Job ${jobId} is waiting`)
})

// Simple event logging - database updates handled by worker
contentProcessingQueue.on('active', async (job) => {
  console.log(`🔄 Job ${job.id} started processing: ${job.data.type}`)
})

contentProcessingQueue.on('completed', async (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully`)
})

contentProcessingQueue.on('failed', async (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message)
})

contentProcessingQueue.on('progress', async (job, progress) => {
  console.log(`📊 Job ${job.id} progress: ${progress}%`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down queue service...')
  await contentProcessingQueue.close()
  redis.disconnect()
})

export default {
  contentProcessingQueue,
  addJob,
  getJobStatus, 
  getJobsByUploadId,
  cleanOldJobs,
  JOB_TYPES,
  JOB_STATUS
}