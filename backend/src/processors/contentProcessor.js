import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chokidar from 'chokidar'
import { PrismaClient } from '@prisma/client'
import { generateLearningCards } from './aiCardGenerator.js'
import { extractTextFromPDF } from './textExtractor.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()
const CONTENT_LIBRARY_PATH = path.join(__dirname, '../../../content-library')

class ContentProcessor {
  constructor() {
    this.watcher = null
    this.processing = new Set()
  }

  async start() {
    console.log('🚀 Starting content processor...')
    console.log(`📁 Watching: ${CONTENT_LIBRARY_PATH}`)

    // Initial scan of existing files
    await this.scanExistingFiles()

    // Watch for new files
    this.watcher = chokidar.watch(CONTENT_LIBRARY_PATH, {
      ignored: /^\./, // ignore dotfiles
      persistent: true,
      depth: 2
    })

    this.watcher
      .on('add', this.handleNewFile.bind(this))
      .on('change', this.handleFileChange.bind(this))
      .on('error', error => console.error('❌ Watcher error:', error))

    console.log('✅ Content processor started successfully')
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close()
      console.log('🛑 Content processor stopped')
    }
  }

  async scanExistingFiles() {
    console.log('🔍 Scanning existing files...')
    
    try {
      const categories = await fs.promises.readdir(CONTENT_LIBRARY_PATH, { withFileTypes: true })
      
      for (const category of categories) {
        if (category.isDirectory() && !category.name.startsWith('.')) {
          const categoryPath = path.join(CONTENT_LIBRARY_PATH, category.name)
          const files = await fs.promises.readdir(categoryPath)
          
          for (const file of files) {
            if (this.isSupportedFile(file)) {
              const filePath = path.join(categoryPath, file)
              await this.processFile(filePath, category.name)
            }
          }
        }
      }
      
      console.log('✅ Initial scan completed')
    } catch (error) {
      console.error('❌ Error scanning existing files:', error)
    }
  }

  async handleNewFile(filePath) {
    if (this.isSupportedFile(filePath)) {
      console.log(`📄 New file detected: ${filePath}`)
      const category = this.extractCategory(filePath)
      await this.processFile(filePath, category)
    }
  }

  async handleFileChange(filePath) {
    if (this.isSupportedFile(filePath)) {
      console.log(`📝 File changed: ${filePath}`)
      const category = this.extractCategory(filePath)
      await this.processFile(filePath, category, true)
    }
  }

  isSupportedFile(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    return ['.pdf', '.epub', '.txt'].includes(ext)
  }

  extractCategory(filePath) {
    const relativePath = path.relative(CONTENT_LIBRARY_PATH, filePath)
    return relativePath.split(path.sep)[0]
  }

  extractBookInfo(filePath) {
    const filename = path.basename(filePath, path.extname(filePath))
    const parts = filename.split(' - ')
    
    if (parts.length >= 2) {
      return {
        author: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim()
      }
    }
    
    return {
      author: 'Unknown',
      title: filename
    }
  }

  async processFile(filePath, category, isUpdate = false) {
    const fileId = this.generateFileId(filePath)
    
    if (this.processing.has(fileId)) {
      console.log(`⏳ Already processing: ${filePath}`)
      return
    }

    this.processing.add(fileId)

    try {
      console.log(`${isUpdate ? '🔄' : '⚡'} Processing: ${filePath}`)
      
      const { author, title } = this.extractBookInfo(filePath)
      
      // Check if content already exists
      const existingContent = await prisma.content.findFirst({
        where: {
          title,
          author,
          category
        }
      })

      if (existingContent && !isUpdate) {
        console.log(`📚 Content already exists: ${title} by ${author}`)
        return
      }

      // Extract text from file
      const textContent = await extractTextFromPDF(filePath)
      
      if (!textContent || textContent.length < 100) {
        console.log(`⚠️  Insufficient content extracted from: ${filePath}`)
        return
      }

      // Generate learning cards using AI
      const cards = await generateLearningCards(textContent, title, author, category)
      
      if (!cards || cards.length === 0) {
        console.log(`⚠️  No cards generated for: ${filePath}`)
        return
      }

      // Save to database
      const contentData = {
        title,
        author,
        category,
        description: `Learning cards generated from "${title}" by ${author}`,
        difficulty: this.calculateDifficulty(category),
        estimatedTime: Math.ceil(cards.length * 2), // 2 minutes per card
        tags: JSON.stringify([category, author.toLowerCase().replace(/\s+/g, '-')]),
        totalCards: cards.length,
        isActive: true
      }

      let savedContent
      if (existingContent) {
        savedContent = await prisma.content.update({
          where: { id: existingContent.id },
          data: contentData
        })
        
        // Delete existing cards
        await prisma.card.deleteMany({
          where: { contentId: existingContent.id }
        })
      } else {
        savedContent = await prisma.content.create({
          data: contentData
        })
      }

      // Save cards
      const cardData = cards.map((card, index) => ({
        contentId: savedContent.id,
        title: card.title,
        content: card.content,
        difficulty: card.difficulty || contentData.difficulty,
        cardType: 'CONCEPT',
        order: index + 1,
        tags: JSON.stringify(card.tags || [])
      }))

      await prisma.card.createMany({
        data: cardData
      })

      console.log(`✅ Successfully processed: ${title} (${cards.length} cards)`)
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error)
    } finally {
      this.processing.delete(fileId)
    }
  }

  generateFileId(filePath) {
    return Buffer.from(filePath).toString('base64')
  }

  calculateDifficulty(category) {
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

  async getProcessingStats() {
    const totalContent = await prisma.content.count()
    const totalCards = await prisma.card.count()
    const categoryCounts = await prisma.content.groupBy({
      by: ['category'],
      _count: true
    })

    return {
      totalContent,
      totalCards,
      categoryCounts,
      currentlyProcessing: this.processing.size
    }
  }
}

export default ContentProcessor