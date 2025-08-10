import { contentProcessingQueue, JOB_TYPES } from './queueService.js'
import { PrismaClient } from '@prisma/client'
import { UploadStatus } from '../utils/constants.js'
import { extractTextFromPDF } from '../processors/textExtractor.js'
import { EnhancedCardGenerator } from '../processors/enhancedCardGenerator.js'
import contentProcessor from '../services/contentProcessor.js'
import r2Storage from '../utils/r2StreamingStorage.js'
import path from 'path'
import fs from 'fs/promises'

// Use transaction pooler for worker (stateless, quick DB operations)
const databaseUrl = process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL
console.log(`🔗 Worker using: ${databaseUrl.includes(':6543') ? 'Transaction Pooler' : 'Session Pooler'}`)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
})

// Helper functions to update job status in database
async function updateJobStatus(jobId, status, data = {}) {
  try {
    console.log(`📊 Worker updating job ${jobId} status to ${status}`)
    const result = await prisma.processingJob.updateMany({
      where: { queueJobId: jobId.toString() },
      data: { 
        status,
        ...data
      }
    })
    console.log(`✅ Worker updated ${result.count} job records (jobId: ${jobId}) to status ${status}`)
  } catch (error) {
    console.error(`❌ Worker failed to update job ${jobId} status:`, error.message)
    console.error(`❌ Worker status update error details:`, {
      jobId,
      status,
      data,
      error: error.message
    })
  }
}

async function updateJobProgress(jobId, progress) {
  try {
    console.log(`📈 Worker updating job ${jobId} progress to ${progress}%`)
    const result = await prisma.processingJob.updateMany({
      where: { queueJobId: jobId.toString() },
      data: { progress }
    })
    console.log(`✅ Worker updated ${result.count} job records (jobId: ${jobId}) progress to ${progress}%`)
  } catch (error) {
    console.error(`❌ Worker failed to update job ${jobId} progress:`, error.message)
  }
}


