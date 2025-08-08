import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupDuplicateJobs() {
  try {
    console.log('🧹 Checking for duplicate processing jobs...')
    
    // Find all processing jobs
    const allJobs = await prisma.processingJob.findMany({
      orderBy: { createdAt: 'asc' }
    })
    
    console.log(`Found ${allJobs.length} total processing jobs`)
    
    // Group by queueJobId to find duplicates
    const jobsByQueueId = {}
    for (const job of allJobs) {
      if (!jobsByQueueId[job.queueJobId]) {
        jobsByQueueId[job.queueJobId] = []
      }
      jobsByQueueId[job.queueJobId].push(job)
    }
    
    // Find and remove duplicates (keep the oldest one)
    let duplicatesRemoved = 0
    for (const [queueJobId, jobs] of Object.entries(jobsByQueueId)) {
      if (jobs.length > 1) {
        console.log(`⚠️ Found ${jobs.length} jobs with queueJobId: ${queueJobId}`)
        
        // Keep the first (oldest) job, delete the rest
        const [keepJob, ...deleteJobs] = jobs
        console.log(`  Keeping job: ${keepJob.id} (created: ${keepJob.createdAt})`)
        
        for (const job of deleteJobs) {
          console.log(`  Deleting duplicate: ${job.id} (created: ${job.createdAt})`)
          await prisma.processingJob.delete({
            where: { id: job.id }
          })
          duplicatesRemoved++
        }
      }
    }
    
    if (duplicatesRemoved > 0) {
      console.log(`✅ Removed ${duplicatesRemoved} duplicate jobs`)
    } else {
      console.log('✅ No duplicate jobs found')
    }
    
    // Also clean up orphaned jobs (jobs without corresponding uploads)
    const orphanedJobs = await prisma.processingJob.findMany({
      include: {
        upload: true
      }
    })
    
    const actualOrphanedJobs = orphanedJobs.filter(job => !job.upload)
    
    if (actualOrphanedJobs.length > 0) {
      console.log(`🧹 Found ${actualOrphanedJobs.length} orphaned jobs`)
      for (const job of actualOrphanedJobs) {
        await prisma.processingJob.delete({
          where: { id: job.id }
        })
      }
      console.log(`✅ Removed ${actualOrphanedJobs.length} orphaned jobs`)
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up jobs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupDuplicateJobs()