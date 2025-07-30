import ContentProcessor from './contentProcessor.js'

let processor = null

export async function startContentProcessor() {
  if (processor) {
    console.log('⚠️  Content processor already running')
    return processor
  }
  
  processor = new ContentProcessor()
  await processor.start()
  return processor
}

export async function stopContentProcessor() {
  if (processor) {
    await processor.stop()
    processor = null
  }
}

export async function getProcessorStats() {
  if (!processor) {
    return { error: 'Content processor not running' }
  }
  
  return await processor.getProcessingStats()
}

// Initialize processor if NODE_ENV is not test
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down content processor...')
    await stopContentProcessor()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down content processor...')
    await stopContentProcessor()
    process.exit(0)
  })
}