import { PrismaClient } from '@prisma/client'
import { generateLearningCards } from './aiCardGenerator.js'
import { extractTextFromPDF } from './textExtractor.js'
import axios from 'axios'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

/**
 * Processes user-uploaded content (PDFs, URLs, articles)
 * This is separate from the static library content
 */
class UserContentProcessor {
  constructor() {
    this.processing = new Set()
  }

  /**
   * Process user uploaded file
   */
  async processUserUpload(userId, filePath, options = {}) {
    const processingId = `${userId}_${Date.now()}`
    
    if (this.processing.has(processingId)) {
      throw new Error('Already processing this upload')
    }

    this.processing.add(processingId)

    try {
      console.log(`📤 Processing user upload: ${filePath}`)
      
      // Extract text from uploaded file
      const textContent = await extractTextFromPDF(filePath)
      
      if (!textContent || textContent.length < 100) {
        throw new Error('Insufficient content extracted from uploaded file')
      }

      // Create user content entry
      const userContent = await prisma.userContent.create({
        data: {
          userId,
          title: options.title || 'My Upload',
          source: filePath,
          sourceType: 'FILE',
          status: 'PROCESSING',
          originalText: textContent.substring(0, 10000), // Store first 10k chars
        }
      })

      // Generate learning cards
      const cards = await generateLearningCards(
        textContent, 
        userContent.title, 
        'You', // User as author
        options.category || 'personal'
      )

      if (!cards || cards.length === 0) {
        throw new Error('Failed to generate learning cards from upload')
      }

      // Save cards linked to user content
      const cardData = cards.map((card, index) => ({
        userContentId: userContent.id,
        userId, // Link directly to user for easy querying
        title: card.title,
        content: card.content,
        difficulty: card.difficulty || 'MEDIUM',
        cardType: 'CONCEPT',
        order: index + 1,
        tags: JSON.stringify(card.tags || [])
      }))

      await prisma.userCard.createMany({ data: cardData })

      // Update status
      await prisma.userContent.update({
        where: { id: userContent.id },
        data: { 
          status: 'COMPLETED',
          totalCards: cards.length,
          completedAt: new Date()
        }
      })

      console.log(`✅ User upload processed: ${cards.length} cards generated`)
      
      return {
        contentId: userContent.id,
        totalCards: cards.length,
        cards
      }

    } catch (error) {
      console.error('❌ Error processing user upload:', error)
      throw error
    } finally {
      this.processing.delete(processingId)
    }
  }

  /**
   * Process user submitted URL/article
   */
  async processUserURL(userId, url, options = {}) {
    const processingId = `${userId}_url_${Date.now()}`
    
    if (this.processing.has(processingId)) {
      throw new Error('Already processing this URL')
    }

    this.processing.add(processingId)

    try {
      console.log(`🔗 Processing user URL: ${url}`)
      
      // Fetch and extract content from URL
      const textContent = await this.extractTextFromURL(url)
      
      if (!textContent || textContent.length < 200) {
        throw new Error('Insufficient content extracted from URL')
      }

      // Create user content entry
      const userContent = await prisma.userContent.create({
        data: {
          userId,
          title: options.title || this.extractTitleFromURL(url),
          source: url,
          sourceType: 'URL',
          status: 'PROCESSING',
          originalText: textContent.substring(0, 10000),
        }
      })

      // Generate learning cards
      const cards = await generateLearningCards(
        textContent, 
        userContent.title, 
        options.author || 'Web Article',
        options.category || 'personal'
      )

      if (!cards || cards.length === 0) {
        throw new Error('Failed to generate learning cards from URL')
      }

      // Save cards
      const cardData = cards.map((card, index) => ({
        userContentId: userContent.id,
        userId,
        title: card.title,
        content: card.content,
        difficulty: card.difficulty || 'MEDIUM',
        cardType: 'CONCEPT',
        order: index + 1,
        tags: JSON.stringify(card.tags || [])
      }))

      await prisma.userCard.createMany({ data: cardData })

      // Update status
      await prisma.userContent.update({
        where: { id: userContent.id },
        data: { 
          status: 'COMPLETED',
          totalCards: cards.length,
          completedAt: new Date()
        }
      })

      console.log(`✅ User URL processed: ${cards.length} cards generated`)
      
      return {
        contentId: userContent.id,
        totalCards: cards.length,
        cards
      }

    } catch (error) {
      console.error('❌ Error processing user URL:', error)
      throw error
    } finally {
      this.processing.delete(processingId)
    }
  }

  /**
   * Extract text content from URL
   */
  async extractTextFromURL(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'MindScroll-Bot/1.0'
        },
        timeout: 10000
      })

      const $ = cheerio.load(response.data)
      
      // Remove unwanted elements
      $('script, style, nav, header, footer, aside, .ads, .advertisement').remove()
      
      // Extract main content
      let content = ''
      
      // Try common content selectors
      const contentSelectors = [
        'article',
        '.post-content',
        '.entry-content', 
        '.content',
        'main',
        '.main-content',
        '#main-content'
      ]
      
      for (const selector of contentSelectors) {
        const element = $(selector)
        if (element.length && element.text().trim().length > content.length) {
          content = element.text().trim()
        }
      }
      
      // Fallback to body if no content found
      if (!content || content.length < 200) {
        content = $('body').text().trim()
      }
      
      // Clean up the text
      return content
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        
    } catch (error) {
      console.error('Error extracting text from URL:', error)
      throw new Error(`Failed to extract content from URL: ${error.message}`)
    }
  }

  /**
   * Extract title from URL content
   */
  extractTitleFromURL(url) {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace('www.', '') + ' Article'
    } catch {
      return 'Web Article'
    }
  }

  /**
   * Get user's uploaded content
   */
  async getUserContent(userId, options = {}) {
    const { limit = 10, offset = 0, status } = options
    
    const whereClause = {
      userId,
      ...(status && { status })
    }
    
    const content = await prisma.userContent.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { userCards: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
    
    return content
  }

  /**
   * Get processing stats for user
   */
  async getUserStats(userId) {
    const totalUploads = await prisma.userContent.count({
      where: { userId }
    })
    
    const totalCards = await prisma.userCard.count({
      where: { userId }
    })
    
    const processing = await prisma.userContent.count({
      where: { userId, status: 'PROCESSING' }
    })
    
    return {
      totalUploads,
      totalCards,
      processing,
      currentlyProcessing: this.processing.size
    }
  }
}

export default new UserContentProcessor()