// Helper function to stream from R2 and create temp file for processing
async function streamFromR2ToTemp(r2Key) {
  console.log(`🌊 Streaming from R2: ${r2Key}`)
  console.log(`📁 Current working directory: ${process.cwd()}`)
  
  try {
    // Stream from R2
    const stream = await r2Storage.streamDownload(r2Key)
    
    // Create temp file with absolute path for Docker
    const uploadsDir = path.resolve('./uploads')
    const tempPath = path.join(uploadsDir, `temp-${Date.now()}-${path.basename(r2Key)}`)
    
    console.log(`📁 Uploads directory: ${uploadsDir}`)
    console.log(`📁 Temp file path: ${tempPath}`)
    
    // Ensure uploads directory exists
    await fs.mkdir(uploadsDir, { recursive: true })
    
    // Stream to temp file
    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    
    await fs.writeFile(tempPath, buffer)
    
    console.log(`📁 Created temp file from R2 stream: ${tempPath} (${buffer.length} bytes)`)
    return { 
      tempPath, 
      cleanup: async () => {
        try {
          await fs.unlink(tempPath)
          console.log(`🗑️ Cleaned up temp file: ${tempPath}`)
        } catch (error) {
          console.warn(`⚠️ Could not delete temp file ${tempPath}:`, error.message)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to stream from R2:', error.message)
    console.error('❌ Error stack:', error.stack)
    throw new Error(`Failed to stream from R2: ${error.message}`)
  }
}

// Worker processor function
const processJob = async (job) => {
  const { uploadId, userId, r2Key, url, mimeType, metadata } = job.data
  
  console.log(`🔄 Worker processing job ${job.id}:`, {
    jobType: job.name,
    uploadId,
    userId,
    metadata: metadata ? Object.keys(metadata) : 'none'
  })

  // Check if this job is already being processed by another worker
  const currentJob = await prisma.processingJob.findFirst({
    where: { queueJobId: job.id.toString() }
  })
  
  if (currentJob && currentJob.status === 'active') {
    console.log(`⚠️ Job ${job.id} is already being processed (status: ${currentJob.status}), skipping duplicate`)
    return { 
      contentId: null, 
      cardsGenerated: 0,
      skipped: true,
      reason: 'Already being processed by another worker'
    }
  }

  // Update job status to active
  await updateJobStatus(job.id, 'active', { startedAt: new Date() })

  try {
    // Check if this upload has already been processed (has content with cards)
    const existingUpload = await prisma.contentUpload.findUnique({
      where: { id: uploadId },
      include: {
        content: {
          include: {
            _count: {
              select: { cards: true }
            }
          }
        }
      }
    })

    if (existingUpload?.content && existingUpload.content._count.cards > 0) {
      console.log(`⚠️ Upload ${uploadId} already processed with ${existingUpload.content._count.cards} cards, skipping`)
      return { 
        contentId: existingUpload.content.id, 
        cardsGenerated: existingUpload.content._count.cards,
        skipped: true 
      }
    }

    // Update job progress
    await job.progress(10)
    await updateJobProgress(job.id, 10)

    switch (job.name) {
      case JOB_TYPES.PROCESS_PDF_UPLOAD:
        const result = await processPdfUpload(job, uploadId, r2Key, metadata)
        await updateJobStatus(job.id, 'completed', { 
          completedAt: new Date(),
          result: JSON.stringify(result)
        })
        return result
      
      case JOB_TYPES.PROCESS_URL_UPLOAD:
        const urlResult = await processUrlUpload(job, uploadId, url, metadata)
        await updateJobStatus(job.id, 'completed', { 
          completedAt: new Date(),
          result: JSON.stringify(urlResult)
        })
        return urlResult
      
      case JOB_TYPES.PROCESS_TEXT_UPLOAD:
        const textResult = await processTextUpload(job, uploadId, r2Key, metadata)
        await updateJobStatus(job.id, 'completed', { 
          completedAt: new Date(),
          result: JSON.stringify(textResult)
        })
        return textResult
      
      default:
        throw new Error(`Unknown job type: ${job.name}`)
    }
  } catch (error) {
    console.error(`❌ Worker job ${job.id} failed:`, error)
    
    // Clean up R2 file on failure
    if (r2Key) {
      try {
        await r2Storage.delete(r2Key)
        console.log(`🗑️ Cleaned up failed R2 upload file: ${r2Key}`)
      } catch (cleanupError) {
        console.warn(`⚠️ Could not delete failed R2 upload file ${r2Key}:`, cleanupError.message)
      }
    }
    
    // Update upload status to failed
    await prisma.contentUpload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.FAILED,
        error: error.message
      }
    })
    
    // Update job status to failed
    await updateJobStatus(job.id, 'failed', {
      error: error.message,
      completedAt: new Date()
    })
    
    throw error
  }
}

// PDF processing function - simple R2 streaming approach
async function processPdfUpload(job, uploadId, r2Key, metadata = {}) {
  console.log(`📄 Processing PDF upload: ${uploadId} from R2: ${r2Key}`)
  
  await job.progress(25)
  await updateJobProgress(job.id, 25)
  
  let fileHandler = null
  try {
    // Stream from R2 to temp file
    fileHandler = await streamFromR2ToTemp(r2Key)
    
    await job.progress(30)
    await updateJobProgress(job.id, 30)
    
    // Import the addBook function
    const { addBookToLibrary } = await import('../../scripts/library/addBook.js')
    
    await job.progress(50)
    await updateJobProgress(job.id, 50)
    
    // Use the existing addBook function with temp file
    const content = await addBookToLibrary(
      fileHandler.tempPath,
      metadata.category || 'general',
      'openai',
      true,
      'USER_UPLOADED',
      metadata.title
    )
    
    await job.progress(90)
    await updateJobProgress(job.id, 90)

    // Update upload status
    const updatedUpload = await prisma.contentUpload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.COMPLETED,
        contentId: content.id
      }
    })
    
    console.log(`📋 Updated upload ${uploadId} to COMPLETED status with contentId: ${content.id}`)

    await job.progress(100)
    await updateJobProgress(job.id, 100)

    console.log(`✅ PDF upload ${uploadId} processed successfully`)
    return { contentId: content.id, cardsGenerated: content.totalCards }
    
  } finally {
    // Cleanup temp file
    if (fileHandler) {
      await fileHandler.cleanup()
    }
    
    // Delete from R2
    try {
      await r2Storage.delete(r2Key)
      console.log(`☁️ Deleted R2 file: ${r2Key}`)
    } catch (r2Error) {
      console.warn(`⚠️ Could not delete R2 file ${r2Key}:`, r2Error.message)
    }
  }
}

