#!/usr/bin/env node
/**
 * Export data from SQLite database for migration to Supabase PostgreSQL
 * Usage: node scripts/migration/export-sqlite-data.js
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create Prisma client with explicit SQLite database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
})

async function exportData() {
  try {
    console.log('🔄 Starting SQLite data export...')

    // Export all data from SQLite database
    const [
      users,
      content,
      cards,
      userProgress,
      learningSessions,
      contentUploads,
      processingJobs,
      chatConversations,
      chatMessages,
      chapters,
      chapterProgress
    ] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.content.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.card.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.userProgress.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.learningSession.findMany({
        orderBy: { startedAt: 'asc' }
      }),
      prisma.contentUpload.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.processingJob.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.chatConversation.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.chatMessage.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.chapter.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.chapterProgress.findMany({
        orderBy: { createdAt: 'asc' }
      })
    ])

    const exportData = {
      users,
      content,
      cards,
      userProgress,
      learningSessions,
      contentUploads,
      processingJobs,
      chatConversations,
      chatMessages,
      chapters,
      chapterProgress,
      exportedAt: new Date().toISOString(),
      totalRecords: {
        users: users.length,
        content: content.length,
        cards: cards.length,
        userProgress: userProgress.length,
        learningSessions: learningSessions.length,
        contentUploads: contentUploads.length,
        processingJobs: processingJobs.length,
        chatConversations: chatConversations.length,
        chatMessages: chatMessages.length,
        chapters: chapters.length,
        chapterProgress: chapterProgress.length
      }
    }

    // Ensure migration directory exists
    const migrationDir = path.join(__dirname)
    if (!fs.existsSync(migrationDir)) {
      fs.mkdirSync(migrationDir, { recursive: true })
    }

    // Write export data to JSON file
    const exportPath = path.join(migrationDir, 'sqlite-export-data.json')
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2))

    console.log('✅ Export completed successfully!')
    console.log(`📄 Data exported to: ${exportPath}`)
    console.log('📊 Export Summary:')
    Object.entries(exportData.totalRecords).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} records`)
    })

    // Create backup of the SQLite database
    const backupPath = path.join(migrationDir, `sqlite-backup-${Date.now()}.db`)
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath)
      console.log(`🔒 SQLite database backed up to: ${backupPath}`)
    }

    console.log('✨ Ready for import to Supabase!')

  } catch (error) {
    console.error('❌ Export failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run export
exportData()