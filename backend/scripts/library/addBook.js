#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
import { generateLearningCards } from '../../src/processors/aiCardGenerator.js'
import { extractTextFromPDF } from '../../src/processors/textExtractor.js'
import fileStorage from '../../src/utils/fileStorage.js'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

/**
 * Script to manually add books to the static library
 * Usage: node scripts/library/addBook.js "path/to/book.pdf" "technology"
 */

async function addBookToLibrary(filePath, category) {
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
    const author = parts[0]?.trim() || 'Unknown'
    const title = parts.slice(1).join(' - ').trim() || filename
    
    console.log(`📖 Book: "${title}" by ${author}`)
    console.log(`📂 Category: ${category}`)
    
    // Check if already exists
    const existing = await prisma.content.findFirst({
      where: { title, author, category }
    })
    
    if (existing) {
      console.log('⚠️  Book already exists in library')
      return existing
    }
    
    // Generate content ID for file storage
    const contentId = fileStorage.generateContentId(title, author, filePath)
    
    // Check if we have cached cards
    console.log('📦 Checking for cached cards...')
    let cards = await fileStorage.getCachedCards(contentId)
    
    if (!cards) {
      // Extract text
      console.log('📄 Extracting text...')
      const textData = await extractTextFromPDF(filePath)
      
      if (!textData || textData.length < 100) {
        throw new Error('Insufficient text content extracted')
      }
      
      // Store extracted text (not in database)
      await fileStorage.storeExtractedText(contentId, textData)
      
      // Generate cards
      console.log('🧠 Generating learning cards with AI...')
      cards = await generateLearningCards(textData, title, author, category)
      
      // Cache the generated cards
      if (cards && cards.length > 0) {
        await fileStorage.cacheProcessedCards(contentId, cards)
      }
    } else {
      console.log('📦 Using cached cards - skipping AI processing')
    }
    
    if (!cards || cards.length === 0) {
      throw new Error('No learning cards generated')
    }
    
    // Save metadata to database (not full text)
    console.log('💾 Saving metadata to database...')
    const content = await prisma.content.create({
      data: {
        id: contentId, // Use our generated ID
        title,
        author,
        category,
        description: `Professional learning cards generated from "${title}" by ${author}`,
        difficulty: calculateDifficulty(category),
        estimatedTime: Math.ceil(cards.length * 2),
        tags: JSON.stringify([category, author.toLowerCase().replace(/\s+/g, '-')]),
        totalCards: cards.length,
        isActive: true,
        source: 'LIBRARY', // Mark as library content
        textFileId: contentId // Reference to file storage
      }
    })
    
    // Save cards
    const cardData = cards.map((card, index) => ({
      contentId: content.id,
      title: card.title,
      content: card.content,
      difficulty: card.difficulty || content.difficulty,
      cardType: 'CONCEPT',
      order: index + 1,
      tags: JSON.stringify(card.tags || [])
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
  console.log('Usage: node addBook.js <file-path> <category>')
  console.log('Categories: technology, business, science, personal-development, economics, health, history, philosophy, arts')
  process.exit(1)
}

const [,, filePath, category] = process.argv

addBookToLibrary(filePath, category)
  .then(() => {
    console.log('🎉 Book added successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Failed to add book:', error.message)
    process.exit(1)
  })