#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
import { enhancedCardGenerator } from '../../src/processors/enhancedCardGenerator.js'
import { extractTextFromPDF } from '../../src/processors/textExtractor.js'
import fileStorage from '../../src/utils/fileStorage.js'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

/**
 * Script to manually add books to the static library
 * Usage: node scripts/library/addBook.js "path/to/book.[epub|pdf]" "technology" [--provider openai|anthropic] [--override]
 * 
 * Options:
 * --provider: Choose AI provider (openai|anthropic) - default: openai
 * --override: Force reprocess even if book already exists in database
 * 
 * Supported formats:
 * - .epub (RECOMMENDED - better chapter structure and text extraction)
 * - .pdf (fallback - may have extraction issues with complex layouts)
 * - .txt (simple text files)
 */

async function addBookToLibrary(filePath, category, aiProvider = 'openai', override = false) {
  try {
    console.log(`📚 Adding book to library: ${filePath}`)
    
    // Validate inputs
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    
    const validCategories = ['technology', 'business', 'science', 'personal-development', 'economics', 'health', 'history', 'philosophy', 'arts']
    if (!validCategories.includes(category)) {
      throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`)
    }
    
    // Extract book info from filename
    const filename = path.basename(filePath, path.extname(filePath))
    const parts = filename.split(' - ')
    
    // Handle "Title - Author" format
    let title, author
    if (parts.length >= 2) {
      title = parts[0]?.trim() || 'Unknown Title'
      author = parts.slice(1).join(' - ').trim() || 'Unknown Author'
    } else {
      title = filename
      author = 'Unknown Author'
    }
    
    console.log(`📖 Book: "${title}" by ${author}`)
    console.log(`📂 Category: ${category}`)
    
    // Check if already exists
    const existing = await prisma.content.findFirst({
      where: { title, author, category }
    })
    
    if (existing && !override) {
      console.log('⚠️  Book already exists in library. Use --override to reprocess.')
      return existing
    }
    
    if (existing && override) {
      console.log('🔄 Override mode: Deleting existing book entry...')
      
      // Delete existing cards and progress first
      await prisma.userProgress.deleteMany({
        where: { cardId: { in: existing.cards?.map(c => c.id) || [] } }
      })
      
      await prisma.card.deleteMany({
        where: { contentId: existing.id }
      })
      
      await prisma.content.delete({
        where: { id: existing.id }
      })
      
      console.log('✅ Existing book deleted, proceeding with fresh processing...')
    }
    
    // Generate content ID for file storage
    const contentId = fileStorage.generateContentId(title, author, filePath)
    
    // Clear cache if override mode is enabled
    if (override) {
      console.log('🗑️ Override mode: Clearing cached data...')
      await fileStorage.clearCache(contentId)
      console.log('✅ Cache cleared - forcing fresh processing')
    }
    
    // Check if we have cached cards
    console.log('📦 Checking for cached cards...')
    let cards = await fileStorage.getCachedCards(contentId)
    
    if (!cards) {
      // Extract text
      console.log('📄 Extracting text...')
      const textData = await extractTextFromPDF(filePath)
      
      // Check if we got structured data or just text
      const hasStructuredData = textData && typeof textData === 'object' && textData.text && textData.pages
      const textContent = hasStructuredData ? textData.text : textData
      
      if (!textContent || textContent.length < 100) {
        throw new Error('Insufficient text content extracted')
      }
      
      if (hasStructuredData) {
        console.log(`📊 Using structured data: ${textData.pages.length} pages, ${textData.metadata.extractedPages} processed pages`)
      } else {
        console.log('📄 Using simple text extraction (no page structure)')
      }
      
      // Store extracted text (not in database)
      await fileStorage.storeExtractedText(contentId, textData)
      
      // Generate cards with enhanced system
      console.log(`🧠 Generating enhanced learning cards using ${aiProvider.toUpperCase()} (${aiProvider === 'openai' ? 'GPT-4.1-mini' : 'Claude-3-Haiku'})...`)
      
      // Create generator instance with specified AI provider
      const cardGenerator = new (await import('../../src/processors/enhancedCardGenerator.js')).EnhancedCardGenerator(aiProvider)
      
      // Pass the full textData object (which may include structured pages) to the card generator
      cards = await cardGenerator.generateEnhancedLearningCards(textData, title, author, category)
      
      // Cache the generated cards
      if (cards && cards.length > 0) {
        await fileStorage.cacheProcessedCards(contentId, cards)
      }
    } else {
      console.log('📦 Using cached cards - skipping AI processing')
    }
    
    // Validation: Ensure cards were properly generated before DB entry
    if (!cards || cards.length === 0) {
      throw new Error('❌ PROCESSING FAILED: No learning cards generated - book will NOT be added to database')
    }
    
    if (cards.length < 5) {
      throw new Error(`❌ PROCESSING FAILED: Only ${cards.length} cards generated (minimum 5 required) - book will NOT be added to database`)
    }
    
    // Check if cards have proper content
    const invalidCards = cards.filter(card => 
      !card.title || !card.content || card.title.length < 10 || card.content.length < 100
    )
    
    if (invalidCards.length > cards.length * 0.3) {
      throw new Error(`❌ PROCESSING FAILED: ${invalidCards.length}/${cards.length} cards are invalid - book will NOT be added to database`)
    }
    
    console.log('✅ Card generation validation passed - proceeding to save to database')
    
    // Save metadata to database (not full text)
    console.log('💾 Saving metadata to database...')
    const content = await prisma.content.create({
      data: {
        id: contentId, // Use our generated ID
        title,
        author,
        category,
        description: `Professional learning cards generated from "${title}" by ${author}`,
        type: 'COURSE',
        source: 'CURATED',
        difficulty: calculateDifficulty(category),
        estimatedTime: Math.ceil(cards.length * 2),
        tags: JSON.stringify([category, author.toLowerCase().replace(/\s+/g, '-')]),
        topics: JSON.stringify([category]),
        isAiGenerated: true,
        sourceType: 'book',
        // Important fields restored:
        totalCards: cards.length,
        isActive: true,
        textFileId: contentId // Reference to file storage
      }
    })
    
    // Save cards
    const cardData = cards.map((card, index) => ({
      contentId: content.id,
      type: card.type || 'SUMMARY', // Use the type from enhanced generator
      title: card.title,
      text: card.content, // Schema uses 'text' not 'content'
      order: index + 1,
      tags: JSON.stringify(card.tags || []),
      // Add quiz data if it's a quiz card
      ...(card.quiz && { quiz: JSON.stringify(card.quiz) })
    }))
    
    await prisma.card.createMany({ data: cardData })
    
    console.log(`✅ Successfully added "${title}" to library`)
    console.log(`📊 Generated ${cards.length} learning cards`)
    console.log(`🆔 Content ID: ${content.id}`)
    
    return content
    
  } catch (error) {
    console.error('❌ Error adding book to library:', error.message)
    throw error
  }
}

function calculateDifficulty(category) {
  const difficultyMap = {
    'technology': 'HARD',
    'science': 'HARD', 
    'philosophy': 'HARD',
    'economics': 'MEDIUM',
    'business': 'MEDIUM',
    'history': 'MEDIUM',
    'personal-development': 'EASY',
    'health': 'EASY',
    'arts': 'EASY'
  }
  return difficultyMap[category] || 'MEDIUM'
}

// CLI execution
if (process.argv.length < 4) {
  console.log('Usage: node addBook.js <file-path> <category> [--provider openai|anthropic] [--override]')
  console.log('Categories: technology, business, science, personal-development, economics, health, history, philosophy, arts')
  console.log('Providers: openai (GPT-4.1-mini, default), anthropic (Claude-3-Haiku)')
  console.log('Options: --override (force reprocess existing books)')
  process.exit(1)
}

const args = process.argv.slice(2)
const filePath = args[0]
const category = args[1]

// Parse command line options
let aiProvider = 'openai' // Default to OpenAI GPT-4.1-mini
let override = false

const providerIndex = args.findIndex(arg => arg === '--provider')
if (providerIndex !== -1 && providerIndex + 1 < args.length) {
  const provider = args[providerIndex + 1].toLowerCase()
  if (['openai', 'anthropic'].includes(provider)) {
    aiProvider = provider
  } else {
    console.error('❌ Invalid provider. Use "openai" or "anthropic"')
    process.exit(1)
  }
}

if (args.includes('--override')) {
  override = true
  console.log('🔄 Override mode enabled - will reprocess existing books')
}

console.log(`🤖 Using AI Provider: ${aiProvider.toUpperCase()} (${aiProvider === 'openai' ? 'GPT-4.1-mini' : 'Claude-3-Haiku'})`)

addBookToLibrary(filePath, category, aiProvider, override)
  .then(() => {
    console.log('🎉 Book added successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Failed to add book:', error.message)
    process.exit(1)
  })