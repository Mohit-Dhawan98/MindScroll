#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeUserUploads() {
  try {
    console.log('🗑️ Removing all user-uploaded content...')

    // Find all user-uploaded content
    const userContent = await prisma.content.findMany({
      where: { source: 'USER_UPLOADED' },
      include: {
        cards: true,
        chapters: true,
        uploads: true
      }
    })

    console.log(`📋 Found ${userContent.length} user-uploaded books to remove`)

    for (const content of userContent) {
      console.log(`🗑️ Removing "${content.title}" by ${content.author}`)
      
      // Delete user progress for cards in this content
      await prisma.userProgress.deleteMany({
        where: { cardId: { in: content.cards.map(c => c.id) } }
      })
      
      // Delete chapter progress
      await prisma.chapterProgress.deleteMany({
        where: { chapterId: { in: content.chapters.map(c => c.id) } }
      })
      
      // Delete cards
      await prisma.card.deleteMany({
        where: { contentId: content.id }
      })
      
      // Delete chapters
      await prisma.chapter.deleteMany({
        where: { contentId: content.id }
      })
      
      // Delete uploads
      await prisma.contentUpload.deleteMany({
        where: { contentId: content.id }
      })
      
      // Delete content
      await prisma.content.delete({
        where: { id: content.id }
      })
      
      console.log(`✅ Removed "${content.title}"`)
    }

    // Also clean up any orphaned uploads
    await prisma.contentUpload.deleteMany({
      where: { contentId: null }
    })

    console.log('✅ All user-uploaded content removed successfully')
    
  } catch (error) {
    console.error('❌ Error removing user uploads:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

removeUserUploads()