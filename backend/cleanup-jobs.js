import Redis from 'ioredis'
import Queue from 'bull'

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
}

// Create queue
const contentProcessingQueue = new Queue('content processing', {
  redis: redisConfig
})

async function cleanupJobs() {
  try {
    console.log('🧹 Cleaning up failed jobs...')
    
    // Clean up failed jobs
    await contentProcessingQueue.clean(0, 'failed')
    
    // Clean up completed jobs
    await contentProcessingQueue.clean(0, 'completed')
    
    // Clean up active jobs (in case they're stuck)
    await contentProcessingQueue.clean(0, 'active')
    
    // Get and remove waiting jobs manually
    const waitingJobs = await contentProcessingQueue.getWaiting()
    for (const job of waitingJobs) {
      await job.remove()
    }
    
    console.log('✅ All jobs cleaned up')
    
    await contentProcessingQueue.close()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error cleaning up jobs:', error)
    process.exit(1)
  }
}

cleanupJobs()