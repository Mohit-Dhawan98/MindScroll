// import pdfParse from 'pdf-parse' // Temporarily disabled
import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs/promises'
import aiService from './aiService.js'

class ContentProcessor {
  /**
   * Process uploaded PDF file
   * @param {string} filePath - Path to uploaded PDF
   * @returns {Object} Extracted content and metadata
   */
  async processPDF(filePath) {
    try {
      // Temporarily return placeholder data
      console.log('PDF processing temporarily disabled')
      return {
        text: 'PDF content placeholder - processing not implemented yet',
        pages: 1,
        metadata: {},
        wordCount: 10
      }
    } catch (error) {
      console.error('Error processing PDF:', error)
      throw new Error('Failed to process PDF file')
    }
  }

  /**
   * Process URL content
   * @param {string} url - URL to scrape
   * @returns {Object} Extracted content and metadata
   */
  async processURL(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'MindScroll Content Processor'
        }
      })

      const $ = cheerio.load(response.data)
      
      // Remove script and style elements
      $('script, style, nav, footer, header, aside').remove()
      
      // Extract main content
      let content = ''
      const contentSelectors = [
        'article',
        'main',
        '.content',
        '.post-content',
        '.entry-content',
        '.article-content',
        'body'
      ]

      for (const selector of contentSelectors) {
        const element = $(selector).first()
        if (element.length && element.text().trim().length > 200) {
          content = element.text().trim()
          break
        }
      }

      if (!content) {
        content = $('body').text().trim()
      }

      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   'Untitled'

      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || 
                         ''

      return {
        title,
        description,
        text: content,
        url,
        wordCount: content.split(' ').length,
        extractedAt: new Date()
      }
    } catch (error) {
      console.error('Error processing URL:', error)
      throw new Error('Failed to process URL content')
    }
  }

  /**
   * Split content into manageable chunks
   * @param {string} text - Full text content
   * @param {number} chunkSize - Target words per chunk
   * @returns {Array} Array of text chunks
   */
  splitIntoChunks(text, chunkSize = 500) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const chunks = []
    let currentChunk = ''
    let currentWordCount = 0

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(' ').length
      
      if (currentWordCount + sentenceWords > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = sentence.trim()
        currentWordCount = sentenceWords
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence.trim()
        currentWordCount += sentenceWords
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }

  /**
   * Generate microlearning cards from content
   * @param {string} content - Source content
   * @param {Object} options - Generation options
   * @returns {Array} Generated cards
   */
  async generateCards(content, options = {}) {
    const {
      difficulty = 'INTERMEDIATE',
      generateQuiz = true,
      generateFlashcards = true,
      generateSummary = true,
      cardsPerChunk = 3
    } = options

    const chunks = this.splitIntoChunks(content, 800)
    const allCards = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const cards = []

      try {
        // Generate summary card
        if (generateSummary) {
          const summary = await aiService.generateSummary(chunk, {
            length: 'medium',
            difficulty
          })
          
          cards.push({
            type: 'SUMMARY',
            title: `Summary ${i + 1}`,
            text: summary,
            order: allCards.length + cards.length
          })
        }

        // Generate flashcards
        if (generateFlashcards) {
          const flashcards = await aiService.generateFlashcards(chunk, {
            numCards: Math.min(cardsPerChunk, 5)
          })
          
          flashcards.forEach((flashcard, index) => {
            cards.push({
              type: 'FLASHCARD',
              title: `Flashcard ${allCards.length + cards.length + 1}`,
              front: flashcard.front,
              back: flashcard.back,
              order: allCards.length + cards.length
            })
          })
        }

        // Generate quiz questions
        if (generateQuiz) {
          const quizQuestions = await aiService.generateQuiz(chunk, {
            numQuestions: Math.min(cardsPerChunk, 3),
            difficulty
          })
          
          quizQuestions.forEach((question, index) => {
            cards.push({
              type: 'QUIZ',
              title: `Quiz ${allCards.length + cards.length + 1}`,
              quiz: question,
              order: allCards.length + cards.length
            })
          })
        }

        allCards.push(...cards)
        
        // Add delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`Error generating cards for chunk ${i}:`, error)
        // Continue with other chunks
      }
    }

    return allCards
  }

  /**
   * Estimate processing time
   * @param {number} wordCount - Number of words to process
   * @returns {number} Estimated processing time in minutes
   */
  estimateProcessingTime(wordCount) {
    // Rough estimate: 1000 words = ~2 minutes processing
    return Math.ceil(wordCount / 500)
  }

  /**
   * Generate content metadata
   * @param {Object} contentData - Processed content data
   * @returns {Object} Content metadata
   */
  generateMetadata(contentData) {
    const { text, title, url } = contentData
    const wordCount = text.split(' ').length
    const readingTime = Math.ceil(wordCount / 200) // Average reading speed
    
    // Extract topics using simple keyword analysis
    const topics = this.extractTopics(text)
    
    // Determine difficulty based on content analysis
    const difficulty = this.determineDifficulty(text)
    
    return {
      wordCount,
      readingTime,
      estimatedProcessingTime: this.estimateProcessingTime(wordCount),
      topics,
      difficulty,
      source: url ? 'url' : 'upload',
      processedAt: new Date()
    }
  }

  /**
   * Extract topics from text using keyword analysis
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted topics
   */
  extractTopics(text) {
    // Simple topic extraction - in production, use more sophisticated NLP
    const topicKeywords = {
      technology: ['technology', 'software', 'programming', 'AI', 'computer', 'digital'],
      business: ['business', 'management', 'strategy', 'marketing', 'finance', 'leadership'],
      science: ['science', 'research', 'study', 'theory', 'experiment', 'analysis'],
      health: ['health', 'medical', 'wellness', 'fitness', 'nutrition', 'mental'],
      education: ['education', 'learning', 'teaching', 'knowledge', 'skill', 'training'],
      philosophy: ['philosophy', 'ethics', 'moral', 'wisdom', 'meaning', 'existence']
    }

    const textLower = text.toLowerCase()
    const foundTopics = []

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      const matchCount = keywords.reduce((count, keyword) => {
        return count + (textLower.match(new RegExp(keyword, 'g')) || []).length
      }, 0)

      if (matchCount > 3) {
        foundTopics.push(topic)
      }
    })

    return foundTopics.slice(0, 5) // Limit to top 5 topics
  }

  /**
   * Determine content difficulty level
   * @param {string} text - Text to analyze
   * @returns {string} Difficulty level
   */
  determineDifficulty(text) {
    // Simple difficulty analysis based on text characteristics
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = text.split(' ')
    const avgWordsPerSentence = words.length / sentences.length
    const avgCharsPerWord = text.replace(/\s+/g, '').length / words.length

    // Simple heuristic
    if (avgWordsPerSentence < 15 && avgCharsPerWord < 5) {
      return 'BEGINNER'
    } else if (avgWordsPerSentence < 25 && avgCharsPerWord < 7) {
      return 'INTERMEDIATE'
    } else {
      return 'ADVANCED'
    }
  }
}

export default new ContentProcessor()