// URL processing function
async function processUrlUpload(job, uploadId, url, metadata = {}) {
  console.log(`🌐 Processing URL upload: ${uploadId}`)
  
  await job.progress(25)
  await updateJobProgress(job.id, 25)
  
  const contentData = await contentProcessor.processURL(url)
  
  await job.progress(50)
  await updateJobProgress(job.id, 50)

  // Ensure database connection before creating content
  const connectionOkForContent = await ensurePrismaConnection()
  if (!connectionOkForContent) {
    throw new Error('Failed to establish database connection for content creation')
  }

  // Create content record
  const content = await prisma.content.create({
    data: {
      title: metadata.title || contentData.title,
      description: metadata.customInstructions || contentData.description,
      type: 'BOOK',
      source: 'USER_UPLOADED',
      sourceUrl: url,
      difficulty: metadata.difficulty || 'medium',
      category: metadata.category || 'general',
      tags: JSON.stringify([metadata.category || 'general']),
      isAiGenerated: true,
      sourceType: 'webpage',
      author: 'Web Content',
      estimatedTime: Math.ceil((contentData.text?.length || 0) / 200) || 30
    }
  })

  await job.progress(75)
  await updateJobProgress(job.id, 75)

  // Generate cards
  const cardGenerator = new EnhancedCardGenerator()
  const textContent = {
    text: contentData.text,
    pages: [],
    metadata: { title: contentData.title, description: contentData.description }
  }
  
  const generationResult = await cardGenerator.generateEnhancedLearningCards(
    textContent, 
    metadata.title || contentData.title,
    'Web Content',
    metadata.category || 'general',
    content.id
  )

  // Extract cards from the result object (newer format) or use directly (legacy format)
  const cards = generationResult.cards || generationResult

  if (!Array.isArray(cards)) {
    throw new Error(`Card generation returned invalid format: ${typeof cards}`)
  }

  console.log(`📊 Generated ${cards.length} cards (leveraging cache if available)`)
  console.log(`📝 Generation result structure:`, {
    hasCards: !!generationResult.cards,
    hasChapters: !!generationResult.chapters,
    hasChunkMapping: !!generationResult.chunkMapping,
    cardCount: cards.length,
    chapterCount: generationResult.chapters ? generationResult.chapters.length : 0
  })

  // Ensure database connection before saving cards
  const connectionOkForCards = await ensurePrismaConnection()
  if (!connectionOkForCards) {
    throw new Error('Failed to establish database connection for card saving')
  }

  // Save cards to database
  console.log(`💾 Saving ${cards.length} cards to database...`)
  const cardData = cards.map((card, index) => ({
    contentId: content.id,
    type: card.type || 'SUMMARY',
    title: card.title,
    order: index + 1,
    ...(card.quiz && { quiz: JSON.stringify(card.quiz) }),
    ...(card.front && { front: card.front }),
    ...(card.back && { back: card.back })
  }))
  
  await prisma.card.createMany({ data: cardData })

  // Update content totalCards count
  await prisma.content.update({
    where: { id: content.id },
    data: { totalCards: cards.length }
  })

  await job.progress(90)
  await updateJobProgress(job.id, 90)

  // Note: Auto-enrollment not needed - users automatically get access to their uploaded content

  // Update upload status
  await prisma.contentUpload.update({
    where: { id: uploadId },
    data: {
      status: UploadStatus.COMPLETED,
      contentId: content.id
    }
  })

  await job.progress(100)
  await updateJobProgress(job.id, 100)

  console.log(`✅ URL upload ${uploadId} processed successfully`)
  return { contentId: content.id, cardsGenerated: cards.length }
}

