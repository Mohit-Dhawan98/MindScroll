#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanUserProgress() {
  try {
    console.log('🧹 Starting user progress cleanup...')
    
    // Count existing records before deletion
    const userProgressCount = await prisma.userProgress.count()
    const chapterProgressCount = await prisma.chapterProgress.count()
    
    console.log(`📊 Found ${userProgressCount} UserProgress records`)
    console.log(`📊 Found ${chapterProgressCount} ChapterProgress records`)
    
    // Delete all user progress (keeps cards and content intact)
    console.log('🗑️ Deleting UserProgress records...')
    const deletedUserProgress = await prisma.userProgress.deleteMany({})
    console.log(`✅ Deleted ${deletedUserProgress.count} UserProgress records`)
    
    // Delete all chapter progress
    console.log('🗑️ Deleting ChapterProgress records...')
    const deletedChapterProgress = await prisma.chapterProgress.deleteMany({})
    console.log(`✅ Deleted ${deletedChapterProgress.count} ChapterProgress records`)
    
    // Reset user XP and stats (optional - keeps login intact)
    console.log('🔄 Resetting user learning stats...')
    const updatedUsers = await prisma.user.updateMany({
      data: {
        xp: 0,
        level: 1,
        streak: 0
      }
    })
    console.log(`✅ Reset stats for ${updatedUsers.count} users`)
    
    console.log('🎉 User progress cleanup complete!')
    console.log('📚 Content, cards, and chapters remain intact')
    console.log('🔐 User accounts and enrollments preserved')
    
  } catch (error) {
    console.error('❌ Error cleaning user progress:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanUserProgress()