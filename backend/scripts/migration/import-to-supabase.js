#!/usr/bin/env node
/**
 * Import data from SQLite export to Supabase PostgreSQL
 * Usage: node scripts/migration/import-to-supabase.js
 * 
 * Prerequisites:
 * 1. Update .env with Supabase DATABASE_URL
 * 2. Run `npx prisma migrate dev` to create tables
 * 3. Ensure sqlite-export-data.json exists
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create Prisma client for Supabase (will use DATABASE_URL from .env)
const prisma = new PrismaClient()

async function importData() {
  try {
    console.log('🔄 Starting Supabase data import...')

    // Read exported data
    const exportPath = path.join(__dirname, 'sqlite-export-data.json')
    if (!fs.existsSync(exportPath)) {
      throw new Error(`Export file not found: ${exportPath}. Run export-sqlite-data.js first.`)
    }

    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'))
    
    console.log('📊 Import Summary:')
    Object.entries(exportData.totalRecords).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} records`)
    })

    // Clear existing data (optional - comment out if you want to preserve data)
    console.log('🧹 Clearing existing data...')
    await prisma.chapterProgress.deleteMany()
    await prisma.chatMessage.deleteMany()
    await prisma.chatConversation.deleteMany()
    await prisma.processingJob.deleteMany()
    await prisma.contentUpload.deleteMany()
    await prisma.learningSession.deleteMany()
    await prisma.userProgress.deleteMany()
    await prisma.card.deleteMany()
    await prisma.chapter.deleteMany()
    await prisma.content.deleteMany()
    await prisma.user.deleteMany()

    // Import data in dependency order (referenced tables first)
    console.log('📥 Importing users...')
    if (exportData.users.length > 0) {
      await prisma.user.createMany({
        data: exportData.users,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing content...')
    if (exportData.content.length > 0) {
      await prisma.content.createMany({
        data: exportData.content,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing chapters...')
    if (exportData.chapters.length > 0) {
      await prisma.chapter.createMany({
        data: exportData.chapters,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing cards...')
    if (exportData.cards.length > 0) {
      await prisma.card.createMany({
        data: exportData.cards,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing user progress...')
    if (exportData.userProgress.length > 0) {
      await prisma.userProgress.createMany({
        data: exportData.userProgress,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing learning sessions...')
    if (exportData.learningSessions.length > 0) {
      await prisma.learningSession.createMany({
        data: exportData.learningSessions,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing content uploads...')
    if (exportData.contentUploads.length > 0) {
      await prisma.contentUpload.createMany({
        data: exportData.contentUploads,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing processing jobs...')
    if (exportData.processingJobs.length > 0) {
      await prisma.processingJob.createMany({
        data: exportData.processingJobs,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing chat conversations...')
    if (exportData.chatConversations.length > 0) {
      await prisma.chatConversation.createMany({
        data: exportData.chatConversations,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing chat messages...')
    if (exportData.chatMessages.length > 0) {
      await prisma.chatMessage.createMany({
        data: exportData.chatMessages,
        skipDuplicates: true
      })
    }

    console.log('📥 Importing chapter progress...')
    if (exportData.chapterProgress.length > 0) {
      await prisma.chapterProgress.createMany({
        data: exportData.chapterProgress,
        skipDuplicates: true
      })
    }

    // Verify import
    console.log('🔍 Verifying import...')
    const [
      userCount,
      contentCount,
      cardCount,
      progressCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.content.count(),
      prisma.card.count(),
      prisma.userProgress.count()
    ])

    console.log('✅ Import completed successfully!')
    console.log('📊 Verification:')
    console.log(`   Users: ${userCount}`)
    console.log(`   Content: ${contentCount}`)
    console.log(`   Cards: ${cardCount}`)
    console.log(`   User Progress: ${progressCount}`)

    // Create a verification report
    const reportPath = path.join(__dirname, `import-report-${Date.now()}.json`)
    const report = {
      importedAt: new Date().toISOString(),
      originalCounts: exportData.totalRecords,
      finalCounts: {
        users: userCount,
        content: contentCount,
        cards: cardCount,
        userProgress: progressCount
      },
      success: true
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Import report saved to: ${reportPath}`)

  } catch (error) {
    console.error('❌ Import failed:', error)
    
    // Create error report
    const errorReportPath = path.join(__dirname, `import-error-${Date.now()}.json`)
    const errorReport = {
      failedAt: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      success: false
    }
    fs.writeFileSync(errorReportPath, JSON.stringify(errorReport, null, 2))
    console.log(`📄 Error report saved to: ${errorReportPath}`)
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run import
importData()