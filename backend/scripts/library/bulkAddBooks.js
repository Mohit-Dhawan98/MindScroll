#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Bulk book processing script
 * Usage: node scripts/library/bulkAddBooks.js <directory> <category> [options]
 * 
 * Options:
 * --provider openai|anthropic     AI provider (default: openai)
 * --extensions pdf,epub,txt       File extensions to process (default: pdf,epub)
 * --override                      Reprocess existing books
 * --parallel N                    Process N books in parallel (default: 2)
 * --dry-run                       Show what would be processed without actually processing
 * 
 * Examples:
 * node scripts/library/bulkAddBooks.js "/Users/user/books" "technology" --provider openai
 * node scripts/library/bulkAddBooks.js "/Users/user/books" "business" --extensions pdf,epub --override
 * node scripts/library/bulkAddBooks.js "/Users/user/books" "science" --parallel 1 --dry-run
 */

async function bulkAddBooks(directory, category, options = {}) {
  try {
    console.log(`📚 Bulk processing books from: ${directory}`)
    console.log(`📂 Category: ${category}`)
    console.log(`🤖 AI Provider: ${options.provider || 'openai'}`)
    console.log(`📄 Extensions: ${options.extensions.join(', ')}`)
    console.log(`🔄 Override: ${options.override ? 'Yes' : 'No'}`)
    console.log(`⚡ Parallel: ${options.parallel}`)
    console.log(`🧪 Dry run: ${options.dryRun ? 'Yes' : 'No'}`)
    console.log('')

    if (!fs.existsSync(directory)) {
      throw new Error(`Directory not found: ${directory}`)
    }

    // Find all book files
    const bookFiles = findBookFiles(directory, options.extensions)
    console.log(`📋 Found ${bookFiles.length} book files to process:`)
    
    bookFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${path.basename(file)}`)
    })
    console.log('')

    if (options.dryRun) {
      console.log('🧪 Dry run mode - no actual processing performed')
      return
    }

    // Process books in parallel batches
    const results = {
      successful: [],
      failed: [],
      skipped: []
    }

    console.log(`🚀 Starting bulk processing (${options.parallel} parallel)...`)
    console.log('')

    for (let i = 0; i < bookFiles.length; i += options.parallel) {
      const batch = bookFiles.slice(i, i + options.parallel)
      const batchPromises = batch.map(filePath => processBook(filePath, category, options))
      
      console.log(`📦 Processing batch ${Math.floor(i / options.parallel) + 1}/${Math.ceil(bookFiles.length / options.parallel)} (${batch.length} books)...`)
      
      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach((result, index) => {
        const filePath = batch[index]
        const fileName = path.basename(filePath)
        
        if (result.status === 'fulfilled') {
          if (result.value.skipped) {
            results.skipped.push(fileName)
            console.log(`⏭️  Skipped: ${fileName} (${result.value.reason})`)
          } else {
            results.successful.push(fileName)
            console.log(`✅ Success: ${fileName}`)
          }
        } else {
          results.failed.push({ fileName, error: result.reason.message })
          console.log(`❌ Failed: ${fileName} - ${result.reason.message}`)
        }
      })
      
      console.log('')
    }

    // Summary
    console.log('📊 BULK PROCESSING SUMMARY')
    console.log('=' .repeat(50))
    console.log(`✅ Successful: ${results.successful.length}`)
    console.log(`❌ Failed: ${results.failed.length}`)
    console.log(`⏭️  Skipped: ${results.skipped.length}`)
    console.log(`📚 Total: ${bookFiles.length}`)
    console.log('')

    if (results.failed.length > 0) {
      console.log('❌ Failed books:')
      results.failed.forEach(({ fileName, error }) => {
        console.log(`  • ${fileName}: ${error}`)
      })
      console.log('')
    }

    console.log('🎉 Bulk processing completed!')

  } catch (error) {
    console.error('💥 Bulk processing failed:', error.message)
    process.exit(1)
  }
}

function findBookFiles(directory, extensions) {
  const files = []
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir)
    
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        // Skip hidden directories and common non-book directories
        if (!item.startsWith('.') && !['node_modules', 'dist', 'build'].includes(item)) {
          scanDirectory(fullPath)
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase().substring(1)
        if (extensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  }
  
  scanDirectory(directory)
  return files.sort()
}

async function processBook(filePath, category, options) {
  try {
    const fileName = path.basename(filePath)
    
    // Import the single book processor dynamically
    const { addBookToLibrary } = await import('./addBook.js')
    
    // Build command arguments
    const args = [filePath, category]
    
    if (options.provider) {
      args.push('--provider', options.provider)
    }
    
    if (options.override) {
      args.push('--override')
    }
    
    // Mock process.argv for the addBook script
    const originalArgv = process.argv
    process.argv = ['node', 'addBook.js', ...args]
    
    try {
      await addBookToLibrary(filePath, category, options.provider || 'openai', options.override || false)
      return { success: true }
    } finally {
      process.argv = originalArgv
    }
    
  } catch (error) {
    if (error.message.includes('already exists') && !options.override) {
      return { skipped: true, reason: 'already exists' }
    }
    throw error
  }
}

// CLI execution
if (process.argv.length < 4) {
  console.log('Usage: node bulkAddBooks.js <directory> <category> [options]')
  console.log('')
  console.log('Options:')
  console.log('  --provider openai|anthropic    AI provider (default: openai)')
  console.log('  --extensions pdf,epub,txt      File extensions (default: pdf,epub)')
  console.log('  --override                     Reprocess existing books')
  console.log('  --parallel N                   Process N books in parallel (default: 2)')
  console.log('  --dry-run                      Show files without processing')
  console.log('')
  console.log('Examples:')
  console.log('  node bulkAddBooks.js "/Users/user/books" "technology"')
  console.log('  node bulkAddBooks.js "/Users/user/books" "business" --override --parallel 1')
  process.exit(1)
}

const args = process.argv.slice(2)
const directory = args[0]
const category = args[1]

// Parse options
const options = {
  provider: 'openai',
  extensions: ['pdf', 'epub'],
  override: false,
  parallel: 2,
  dryRun: false
}

for (let i = 2; i < args.length; i++) {
  const arg = args[i]
  
  if (arg === '--provider' && i + 1 < args.length) {
    options.provider = args[++i]
  } else if (arg === '--extensions' && i + 1 < args.length) {
    options.extensions = args[++i].split(',').map(ext => ext.trim())
  } else if (arg === '--override') {
    options.override = true
  } else if (arg === '--parallel' && i + 1 < args.length) {
    options.parallel = parseInt(args[++i]) || 2
  } else if (arg === '--dry-run') {
    options.dryRun = true
  }
}

// Validate category
const validCategories = ['technology', 'business', 'science', 'personal-development', 'economics', 'health', 'history', 'philosophy', 'arts']
if (!validCategories.includes(category)) {
  console.error(`❌ Invalid category. Must be one of: ${validCategories.join(', ')}`)
  process.exit(1)
}

// Start bulk processing
bulkAddBooks(directory, category, options)
  .then(() => {
    console.log('🎯 Bulk processing script completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Bulk processing script failed:', error.message)
    process.exit(1)
  })