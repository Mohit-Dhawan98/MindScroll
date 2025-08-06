import { contentProcessingQueue, JOB_TYPES } from './queueService.js'
import { PrismaClient } from '@prisma/client'
import { UploadStatus } from '../utils/constants.js'
import { extractTextFromPDF } from '../processors/textExtractor.js'
import { EnhancedCardGenerator } from '../processors/enhancedCardGenerator.js'
import contentProcessor from '../services/contentProcessor.js'
import path from 'path'
import fs from 'fs/promises'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db'
    }
  },
  // Increase connection timeout for long-running operations
  __internal: {
    engine: {
      connectTimeout: 60000,
      requestTimeout: 120000
    }
  }
})

// Helper function to ensure Prisma connection
async function ensurePrismaConnection() {
  try {
    await prisma.$connect()
    // Test the connection with a simple query
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.warn('⚠️ Prisma connection issue, attempting reconnect:', error.message)
    try {
      await prisma.$disconnect()
      await prisma.$connect()
      return true
    } catch (reconnectError) {
      console.error('❌ Failed to reconnect to database:', reconnectError.message)
      return false
    }
  }
}

// Worker processor function
const processJob = async (job) => {
  const { uploadId, userId, filePath, url, mimeType, metadata } = job.data
  
  console.log(`🔄 Worker processing job ${job.id}:`, {
    jobType: job.name,
    uploadId,
    userId,
    metadata: metadata ? Object.keys(metadata) : 'none'
  })

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

    switch (job.name) {
      case JOB_TYPES.PROCESS_PDF_UPLOAD:
        return await processPdfUpload(job, uploadId, filePath, metadata)
      
      case JOB_TYPES.PROCESS_URL_UPLOAD:
        return await processUrlUpload(job, uploadId, url, metadata)
      
      case JOB_TYPES.PROCESS_TEXT_UPLOAD:
        return await processTextUpload(job, uploadId, filePath, metadata)
      
      default:
        throw new Error(`Unknown job type: ${job.name}`)
    }
  } catch (error) {
    console.error(`❌ Worker job ${job.id} failed:`, error)
    
    // Update upload status to failed
    await prisma.contentUpload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.FAILED,
        error: error.message
      }
    })
    
    throw error
  }
}

// PDF processing function - using the existing addBook script
async function processPdfUpload(job, uploadId, filePath, metadata = {}) {
  console.log(`📄 Processing PDF upload: ${uploadId}`)
  
  await job.progress(25)
  
  // Import the addBook function
  const { addBookToLibrary } = await import('../../scripts/library/addBook.js')
  
  await job.progress(50)
  
  // Use the existing addBook function with correct parameters
  const content = await addBookToLibrary(
    filePath,
    metadata.category || 'general', // category parameter
    'openai', // AI provider (default)
    true, // overwrite if exists
    'USER_UPLOADED', // source parameter
    metadata.title // custom title from upload
  )
  
  await job.progress(90)

  // Update upload status
  const updatedUpload = await prisma.contentUpload.update({
    where: { id: uploadId },
    data: {
      status: UploadStatus.COMPLETED,
      contentId: content.id
    }
  })
  
  console.log(`📋 Updated upload ${uploadId} to COMPLETED status with contentId: ${content.id}`)
  console.log(`📋 Upload record after update:`, { 
    id: updatedUpload.id, 
    status: updatedUpload.status, 
    contentId: updatedUpload.contentId 
  })

  await job.progress(100)

  console.log(`✅ PDF upload ${uploadId} processed successfully using addBook script`)
  return { contentId: content.id, cardsGenerated: content.totalCards }
}

// URL processing function
async function processUrlUpload(job, uploadId, url, metadata = {}) {
  console.log(`🌐 Processing URL upload: ${uploadId}`)
  
  await job.progress(25)
  
  const contentData = await contentProcessor.processURL(url)
  
  await job.progress(50)

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

  console.log(`✅ URL upload ${uploadId} processed successfully`)
  return { contentId: content.id, cardsGenerated: cards.length }
}

// Text processing function
async function processTextUpload(job, uploadId, filePath, metadata = {}) {
  console.log(`📝 Processing text upload: ${uploadId}`)
  
  await job.progress(25)
  
  // Read text file
  const text = await fs.readFile(filePath, 'utf-8')
  const contentData = { 
    text, 
    title: path.basename(filePath),
    pages: null,
    metadata: {}
  }

  await job.progress(50)

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

  console.log(`✅ Text upload ${uploadId} processed successfully`)
  return { contentId: content.id, cardsGenerated: cards.length }
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