// Text processing function
async function processTextUpload(job, uploadId, filePath, metadata = {}, isR2 = false) {
  console.log(`📝 Processing text upload: ${uploadId} (${isR2 ? 'R2' : 'Local'} storage)`)
  
  await job.progress(25)
  await updateJobProgress(job.id, 25)
  
  let fileHandler = null
  let text
  
  try {
    // Get file for processing (downloads from R2 if needed)
    fileHandler = await getFileForProcessing(filePath, isR2)
    
    // Read text file
    text = await fs.readFile(fileHandler.tempPath, 'utf-8')
  const contentData = { 
    text, 
    title: path.basename(filePath),
    pages: null,
    metadata: {}
  }

  await job.progress(50)
  await updateJobProgress(job.id, 50)

  // Ensure database connection before creating content
  const connectionOkForContent = await ensurePrismaConnection()
  if (!connectionOkForContent) {
    throw new Error('Failed to establish database connection for content creation')
  }

  // Create content record
  const content = await prisma.content.create({
    data: {
      title: metadata.title || contentData.title || 'Uploaded Content',
      description: metadata.customInstructions || `Uploaded file: ${path.basename(filePath)}`,
      type: 'BOOK',
      source: 'USER_UPLOADED',
      difficulty: metadata.difficulty || 'medium',
      category: metadata.category || 'general',
      tags: JSON.stringify([metadata.category || 'general']),
      isAiGenerated: true,
      sourceType: 'text/plain',
      author: 'User Upload',
      estimatedTime: Math.ceil((contentData.text?.length || 0) / 200) || 30
    }
  })

  await job.progress(75)
  await updateJobProgress(job.id, 75)

  // Generate cards
  const cardGenerator = new EnhancedCardGenerator()
  const textContent = {
    text: contentData.text,
    pages: [],
    metadata: {}
  }
  
  const generationResult = await cardGenerator.generateEnhancedLearningCards(
    textContent, 
    metadata.title || contentData.title,
    'User Upload',
    metadata.category || 'general',
    content.id
  )

  // Extract cards from the result object (newer format) or use directly (legacy format)
  const cards = generationResult.cards || generationResult

  if (!Array.isArray(cards)) {
    throw new Error(`Card generation returned invalid format: ${typeof cards}`)
  }

  console.log(`📊 Generated ${cards.length} cards (leveraging cache if available)`)
  console.log(`📝 Generation result structure:`, {
    hasCards: !!generationResult.cards,
    hasChapters: !!generationResult.chapters,
    hasChunkMapping: !!generationResult.chunkMapping,
    cardCount: cards.length,
    chapterCount: generationResult.chapters ? generationResult.chapters.length : 0
  })

  // Ensure database connection before saving cards
  const connectionOkForSaving = await ensurePrismaConnection()
  if (!connectionOkForSaving) {
    throw new Error('Failed to establish database connection for card saving')
  }

  // Save cards to database in batches to avoid timeouts
  console.log(`💾 Saving ${cards.length} cards to database...`)
  const batchSize = 10
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize)
    const cardData = batch.map((card, index) => ({
      contentId: content.id,
      type: card.type || 'SUMMARY',
      title: card.title,
      front: card.front || null,
      back: card.back || null,
      quiz: card.quiz ? JSON.stringify(card.quiz) : null,
      order: card.order || (i + index + 1)
    }))
    
    await prisma.card.createMany({ data: cardData })
    console.log(`💾 Saved batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cards.length/batchSize)}`)
  }

  // Create chapters if they were detected
  if (generationResult.chapters && Array.isArray(generationResult.chapters)) {
    console.log(`📚 Creating ${generationResult.chapters.length} chapters...`)
    for (let i = 0; i < generationResult.chapters.length; i++) {
      const chapter = generationResult.chapters[i]
      try {
        await prisma.chapter.create({
          data: {
            contentId: content.id,
            chapterNumber: i + 1,
            chapterTitle: chapter.title || chapter.name || `Chapter ${i + 1}`,
            sourceChunks: JSON.stringify([]) // Empty for now, could be populated later
          }
        })
      } catch (chapterError) {
        console.error(`Failed to create chapter ${i + 1}:`, chapterError)
        // Continue with other chapters
      }
    }
  } else {
    console.log(`⚠️ No chapters detected in generation result`);
  }

  // Update content totalCards count
  await prisma.content.update({
    where: { id: content.id },
    data: { totalCards: cards.length }
  })

  await job.progress(90)
  await updateJobProgress(job.id, 90)

  // Note: Auto-enrollment not needed - users automatically get access to their uploaded content

  // Update upload status
  await prisma.contentUpload.update({
    where: { id: uploadId },
    data: {
      status: UploadStatus.COMPLETED,
      contentId: content.id
    }
  })

  await job.progress(100)
  await updateJobProgress(job.id, 100)

  console.log(`✅ Text upload ${uploadId} processed successfully`)
  return { contentId: content.id, cardsGenerated: cards.length }
  
  } finally {
    // Always cleanup - handles both temp files and R2 deletion
    if (fileHandler) {
      // Clean up temporary local file
      await fileHandler.cleanup()
    }
    
    // If using R2, delete the original file from R2
    if (isR2) {
      try {
        await r2Storage.deleteTempFile(filePath)
        console.log(`☁️ Deleted R2 temp file: ${filePath}`)
      } catch (r2Error) {
        console.warn(`⚠️ Could not delete R2 file ${filePath}:`, r2Error.message)
      }
    } else {
      // Clean up local file
      try {
        if (filePath && await fs.access(filePath).then(() => true).catch(() => false)) {
          await fs.unlink(filePath)
          console.log(`🗑️ Cleaned up local file: ${filePath}`)
        }
      } catch (error) {
        console.warn(`⚠️ Could not delete local file ${filePath}:`, error.message)
      }
    }
  }
}

