import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupDatabase() {
  try {
    console.log('🧹 Cleaning up interrupted uploads and orphaned content...')
    
    // Find uploads that are still processing or failed
    const problemUploads = await prisma.contentUpload.findMany({
      where: {
        OR: [
          { status: 'PROCESSING' },
          { status: 'FAILED' }
        ]
      },
      include: {
        jobs: true,
        content: true
      }
    })
    
    console.log(`Found ${problemUploads.length} problematic uploads`)
    
    for (const upload of problemUploads) {
      console.log(`Cleaning upload: ${upload.id} - ${upload.originalName}`)
      
      // If there's associated content, clean it up too
      if (upload.content) {
        console.log(`  Found associated content: ${upload.content.title}`)
        
        // Delete user progress first (references cards)
        const deletedProgress = await prisma.userProgress.deleteMany({
          where: { card: { contentId: upload.content.id } }
        })
        console.log(`  Deleted ${deletedProgress.count} progress records`)
        
        // Delete chapter progress
        const deletedChapterProgress = await prisma.chapterProgress.deleteMany({
          where: { chapter: { contentId: upload.content.id } }
        })
        console.log(`  Deleted ${deletedChapterProgress.count} chapter progress records`)
        
        // Delete chapters
        const deletedChapters = await prisma.chapter.deleteMany({
          where: { contentId: upload.content.id }
        })
        console.log(`  Deleted ${deletedChapters.count} chapters`)
        
        // Delete cards
        const deletedCards = await prisma.card.deleteMany({
          where: { contentId: upload.content.id }
        })
        console.log(`  Deleted ${deletedCards.count} cards`)
        
        // Delete the content
        await prisma.content.delete({
          where: { id: upload.content.id }
        })
        console.log(`  ✅ Deleted content: ${upload.content.title}`)
      }
      
      // Delete associated jobs
      const deletedJobs = await prisma.processingJob.deleteMany({
        where: { uploadId: upload.id }
      })
      console.log(`  Deleted ${deletedJobs.count} jobs`)
      
      // Delete the upload
      await prisma.contentUpload.delete({
        where: { id: upload.id }
      })
      
      console.log(`✅ Cleaned upload: ${upload.originalName}`)
    }
    
    // Also clean up any orphaned content (USER_UPLOADED source with no cards, no chapters, or from failed uploads)
    console.log('\n🔍 Looking for orphaned user-uploaded content...')
    const orphanedContent = await prisma.content.findMany({
      where: {
        source: 'USER_UPLOADED',
        OR: [
          {
            cards: {
              none: {}
            }
          },
          {
            chapters: {
              none: {}
            }
          },
          {
            uploads: {
              every: {
                OR: [
                  { status: 'FAILED' },
                  { status: 'PROCESSING' }
                ]
              }
            }
          }
        ]
      }
    })
    
    console.log(`Found ${orphanedContent.length} orphaned content records`)
    
    for (const content of orphanedContent) {
      console.log(`Cleaning orphaned content: ${content.id} - ${content.title}`)
      
      // Delete any related user progress first
      const deletedProgress = await prisma.userProgress.deleteMany({
        where: { 
          card: { 
            contentId: content.id 
          } 
        }
      })
      console.log(`  Deleted ${deletedProgress.count} progress records`)
      
      // Delete chapter progress
      const deletedChapterProgress = await prisma.chapterProgress.deleteMany({
        where: { chapter: { contentId: content.id } }
      })
      console.log(`  Deleted ${deletedChapterProgress.count} chapter progress records`)
      
      // Delete chapters
      const deletedChapters = await prisma.chapter.deleteMany({
        where: { contentId: content.id }
      })
      console.log(`  Deleted ${deletedChapters.count} chapters`)
      
      // Delete cards
      const deletedCards = await prisma.card.deleteMany({
        where: { contentId: content.id }
      })
      console.log(`  Deleted ${deletedCards.count} cards`)
      
      // Delete the orphaned content
      await prisma.content.delete({
        where: { id: content.id }
      })
      
      console.log(`✅ Cleaned orphaned content: ${content.title}`)
    }
    
    // Clean up any orphaned processing jobs (jobs whose uploadIds don't exist in content_uploads)
    console.log('\n🔍 Looking for orphaned processing jobs...')
    
    // Get all existing upload IDs
    const existingUploads = await prisma.contentUpload.findMany({
      select: { id: true }
    })
    const existingUploadIds = new Set(existingUploads.map(u => u.id))
    
    // Get all processing jobs
    const allJobs = await prisma.processingJob.findMany()
    
    // Find orphaned jobs (jobs referencing non-existent uploads)
    const orphanedJobs = allJobs.filter(job => !existingUploadIds.has(job.uploadId))
    
    if (orphanedJobs.length > 0) {
      console.log(`Found ${orphanedJobs.length} orphaned processing jobs`)
      const deletedOrphanedJobs = await prisma.processingJob.deleteMany({
        where: {
          id: {
            in: orphanedJobs.map(job => job.id)
          }
        }
      })
      console.log(`Deleted ${deletedOrphanedJobs.count} orphaned processing jobs`)
    } else {
      console.log('No orphaned processing jobs found')
    }
    
    console.log('\n✅ Database cleanup completed')
    console.log('💡 Note: You may also want to clear Redis queue data with: redis-cli FLUSHDB')
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error cleaning database:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

cleanupDatabase()