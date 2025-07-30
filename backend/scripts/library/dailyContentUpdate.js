#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()
const PENDING_BOOKS_DIR = path.join(__dirname, '../../../content-library-pending')
const PROCESSED_BOOKS_DIR = path.join(__dirname, '../../../content-library-processed')

/**
 * Daily script to process new books added to the pending directory
 * This should be run as a cron job or scheduled task
 */

async function dailyContentUpdate() {
  try {
    console.log('🌅 Starting daily content update...')
    console.log(`📁 Scanning: ${PENDING_BOOKS_DIR}`)
    
    // Ensure directories exist
    if (!fs.existsSync(PENDING_BOOKS_DIR)) {
      fs.mkdirSync(PENDING_BOOKS_DIR, { recursive: true })
      console.log(`📁 Created pending directory: ${PENDING_BOOKS_DIR}`)
    }
    
    if (!fs.existsSync(PROCESSED_BOOKS_DIR)) {
      fs.mkdirSync(PROCESSED_BOOKS_DIR, { recursive: true })
      console.log(`📁 Created processed directory: ${PROCESSED_BOOKS_DIR}`)
    }
    
    // Scan for new books in category folders
    const categories = await fs.promises.readdir(PENDING_BOOKS_DIR, { withFileTypes: true })
    let totalProcessed = 0
    let totalErrors = 0
    
    for (const categoryDir of categories) {
      if (!categoryDir.isDirectory() || categoryDir.name.startsWith('.')) {
        continue
      }
      
      const categoryName = categoryDir.name
      const categoryPath = path.join(PENDING_BOOKS_DIR, categoryName)
      
      console.log(`\n📚 Processing category: ${categoryName}`)
      
      try {
        const files = await fs.promises.readdir(categoryPath)
        const bookFiles = files.filter(file => 
          file.endsWith('.pdf') || file.endsWith('.epub')
        )
        
        if (bookFiles.length === 0) {
          console.log(`  ℹ️  No books found in ${categoryName}`)
          continue
        }
        
        console.log(`  📖 Found ${bookFiles.length} books`)
        
        for (const bookFile of bookFiles) {
          const bookPath = path.join(categoryPath, bookFile)
          
          try {
            console.log(`  🔄 Processing: ${bookFile}`)
            
            // Process the book (import the addBook function)
            const { default: { addBookToLibrary } } = await import('./addBook.js')
            const content = await addBookToLibrary(bookPath, categoryName)
            
            // Move to processed folder
            const processedCategoryDir = path.join(PROCESSED_BOOKS_DIR, categoryName)
            if (!fs.existsSync(processedCategoryDir)) {
              fs.mkdirSync(processedCategoryDir, { recursive: true })
            }
            
            const processedPath = path.join(processedCategoryDir, bookFile)
            await fs.promises.rename(bookPath, processedPath)
            
            console.log(`  ✅ Successfully processed and moved: ${bookFile}`)
            totalProcessed++
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 2000))
            
          } catch (bookError) {
            console.error(`  ❌ Error processing ${bookFile}:`, bookError.message)
            
            // Move to error folder
            const errorDir = path.join(PROCESSED_BOOKS_DIR, '_errors', categoryName)
            if (!fs.existsSync(errorDir)) {
              fs.mkdirSync(errorDir, { recursive: true })
            }
            
            const errorPath = path.join(errorDir, `ERROR_${Date.now()}_${bookFile}`)
            await fs.promises.rename(bookPath, errorPath)
            
            totalErrors++
          }
        }
        
      } catch (categoryError) {
        console.error(`❌ Error processing category ${categoryName}:`, categoryError.message)
        totalErrors++
      }
    }
    
    // Generate summary report
    console.log('\n📊 Daily Update Summary:')
    console.log(`✅ Successfully processed: ${totalProcessed} books`)
    console.log(`❌ Errors: ${totalErrors} books`)
    console.log(`📈 Total library content: ${await prisma.content.count({ where: { source: 'LIBRARY' } })}`)
    
    // Log to database for tracking
    await prisma.systemLog.create({
      data: {
        type: 'DAILY_CONTENT_UPDATE',
        message: `Processed ${totalProcessed} books, ${totalErrors} errors`,
        metadata: JSON.stringify({
          processed: totalProcessed,
          errors: totalErrors,
          timestamp: new Date().toISOString()
        })
      }
    }).catch(() => {
      // Ignore if SystemLog table doesn't exist
      console.log('📝 (System log table not available)')
    })
    
    console.log('\n🎉 Daily content update completed!')
    
  } catch (error) {
    console.error('💥 Daily update failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  dailyContentUpdate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export default dailyContentUpdate