// Debug environment variables
console.log('🔧 Worker Environment Check:')
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`)
console.log(`   WORKER_DATABASE_URL: ${process.env.WORKER_DATABASE_URL ? 'SET' : 'NOT SET'}`)
console.log(`   REDIS_URL: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`)
console.log(`   CLOUDFLARE_R2_ENDPOINT: ${process.env.CLOUDFLARE_R2_ENDPOINT ? 'SET' : 'NOT SET'}`)
console.log(`   CLOUDFLARE_R2_BUCKET_NAME: ${process.env.CLOUDFLARE_R2_BUCKET_NAME ? 'SET' : 'NOT SET'}`)
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`)
console.log(`   Working Directory: ${process.cwd()}`)

// Test R2 connection
console.log('☁️ Testing R2 connection...')
try {
  const r2Test = await r2Storage.testConnection()
  if (r2Test.success) {
    console.log('✅ R2 connection successful')
  } else {
    console.error('❌ R2 connection failed:', r2Test.error)
  }
} catch (error) {
  console.error('❌ R2 test error:', error.message)
}

// Test database connection on startup
console.log('🔗 Testing database connection...')
try {
  await prisma.$queryRaw`SELECT 1`
  console.log('✅ Database connection successful')
} catch (error) {
  console.error('❌ Database connection failed:', error.message)
}

// Clean up old/stalled jobs on startup
console.log('🧹 Cleaning up old jobs...')
try {
  // Clean stalled jobs
  const stalledJobs = await contentProcessingQueue.getJobs(['stalled'], 0, 100)
  for (const job of stalledJobs) {
    console.log(`🗑️ Cleaning stalled job ${job.id}`)
    await job.remove()
  }

  // Clean old failed jobs
  const failedJobs = await contentProcessingQueue.getJobs(['failed'], 0, 50)
  for (const job of failedJobs) {
    console.log(`🗑️ Cleaning failed job ${job.id}`)
    await job.remove()
  }

  // Clean old completed jobs (keep last 5)
  const completedJobs = await contentProcessingQueue.getJobs(['completed'], 5, 100)
  for (const job of completedJobs) {
    console.log(`🗑️ Cleaning old completed job ${job.id}`)
    await job.remove()
  }

  console.log('✅ Old jobs cleanup completed')
} catch (error) {
  console.warn('⚠️ Job cleanup failed (continuing anyway):', error.message)
}

// Register job processors for each job type
console.log('🔧 Registering job processors for:', Object.values(JOB_TYPES))

contentProcessingQueue.process(JOB_TYPES.PROCESS_PDF_UPLOAD, 2, processJob)
contentProcessingQueue.process(JOB_TYPES.PROCESS_URL_UPLOAD, 2, processJob)  
contentProcessingQueue.process(JOB_TYPES.PROCESS_TEXT_UPLOAD, 2, processJob)

console.log('🚀 Content processing worker started with job types:')
console.log(`  - ${JOB_TYPES.PROCESS_PDF_UPLOAD}`)
console.log(`  - ${JOB_TYPES.PROCESS_URL_UPLOAD}`)
console.log(`  - ${JOB_TYPES.PROCESS_TEXT_UPLOAD}`)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down worker...')
  await contentProcessingQueue.close()
  await prisma.$disconnect()
})

export default {
  processJob,
  processPdfUpload,
  processUrlUpload,
  processTextUpload
}