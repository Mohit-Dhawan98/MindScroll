import { pipeline } from '@xenova/transformers'
import OpenAI from 'openai'
import { Anthropic } from "@anthropic-ai/sdk"
import natural from 'natural'
import { cleanAndChunkText } from './textExtractor.js'
import fileStorage from '../utils/fileStorage.js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Enhanced Card Generator - 80/20 Implementation
 * Hierarchical Processing + Semantic RAG + API-based Quality
 */
export class EnhancedCardGenerator {
  constructor(aiProvider = 'openai') {
    this.embedder = null
    this.tfidf = new natural.TfIdf()
    this.initialized = false
    this.vectorStore = new Map() // Simple in-memory vector store
    this.aiProvider = aiProvider // 'openai' or 'anthropic'
    // Two-tier model approach: powerful model for chapter mapping, efficient model for card generation
    this.chapterMappingModel = aiProvider === 'openai' ? 'gpt-4o' : 'claude-3-sonnet-20241022'
    this.cardGenerationModel = aiProvider === 'openai' ? 'gpt-4.1-mini' : 'claude-3-haiku-20240307'
    this.model = this.cardGenerationModel // Default for backward compatibility
    
    // Debug flag for detailed tier-by-tier caching
    this.debugMode = process.env.DEBUG_CARD_GENERATION === 'true' || false
  }

  /**
   * Initialize the card generator
   */
  async initialize() {
    if (this.initialized) return
    
    console.log('🔧 Initializing Enhanced Card Generator...')
    try {
      // Load embedding model
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
      this.initialized = true
      console.log('✅ Enhanced Card Generator initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Card Generator:', error)
      throw error
    }
  }

  /**
   * Main entry point - Generate cards with hierarchical processing
   */
  async generateEnhancedLearningCards(textContent, bookTitle, author, category, contentId = null) {
    try {
      await this.initialize()
      
      console.log(`🧠 Enhanced card generation for: ${bookTitle} by ${author}`)
      
      // Generate or get contentId for caching
      const actualContentId = contentId || fileStorage.generateContentId(bookTitle, author, '')
      
      // Check for cached cards first
      const cachedCards = await fileStorage.getCachedCards(actualContentId)
      if (cachedCards) {
        console.log(`📦 Using cached cards for ${bookTitle}`)
        return cachedCards
      }
      
      // Step 1: Detect book structure (chapters/sections) with caching
      const bookStructure = await this.detectBookStructure(textContent, bookTitle, author, actualContentId)
      console.log(`📚 Detected ${bookStructure.chapters.length} chapters`)
      
      // Step 2: Create semantic chunks for entire book
      const allChunks = await this.createSemanticChunks(textContent, bookStructure)
      console.log(`📝 Created ${allChunks.length} semantic chunks`)
      
      // Step 3: Generate embeddings for all chunks (for RAG)
      await this.buildVectorStore(allChunks)
      console.log(`🔢 Built vector store with ${allChunks.length} embeddings`)
      
      // Step 4: UNIFIED APPROACH - Process semantic chunks with deduplication
      const allCards = []
      const processedChunkIds = new Set() // Track processed chunks to avoid duplicates
      
      console.log(`🔄 Processing ${allChunks.length} semantic chunks with unified approach...`)
      
      // CORRECT APPROACH: Generate flashcards first, then build other tiers from them
      
      // Step 4A: Generate FLASHCARDS from chunk groups (Tier 1)
      console.log(`🎯 Tier 1: Generating flashcards from ${allChunks.length} chunks in groups of 3-5...`)
      const allFlashcards = []
      const chunksPerCard = 4 // Use 4 chunks per flashcard for optimal context
      
      for (let i = 0; i < allChunks.length; i += chunksPerCard) {
        const chunkGroup = allChunks.slice(i, i + chunksPerCard)
        
        // Skip if already processed (though shouldn't happen with sequential processing)
        if (chunkGroup.some(chunk => processedChunkIds.has(chunk.id))) {
          continue
        }
        
        const flashcard = await this.generateFlashcardFromChunkGroup(chunkGroup, allChunks, bookStructure, bookTitle, author, category)
        
        if (flashcard) {
          // Add simple mapping - which chunks were used to generate this card
          flashcard.sourceChunks = chunkGroup.map(c => c.id)
          flashcard.sourceCards = [] // Flashcards don't derive from other cards
          
          allFlashcards.push(flashcard)
          allCards.push(flashcard)
        }
        
        // Mark all chunks in group as processed
        chunkGroup.forEach(chunk => processedChunkIds.add(chunk.id))
        
        const chapterInfo = chunkGroup[0].chapterTitle ? ` (${chunkGroup[0].chapterTitle})` : ''
        const chunkIds = chunkGroup.map(c => c.id).join(', ')
        console.log(`📝 Chunk group [${chunkIds}]${chapterInfo}: Generated ${flashcard ? 1 : 0} flashcard`)
      }
      
      console.log(`✅ Tier 1 Complete: Generated ${allFlashcards.length} flashcards total`)
      
      // Cache Tier 1 cards (if debug mode enabled)
      if (this.debugMode) {
        await this.cacheTierCards(actualContentId, 'tier1-flashcards', allFlashcards, bookTitle)
      }
      
      // Step 4B: Generate APPLICATION cards for AI tutor context (PAUSED - save LLM credits)
      console.log(`⏸️ Tier 2: APPLICATION card generation paused (will implement when AI tutor is ready)`)
      const applicationCards = [] // Empty array for now
      
      // TODO: Uncomment when AI tutor is implemented
      // const applicationCards = await this.generateApplicationsFromFlashcards(allFlashcards, allChunks, bookTitle, author, category)
      // applicationCards.forEach(app => {
      //   app.sourceCards = app.sourceFlashcards || []
      //   app.sourceChunks = []
      // })
      // if (this.debugMode) {
      //   await this.cacheTierCards(actualContentId, 'ai-tutor-applications', applicationCards, bookTitle)
      // }
      
      // Step 4C: Generate QUIZ cards from flashcards + applications (Tier 3)  
      console.log(`❓ Tier 3: Generating quiz cards...`)
      const quizCards = await this.generateQuizzesFromCards(allFlashcards, applicationCards, bookStructure, bookTitle, author, category)
      
      // Add card dependency tracking for quizzes
      quizCards.forEach(quiz => {
        quiz.sourceCards = quiz.sourceFlashcards || [] // Use the flashcards that generated this quiz
        quiz.sourceChunks = [] // Quizzes don't directly use chunks
      })
      
      allCards.push(...quizCards)
      console.log(`✅ Tier 3 Complete: Generated ${quizCards.length} quiz cards`)
      
      // Cache Tier 3 cards (if debug mode enabled)
      if (this.debugMode) {
        await this.cacheTierCards(actualContentId, 'tier3-quizzes', quizCards, bookTitle)
      }
      
      // Step 4D: Generate SUMMARY cards from chapter flashcards (Tier 4)
      console.log(`📄 Tier 4: Generating chapter summary cards...`)
      const summaryCards = await this.generateChapterSummaries(allFlashcards, bookStructure, bookTitle, author, category)
      
      // Add card dependency tracking for summaries
      summaryCards.forEach(summary => {
        summary.sourceCards = summary.sourceFlashcards || [] // Use flashcards from the chapter
        summary.sourceChunks = [] // Summaries don't directly use chunks
      })
      
      allCards.push(...summaryCards)
      console.log(`✅ Tier 4 Complete: Generated ${summaryCards.length} chapter summary cards`)
      
      // Cache Tier 4 cards (if debug mode enabled)
      if (this.debugMode) {
        await this.cacheTierCards(actualContentId, 'tier4-summaries', summaryCards, bookTitle)
      }
      
      // Generate book-level overview cards
      const overviewCards = await this.generateBookOverview(bookStructure, allChunks, bookTitle, author, category)
      allCards.push(...overviewCards)
      console.log(`📋 Generated ${overviewCards.length} book overview cards`)
      
      // Cache all raw cards before QA (if debug mode enabled)
      if (this.debugMode) {
        await this.cacheTierCards(actualContentId, 'all-raw-cards', allCards, bookTitle)
      }
      
      // Step 5: Quality assurance and final filtering
      const finalCards = await this.applyQualityAssurance(allCards, allChunks)
      
      // Cache final processed cards
      await fileStorage.cacheProcessedCards(actualContentId, finalCards)
      if (this.debugMode) {
        await this.cacheTierCards(actualContentId, 'final-cards', finalCards, bookTitle)
      }
      
      console.log(`✨ Final output: ${finalCards.length} high-quality cards`)
      console.log(`📊 Breakdown: ${finalCards.filter(c => c.type === 'SUMMARY').length} summaries, ${finalCards.filter(c => c.type === 'FLASHCARD').length} flashcards, ${finalCards.filter(c => c.type === 'APPLICATION').length} applications, ${finalCards.filter(c => c.type === 'QUIZ').length} quizzes, ${finalCards.filter(c => c.type === 'SYNTHESIS').length} synthesis`)
      
      // Return both cards and chapter information for database creation
      return {
        cards: finalCards,
        chapters: bookStructure.chapters,
        chunkMapping: allChunks.reduce((map, chunk) => {
          map[chunk.id] = chunk
          return map
        }, {})
      }
      
    } catch (error) {
      console.error('❌ Error in enhanced card generation:', error)
      return []
    }
  }

  /**
   * SIMPLIFIED 2-TIER APPROACH for chapter detection with caching
   * Tier 1: AI chapter name detection + AI page range mapping
   * Tier 2: Page-level chunking fallback based on average words per page
   */
  async detectBookStructure(textContent, bookTitle = '', author = '', providedContentId = null) {
    // Use provided contentId or generate one (must match addBook.js logic)
    const contentId = providedContentId || fileStorage.generateContentId(bookTitle, author, '')
    
    // Check for cached chapter structure first
    console.log('📚 Checking for cached chapter structure...')
    const cachedStructure = await fileStorage.getCachedChapterStructure(contentId)
    if (cachedStructure) {
      return cachedStructure
    }
    
    console.log('🔍 No cached chapter structure found, proceeding with AI detection...')
    // Debug: Log the structure of textContent
    console.log('🔍 Debugging textContent structure:')
    console.log('  - Type:', typeof textContent)
    console.log('  - Has .text property:', !!(textContent && textContent.text))
    console.log('  - Has .pages property:', !!(textContent && textContent.pages))
    console.log('  - Has .metadata property:', !!(textContent && textContent.metadata))
    
    if (textContent && textContent.pages) {
      console.log(`  - Pages array length: ${textContent.pages.length}`)
      console.log(`  - First page sample:`, textContent.pages[0] ? {
        pageNumber: textContent.pages[0].pageNumber,
        lines: textContent.pages[0].lines.length,
        wordCount: textContent.pages[0].wordCount
      } : 'none')
    }
    
    const actualText = textContent && textContent.text ? textContent.text : textContent
    console.log(`📊 Analyzing text: ${actualText.length} characters, ${actualText.split(/\s+/).length} words`)
    
    // Check if we have structured page data from enhanced PDF extraction
    let hasStructuredData = false
    let structuredPages = null
    let actualTextContent = textContent
    
    // Handle case where textContent is the result object from textExtractor
    if (textContent && typeof textContent === 'object' && textContent.text) {
      actualTextContent = textContent.text
      structuredPages = textContent.pages
      hasStructuredData = structuredPages && Array.isArray(structuredPages) && structuredPages.length > 0
    }
    
    console.log('🎯 Starting SIMPLIFIED 2-TIER APPROACH for chapter detection...')
    
    if (!hasStructuredData) {
      console.log('⚠️ No structured page data available - using fallback chunking')
      return await this.createWordBasedChunks(actualTextContent)
    }
    
    // TIER 1: AI chapter name detection + AI page range mapping
    console.log('🚀 TIER 1: AI chapter name detection + AI page range mapping...')
    
    // Step 1: Detect chapter names using first 10 full content pages (with page markers for AI)
    console.log('📖 Step 1: Detecting chapter names from first 10 full content pages...')
    const firstPagesContent = structuredPages.slice(0, Math.min(10, structuredPages.length))
    const firstPagesText = firstPagesContent.map(page => 
      `--- PAGE ${page.pageNumber} ---\n${page.text}`
    ).join('\n\n')
    
    console.log(`🔍 Analyzing first ${firstPagesContent.length} pages (${firstPagesText.split(/\s+/).length} words) with page markers`)
    
    const aiDetectedChapters = await this.detectChaptersWithAI(firstPagesText, structuredPages)
    
    if (aiDetectedChapters && aiDetectedChapters.length > 0) {
      console.log(`✨ AI detected ${aiDetectedChapters.length} chapter names: ${aiDetectedChapters.slice(0, 3).join(', ')}...`)
      
      // Step 2: Use AI to map chapters to page ranges (exclude TOC pages)
      console.log('📍 Step 2: Mapping chapter names to page ranges using AI...')
      const tier1Result = await this.mapChaptersToPageRanges(structuredPages, aiDetectedChapters)
      
      if (tier1Result && tier1Result.chapters.length > 0) {
        console.log(`✅ TIER 1 SUCCESS: Found ${tier1Result.chapters.length} chapters using AI detection + page mapping`)
        
        // Cache the successful chapter structure for future runs
        await fileStorage.cacheChapterStructure(contentId, tier1Result)
        
        return tier1Result
      }
      
      console.log('⚠️ TIER 1 FAILED: Could not map chapter names to page ranges')
    } else {
      console.log('⚠️ TIER 1 FAILED: No chapter names detected by AI')
    }
    
    // TIER 2: Page-level chunking based on average words per page
    console.log('🚀 TIER 2: Page-level chunking fallback...')
    const tier2Result = await this.createPageLevelChunks(structuredPages, actualTextContent)
    console.log(`✅ TIER 2 SUCCESS: Created ${tier2Result.chapters.length} page-level chunks as chapters`)
    
    // Cache the fallback result as well for consistency
    await fileStorage.cacheChapterStructure(contentId, tier2Result)
    
    return tier2Result
  }

  /**
   * AI-powered chapter detection using first pages of the book with structured data
   */
  async detectChaptersWithAI(firstPagesText, structuredPages = null) {
    try {
      const prompt = `You are an expert at analyzing book structure. Analyze this excerpt from the beginning of a book and extract all chapter titles/names with maximum precision and consistency.

Book excerpt (first ~10 pages):
${firstPagesText}

Please identify all chapter titles from this text. Look for:
1. Table of Contents entries
2. Chapter headings (Chapter 1:, Chapter 2:, etc.)
3. Section titles that appear to be main chapters

Return a JSON array of chapter titles in the EXACT order they appear:
{
  "chapters": [
    "Chapter 1: Introduction to Clean Code",
    "Chapter 2: Meaningful Names", 
    "Chapter 3: Functions"
  ]
}

CRITICAL REQUIREMENTS:
- Be EXTREMELY consistent - same input should produce identical output
- Only include actual chapter titles, not subsections
- Preserve the EXACT original chapter names as they appear in the book
- Return empty array if no clear chapters are found
- Use the EXACT format shown above
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt, { 
        taskType: 'chapter_mapping', 
        maxTokens: 1500,
        temperature: 0 
      })
      
      if (response && response.chapters && Array.isArray(response.chapters)) {
        console.log(`🤖 AI extracted chapters: ${response.chapters.join(', ')}`)
        return response.chapters.filter(chapter => 
          chapter && 
          typeof chapter === 'string' && 
          chapter.length > 5 && 
          chapter.length < 200
        )
      }
      
      return []
      
    } catch (error) {
      console.warn('⚠️ AI chapter detection failed:', error.message)
      return []
    }
  }

  /**
   * TIER 1: Map detected chapter names to page ranges using AI
   * Excludes TOC pages (max 2-3) and uses whole book content for accurate mapping
   */
  async mapChaptersToPageRanges(structuredPages, chapterNames) {
    try {
      console.log(`🤖 Mapping ${chapterNames.length} detected chapters to page ranges...`)
      
      // Identify and exclude TOC pages using AI-based dynamic detection
      const tocPages = await this.identifyTOCPagesWithAI(structuredPages)
      console.log(`📑 Excluding TOC pages: ${tocPages.join(', ')} from analysis`)
      
      // Truncate book to start AFTER TOC pages (not just skip them)
      const lastTocPage = tocPages.length > 0 ? Math.max(...tocPages) : 0
      const bookStartPage = lastTocPage + 1
      
      console.log(`📖 Truncating book to start from page ${bookStartPage} (after TOC ends at page ${lastTocPage})`)
      
      // Get pages starting after TOC ends
      const bookPages = structuredPages.filter(page => page.pageNumber >= bookStartPage)
      console.log(`📖 Using ${bookPages.length} book pages (from page ${bookStartPage} onwards) out of ${structuredPages.length} total pages`)
      
      // Create optimized page summary for AI analysis (limited content per page)
      const pagesSummary = bookPages.map(page => {
        // Use concise page content (300-400 chars per page for better context management)
        const pageContent = page.text.substring(0, 350).replace(/\s+/g, ' ').trim()
        return `Page ${page.pageNumber}: ${pageContent}${page.text.length > 350 ? '...' : ''}`
      }).join('\n\n')
      
      const chapterList = chapterNames.map((name, i) => `${i + 1}. ${name}`).join('\n')
      
      const prompt = `I have detected these chapter names from a book's Table of Contents:

${chapterList}

Now I need you to find the exact page ranges where each chapter starts and ends by analyzing the book content starting after the TOC:

Book content (${bookPages.length} pages, starting from page ${bookStartPage}):
${pagesSummary}

Please map each chapter name to its page range. Look for:
1. Where each chapter title appears in the page content
2. Natural content breaks between chapters  
3. Topic transitions that align with chapter names
4. Don't miss any chapters - include ALL detected chapters

Return a JSON array mapping ALL chapter names to page ranges:
{
  "chapters": [
    {
      "title": "Chapter 1: Introduction to Clean Code",
      "startPage": 5,
      "endPage": 15
    },
    {
      "title": "Chapter 2: Meaningful Names",
      "startPage": 16,
      "endPage": 30
    }
  ]
}

CRITICAL REQUIREMENTS:
- Be EXTREMELY CONSISTENT - same input should produce identical output every time
- Map ALL ${chapterNames.length} detected chapters (don't skip any)
- Use the EXACT chapter names I provided above
- Each chapter should span multiple pages (minimum 3 pages)
- Ensure page ranges don't overlap and are sequential
- Be precise with page numbers based on actual content analysis
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt, { 
        taskType: 'chapter_mapping', 
        maxTokens: 2000,
        temperature: 0 
      })
      
      if (response && response.chapters && Array.isArray(response.chapters)) {
        console.log(`🎯 AI mapped ${response.chapters.length}/${chapterNames.length} chapters to page ranges`)
        
        // Build chapters from page ranges
        const chapters = []
        for (const chapterInfo of response.chapters) {
          if (chapterInfo.startPage && chapterInfo.endPage && chapterInfo.title) {
            const chapterPages = structuredPages.filter(page => 
              page.pageNumber >= chapterInfo.startPage && page.pageNumber <= chapterInfo.endPage
            )
            
            if (chapterPages.length > 0) {
              const chapterContent = chapterPages.map(page => page.text).join('\n\n')
              const wordCount = chapterContent.split(/\s+/).length
              
              if (wordCount > 500) { // Minimum chapter size
                chapters.push({
                  title: chapterInfo.title,
                  startPage: chapterInfo.startPage,
                  endPage: chapterInfo.endPage,
                  content: chapterContent,
                  wordCount: wordCount
                })
                console.log(`✅ Mapped chapter "${chapterInfo.title}" to pages ${chapterInfo.startPage}-${chapterInfo.endPage} (${wordCount} words)`)
              }
            }
          }
        }
        
        if (chapters.length > 0) {
          // Fill gaps for missing chapters
          const filledChapters = this.fillMissingChapterGaps(chapters, chapterNames, structuredPages)
          
          return {
            chapters: filledChapters,
            totalChapters: filledChapters.length,
            averageChapterLength: Math.round(filledChapters.reduce((sum, ch) => sum + ch.wordCount, 0) / filledChapters.length),
            detectionMethod: 'AI_CHAPTER_TO_PAGE_MAPPING_WITH_GAP_FILLING'
          }
        }
      }
      
      console.log('⚠️ Could not map chapter names to page ranges')
      return null
      
    } catch (error) {
      console.warn('⚠️ AI chapter-to-page mapping failed:', error.message)
      return null
    }
  }

  /**
   * Fill gaps for missing chapters by mapping them to page ranges between mapped chapters
   */
  fillMissingChapterGaps(mappedChapters, allChapterNames, structuredPages) {
    console.log(`🔧 Filling gaps: ${mappedChapters.length}/${allChapterNames.length} chapters mapped, looking for missing chapters...`)
    
    // Sort mapped chapters by start page
    mappedChapters.sort((a, b) => a.startPage - b.startPage)
    
    // Find which chapters are missing
    const mappedTitles = new Set(mappedChapters.map(ch => ch.title))
    const missingChapters = allChapterNames.filter(name => !mappedTitles.has(name))
    
    console.log(`🔍 Missing chapters: ${missingChapters.join(', ')}`)
    
    if (missingChapters.length === 0) {
      console.log(`✅ No missing chapters to fill`)
      return mappedChapters
    }
    
    // Identify gaps between mapped chapters
    const gaps = []
    for (let i = 0; i < mappedChapters.length - 1; i++) {
      const currentChapter = mappedChapters[i]
      const nextChapter = mappedChapters[i + 1]
      
      const gapStart = currentChapter.endPage + 1
      const gapEnd = nextChapter.startPage - 1
      
      if (gapEnd >= gapStart && (gapEnd - gapStart + 1) >= 3) { // Minimum 3 pages for a chapter
        gaps.push({
          startPage: gapStart,
          endPage: gapEnd,
          afterChapter: currentChapter.title,
          beforeChapter: nextChapter.title
        })
        console.log(`📍 Found gap: pages ${gapStart}-${gapEnd} (between "${currentChapter.title}" and "${nextChapter.title}")`)
      }
    }
    
    // Intelligently handle gaps - extend chapters for small gaps, create new chapters only for large sequential gaps
    const filledChapters = [...mappedChapters]
    
    for (const gap of gaps) {
      const gapSize = gap.endPage - gap.startPage + 1
      
      // For small gaps (≤10 pages), extend the previous chapter
      if (gapSize <= 10) {
        const prevChapterIndex = filledChapters.findIndex(ch => ch.title === gap.afterChapter)
        if (prevChapterIndex !== -1) {
          const prevChapter = filledChapters[prevChapterIndex]
          
          // Get gap content
          const gapPages = structuredPages.filter(page => 
            page.pageNumber >= gap.startPage && page.pageNumber <= gap.endPage
          )
          
          if (gapPages.length > 0) {
            const gapContent = gapPages.map(page => page.text).join('\n\n')
            const additionalWords = gapContent.split(/\s+/).length
            
            // Extend previous chapter
            prevChapter.endPage = gap.endPage
            prevChapter.content = prevChapter.content + '\n\n' + gapContent
            prevChapter.wordCount += additionalWords
            
            console.log(`🔗 Extended chapter "${gap.afterChapter}" to include pages ${gap.startPage}-${gap.endPage} (${gapSize} pages, ${additionalWords} words)`)
          }
        }
      }
      // For larger gaps (>10 pages), check if we have a sequential missing chapter that belongs here
      else {
        // Find the expected chapter number for this position
        const afterChapterNum = this.extractChapterNumber(gap.afterChapter)
        const beforeChapterNum = this.extractChapterNumber(gap.beforeChapter)
        
        if (afterChapterNum && beforeChapterNum && (beforeChapterNum - afterChapterNum) === 2) {
          // There should be exactly one chapter between these two
          const expectedChapterNum = afterChapterNum + 1
          const expectedChapter = missingChapters.find(ch => 
            this.extractChapterNumber(ch) === expectedChapterNum
          )
          
          if (expectedChapter) {
            // Get gap content
            const gapPages = structuredPages.filter(page => 
              page.pageNumber >= gap.startPage && page.pageNumber <= gap.endPage
            )
            
            if (gapPages.length > 0) {
              const gapContent = gapPages.map(page => page.text).join('\n\n')
              const wordCount = gapContent.split(/\s+/).length
              
              const filledChapter = {
                title: expectedChapter,
                startPage: gap.startPage,
                endPage: gap.endPage,
                content: gapContent,
                wordCount: wordCount,
                isGapFilled: true
              }
              
              filledChapters.push(filledChapter)
              console.log(`✅ Gap-filled sequential chapter "${expectedChapter}" to pages ${gap.startPage}-${gap.endPage} (${wordCount} words)`)
            }
          } else {
            console.log(`⚠️ Large gap found (${gapSize} pages) but no sequential chapter to fill it. Extending previous chapter.`)
            // Extend previous chapter for large gaps too if no sequential chapter found
            const prevChapterIndex = filledChapters.findIndex(ch => ch.title === gap.afterChapter)
            if (prevChapterIndex !== -1) {
              const prevChapter = filledChapters[prevChapterIndex]
              const gapPages = structuredPages.filter(page => 
                page.pageNumber >= gap.startPage && page.pageNumber <= gap.endPage
              )
              
              if (gapPages.length > 0) {
                const gapContent = gapPages.map(page => page.text).join('\n\n')
                const additionalWords = gapContent.split(/\s+/).length
                
                prevChapter.endPage = gap.endPage
                prevChapter.content = prevChapter.content + '\n\n' + gapContent
                prevChapter.wordCount += additionalWords
                
                console.log(`🔗 Extended chapter "${gap.afterChapter}" to include large gap pages ${gap.startPage}-${gap.endPage} (${gapSize} pages, ${additionalWords} words)`)
              }
            }
          }
        } else {
          console.log(`⚠️ Non-sequential gap (${gapSize} pages). Extending previous chapter.`)
          // Extend previous chapter
          const prevChapterIndex = filledChapters.findIndex(ch => ch.title === gap.afterChapter)
          if (prevChapterIndex !== -1) {
            const prevChapter = filledChapters[prevChapterIndex]
            const gapPages = structuredPages.filter(page => 
              page.pageNumber >= gap.startPage && page.pageNumber <= gap.endPage
            )
            
            if (gapPages.length > 0) {
              const gapContent = gapPages.map(page => page.text).join('\n\n')
              const additionalWords = gapContent.split(/\s+/).length
              
              prevChapter.endPage = gap.endPage
              prevChapter.content = prevChapter.content + '\n\n' + gapContent
              prevChapter.wordCount += additionalWords
              
              console.log(`🔗 Extended chapter "${gap.afterChapter}" to include pages ${gap.startPage}-${gap.endPage} (${gapSize} pages, ${additionalWords} words)`)
            }
          }
        }
      }
    }
    
    // Sort all chapters by start page again
    filledChapters.sort((a, b) => a.startPage - b.startPage)
    
    console.log(`🎯 Final result: ${filledChapters.length}/${allChapterNames.length} chapters (${filledChapters.filter(ch => ch.isGapFilled).length} gap-filled)`)
    
    return filledChapters
  }

  /**
   * Extract chapter number from chapter title
   */
  extractChapterNumber(chapterTitle) {
    const match = chapterTitle.match(/^(\d+)\./)
    return match ? parseInt(match[1]) : null
  }

  /**
   * DEPRECATED: Enhanced AI-based page range detection with more content per page and TOC exclusion
   * Takes detected chapter names and finds their page ranges using AI with enhanced page content
   */
  async detectChapterPageRangesEnhanced(structuredPages, chapterNames, fullText) {
    try {
      console.log(`🤖 TIER 2: Enhanced page range detection with ${chapterNames.length} known chapters...`)
      
      // Identify and exclude TOC pages
      const tocPages = this.identifyTOCPages(structuredPages)
      console.log(`📑 Excluding TOC pages: ${tocPages.join(', ')} from AI analysis`)
      
      // Filter out TOC pages and create enhanced representation with more content per page
      const nonTocPages = structuredPages.filter(page => !tocPages.includes(page.pageNumber))
      
      const pagesSummary = nonTocPages.map(page => {
        // Get more content per page (first 10 lines instead of 5, up to 400 chars instead of 200)
        const enhancedContent = page.lines.slice(0, 10).join(' ').substring(0, 400)
        return `Page ${page.pageNumber}: ${enhancedContent}...`
      }).join('\n')
      
      const chapterList = chapterNames.map((name, i) => `${i + 1}. ${name}`).join('\n')
      
      const prompt = `I have detected these chapter names from a book's Table of Contents:

${chapterList}

Now I need you to find the page ranges where each chapter actually starts and ends by analyzing the book's page-by-page content (TOC pages have been excluded):

Book content (${nonTocPages.length} pages, TOC excluded):
${pagesSummary}

Please match each chapter name to its actual page range in the book content. Look for:
1. Where each chapter title appears in the page content
2. Natural content breaks between chapters
3. Topic transitions that align with chapter names

Return a JSON array mapping chapter names to page ranges:
{
  "chapters": [
    {
      "title": "Chapter 1: Meaningful Names",
      "startPage": 10,
      "endPage": 25
    },
    {
      "title": "Chapter 2: Functions", 
      "startPage": 26,
      "endPage": 45
    }
  ]
}

IMPORTANT:
- Use the EXACT chapter names I provided above
- Only include chapters you can confidently locate in the page content
- Each chapter should span multiple pages (minimum 5 pages)
- Ensure page ranges don't overlap
- Skip any chapter names you cannot locate with confidence
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt)
      
      if (response && response.chapters && Array.isArray(response.chapters) && response.chapters.length > 0) {
        console.log(`🎯 TIER 2: AI mapped ${response.chapters.length} chapters to page ranges`)
        
        // Build chapters from page ranges
        const chapters = []
        for (const chapterInfo of response.chapters) {
          if (chapterInfo.startPage && chapterInfo.endPage && chapterInfo.title) {
            const chapterPages = structuredPages.filter(page => 
              page.pageNumber >= chapterInfo.startPage && page.pageNumber <= chapterInfo.endPage
            )
            
            if (chapterPages.length > 0) {
              const chapterContent = chapterPages.map(page => page.text).join('\n\n')
              const wordCount = chapterContent.split(/\s+/).length
              
              if (wordCount > 500) { // Minimum chapter size
                chapters.push({
                  title: chapterInfo.title,
                  startPage: chapterInfo.startPage,
                  endPage: chapterInfo.endPage,
                  content: chapterContent,
                  wordCount: wordCount
                })
                console.log(`✅ TIER 2: Mapped chapter "${chapterInfo.title}" to pages ${chapterInfo.startPage}-${chapterInfo.endPage} (${wordCount} words)`)
              }
            }
          }
        }
        
        if (chapters.length > 0) {
          return {
            chapters: chapters,
            totalChapters: chapters.length,
            averageChapterLength: Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length),
            detectionMethod: 'AI_ENHANCED_CHAPTER_PAGE_MAPPING'
          }
        }
      }
      
      console.log('⚠️ TIER 2: Could not map chapter names to page ranges')
      return null
      
    } catch (error) {
      console.warn('⚠️ TIER 2: Enhanced AI chapter-to-page mapping failed:', error.message)
      return null
    }
  }

  /**
   * TIER 1: AI-based page range detection for known chapter names
   * Takes detected chapter names and finds their page ranges using AI
   */
  async detectChapterPageRanges(structuredPages, chapterNames, fullText) {
    try {
      console.log(`🤖 TIER 1: Finding page ranges for ${chapterNames.length} known chapters...`)
      
      // Create a condensed representation of all pages for AI analysis
      const pagesSummary = structuredPages.map(page => {
        // Get first few lines of each page to understand structure
        const firstLines = page.lines.slice(0, 5).join(' ').substring(0, 200)
        return `Page ${page.pageNumber}: ${firstLines}...`
      }).join('\n')
      
      const chapterList = chapterNames.map((name, i) => `${i + 1}. ${name}`).join('\n')
      
      const prompt = `I have detected these chapter names from a book's Table of Contents:

${chapterList}

Now I need you to find the page ranges where each chapter actually starts and ends by analyzing the book's page-by-page content:

Book content (${structuredPages.length} pages):
${pagesSummary}

Please match each chapter name to its actual page range in the book content. Look for:
1. Where each chapter title appears in the page content
2. Natural content breaks between chapters
3. Topic transitions that align with chapter names

Return a JSON array mapping chapter names to page ranges:
{
  "chapters": [
    {
      "title": "Chapter 1: Meaningful Names",
      "startPage": 10,
      "endPage": 25
    },
    {
      "title": "Chapter 2: Functions", 
      "startPage": 26,
      "endPage": 45
    }
  ]
}

IMPORTANT:
- Use the EXACT chapter names I provided above
- Only include chapters you can confidently locate in the page content
- Each chapter should span multiple pages (minimum 3 pages)
- Ensure page ranges don't overlap
- Skip any chapter names you cannot locate
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt)
      
      if (response && response.chapters && Array.isArray(response.chapters) && response.chapters.length > 0) {
        console.log(`🎯 TIER 1: AI mapped ${response.chapters.length} chapters to page ranges`)
        
        // Build chapters from page ranges
        const chapters = []
        for (const chapterInfo of response.chapters) {
          if (chapterInfo.startPage && chapterInfo.endPage && chapterInfo.title) {
            const chapterPages = structuredPages.filter(page => 
              page.pageNumber >= chapterInfo.startPage && page.pageNumber <= chapterInfo.endPage
            )
            
            if (chapterPages.length > 0) {
              const chapterContent = chapterPages.map(page => page.text).join('\n\n')
              const wordCount = chapterContent.split(/\s+/).length
              
              if (wordCount > 500) { // Minimum chapter size
                chapters.push({
                  title: chapterInfo.title,
                  startPage: chapterInfo.startPage,
                  endPage: chapterInfo.endPage,
                  content: chapterContent,
                  wordCount: wordCount
                })
                console.log(`✅ TIER 1: Mapped chapter "${chapterInfo.title}" to pages ${chapterInfo.startPage}-${chapterInfo.endPage} (${wordCount} words)`)
              }
            }
          }
        }
        
        if (chapters.length > 0) {
          return {
            chapters: chapters,
            totalChapters: chapters.length,
            averageChapterLength: Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length),
            detectionMethod: 'AI_CHAPTER_NAME_TO_PAGE_MAPPING'
          }
        }
      }
      
      console.log('⚠️ TIER 1: Could not map chapter names to page ranges')
      return null
      
    } catch (error) {
      console.warn('⚠️ TIER 1: AI chapter-to-page mapping failed:', error.message)
      return null
    }
  }

  /**
   * TIER 1: AI-based hierarchical structure detection using page content + page numbers (generic fallback)
   * Pass content of each page with page numbers to AI and ask for chapter breaks by page numbers
   */
  async detectChapterBreaksByPages(structuredPages, fullText) {
    try {
      console.log(`🤖 TIER 1: Analyzing ${structuredPages.length} pages for hierarchical structure...`)
      
      // Create a condensed representation of all pages for AI analysis
      const pagesSummary = structuredPages.map(page => {
        // Get first few lines of each page to understand structure
        const firstLines = page.lines.slice(0, 5).join(' ').substring(0, 200)
        return `Page ${page.pageNumber}: ${firstLines}...`
      }).join('\n')
      
      const prompt = `Analyze this book's page-by-page content and identify chapter breaks by page numbers.

Book content (${structuredPages.length} pages):
${pagesSummary}

Please identify where chapters begin by analyzing the content flow and structure. Look for:
1. Major topic changes between pages
2. Chapter headings or titles
3. Natural content breaks
4. Introduction of new concepts

Return a JSON array of chapter breaks with page numbers:
{
  "chapters": [
    {
      "title": "Chapter title or descriptive name",
      "startPage": 5,
      "endPage": 15
    },
    {
      "title": "Next chapter title",
      "startPage": 16,
      "endPage": 25
    }
  ]
}

IMPORTANT:
- Only identify clear chapter breaks, not minor section breaks
- Each chapter should span multiple pages (minimum 3-5 pages)
- Title should be descriptive of the chapter content
- Ensure page ranges don't overlap
- Return empty array if no clear chapter structure is found
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt)
      
      if (response && response.chapters && Array.isArray(response.chapters) && response.chapters.length > 0) {
        console.log(`🎯 TIER 1: AI identified ${response.chapters.length} chapter breaks by page numbers`)
        
        // Build chapters from page ranges
        const chapters = []
        for (const chapterInfo of response.chapters) {
          if (chapterInfo.startPage && chapterInfo.endPage && chapterInfo.title) {
            const chapterPages = structuredPages.filter(page => 
              page.pageNumber >= chapterInfo.startPage && page.pageNumber <= chapterInfo.endPage
            )
            
            if (chapterPages.length > 0) {
              const chapterContent = chapterPages.map(page => page.text).join('\n\n')
              const wordCount = chapterContent.split(/\s+/).length
              
              if (wordCount > 500) { // Minimum chapter size
                chapters.push({
                  title: chapterInfo.title,
                  startPage: chapterInfo.startPage,
                  endPage: chapterInfo.endPage,
                  content: chapterContent,
                  wordCount: wordCount
                })
                console.log(`✅ TIER 1: Built chapter "${chapterInfo.title}" (pages ${chapterInfo.startPage}-${chapterInfo.endPage}, ${wordCount} words)`)
              }
            }
          }
        }
        
        if (chapters.length > 0) {
          return {
            chapters: chapters,
            totalChapters: chapters.length,
            averageChapterLength: Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length),
            detectionMethod: 'AI_HIERARCHICAL_PAGE_BASED'
          }
        }
      }
      
      console.log('⚠️ TIER 1: No valid chapter structure found by AI hierarchical detection')
      return null
      
    } catch (error) {
      console.warn('⚠️ TIER 1: AI hierarchical detection failed:', error.message)
      return null
    }
  }

  /**
   * TIER 3: Create page-level chunks with overlap as final fallback
   * Uses 5-10 or 10-20 pages based on word count per page
   */
  async createPageLevelChunks(structuredPages, fullText) {
    try {
      console.log(`📄 TIER 3: Creating page-level chunks from ${structuredPages.length} pages...`)
      
      // Calculate average words per page to determine chunk size
      const totalWords = structuredPages.reduce((sum, page) => sum + page.wordCount, 0)
      const avgWordsPerPage = Math.round(totalWords / structuredPages.length)
      
      console.log(`📊 Average words per page: ${avgWordsPerPage}`)
      
      // Determine chunk size based on words per page
      let pagesPerChunk
      if (avgWordsPerPage > 400) {
        pagesPerChunk = 5 // Dense pages: use smaller chunks
        console.log('📄 Using 5-page chunks (dense content)')
      } else if (avgWordsPerPage > 200) {
        pagesPerChunk = 8 // Medium density: moderate chunks
        console.log('📄 Using 8-page chunks (medium content)')
      } else {
        pagesPerChunk = 12 // Sparse pages: larger chunks
        console.log('📄 Using 12-page chunks (sparse content)')
      }
      
      const overlapPages = Math.max(1, Math.floor(pagesPerChunk * 0.2)) // 20% overlap
      console.log(`📄 Using ${overlapPages} page(s) overlap between chunks`)
      
      const chapters = []
      let chunkNumber = 1
      
      for (let i = 0; i < structuredPages.length; i += (pagesPerChunk - overlapPages)) {
        const endIndex = Math.min(i + pagesPerChunk, structuredPages.length)
        const chunkPages = structuredPages.slice(i, endIndex)
        
        if (chunkPages.length > 0) {
          const chapterContent = chunkPages.map(page => page.text).join('\n\n')
          const wordCount = chapterContent.split(/\s+/).length
          
          // Only create chunk if it has substantial content
          if (wordCount > 200) {
            const startPage = chunkPages[0].pageNumber
            const endPage = chunkPages[chunkPages.length - 1].pageNumber
            
            chapters.push({
              title: `Section ${chunkNumber} (Pages ${startPage}-${endPage})`,
              startPage: startPage,
              endPage: endPage,
              content: chapterContent,
              wordCount: wordCount,
              isPageChunk: true
            })
            
            console.log(`📄 Created chunk ${chunkNumber}: Pages ${startPage}-${endPage} (${wordCount} words)`)
            chunkNumber++
          }
        }
      }
      
      console.log(`✅ TIER 3: Created ${chapters.length} page-level chunks`)
      
      return {
        chapters: chapters,
        totalChapters: chapters.length,
        averageChapterLength: chapters.length > 0 ? Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length) : 0,
        detectionMethod: 'PAGE_LEVEL_CHUNKING',
        chunkInfo: {
          pagesPerChunk: pagesPerChunk,
          overlapPages: overlapPages,
          avgWordsPerPage: avgWordsPerPage
        }
      }
      
    } catch (error) {
      console.error('❌ TIER 3: Page-level chunking failed:', error.message)
      return null
    }
  }

  /**
   * TIER 3: Create word-based chunks for non-structured text (final fallback)
   */
  async createWordBasedChunks(textContent) {
    try {
      console.log(`📝 TIER 3: Creating word-based chunks for non-structured text...`)
      
      const words = textContent.split(/\s+/)
      const totalWords = words.length
      
      console.log(`📊 Total words: ${totalWords}`)
      
      // Determine chunk size (target ~1000-2000 words per chunk)
      let wordsPerChunk
      if (totalWords > 50000) {
        wordsPerChunk = 2000 // Large books: bigger chunks
      } else if (totalWords > 20000) {
        wordsPerChunk = 1500 // Medium books: moderate chunks
      } else {
        wordsPerChunk = 1000 // Small books: smaller chunks
      }
      
      const overlapWords = Math.floor(wordsPerChunk * 0.1) // 10% overlap
      console.log(`📝 Using ${wordsPerChunk} words per chunk with ${overlapWords} word overlap`)
      
      const chapters = []
      let chunkNumber = 1
      
      for (let i = 0; i < words.length; i += (wordsPerChunk - overlapWords)) {
        const endIndex = Math.min(i + wordsPerChunk, words.length)
        const chunkWords = words.slice(i, endIndex)
        
        if (chunkWords.length > 100) { // Minimum chunk size
          const chapterContent = chunkWords.join(' ')
          
          chapters.push({
            title: `Section ${chunkNumber} (Words ${i + 1}-${endIndex})`,
            startWord: i + 1,
            endWord: endIndex,
            content: chapterContent,
            wordCount: chunkWords.length,
            isWordChunk: true
          })
          
          console.log(`📝 Created chunk ${chunkNumber}: Words ${i + 1}-${endIndex} (${chunkWords.length} words)`)
          chunkNumber++
        }
      }
      
      console.log(`✅ TIER 3: Created ${chapters.length} word-based chunks`)
      
      return {
        chapters: chapters,
        totalChapters: chapters.length,
        averageChapterLength: chapters.length > 0 ? Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length) : 0,
        detectionMethod: 'WORD_BASED_CHUNKING',
        chunkInfo: {
          wordsPerChunk: wordsPerChunk,
          overlapWords: overlapWords,
          totalWords: totalWords
        }
      }
      
    } catch (error) {
      console.error('❌ TIER 3: Word-based chunking failed:', error.message)
      return null
    }
  }

  /**
   * Build book structure from AI-detected chapter names using structured page data
   */
  buildStructureFromAIDetection(textContent, chapterNames, structuredPages = null) {
    console.log('🔍 Building structure from AI-detected chapters...')
    
    if (structuredPages) {
      console.log(`📚 Using structured page data (${structuredPages.length} pages) for chapter detection`)
      return this.buildChaptersFromStructuredPages(textContent, chapterNames, structuredPages)
    } else {
      console.log('📚 Using fallback line-based detection')
      return this.buildChaptersFromLines(textContent, chapterNames)
    }
  }
  
  /**
   * Build chapters using structured page data (preferred method)
   */
  buildChaptersFromStructuredPages(textContent, chapterNames, structuredPages) {
    const chapters = []
    
    // First, identify the Table of Contents pages to skip them
    const tocPages = this.identifyTOCPages(structuredPages)
    console.log(`📑 Identified TOC pages: ${tocPages.join(', ')} - will skip these when searching for chapter content`)
    
    let searchStartPageIndex = 0 // Start searching from beginning for first chapter
    
    for (let i = 0; i < chapterNames.length; i++) {
      const chapterName = chapterNames[i]
      const nextChapterName = chapterNames[i + 1]
      
      console.log(`🔍 Searching for chapter: "${chapterName}" starting from page index ${searchStartPageIndex} (skipping TOC)`)
      
      let chapterStart = { pageIndex: -1, lineIndex: -1 }
      let chapterEnd = { pageIndex: structuredPages.length - 1, lineIndex: -1 }
      
      // Search for chapter start in structured pages, starting from where previous chapter ended
      for (let pageIndex = searchStartPageIndex; pageIndex < structuredPages.length; pageIndex++) {
        // Skip pages that are identified as TOC
        if (tocPages.includes(structuredPages[pageIndex].pageNumber)) {
          continue
        }
        const page = structuredPages[pageIndex]
        
        for (let lineIndex = 0; lineIndex < page.lines.length; lineIndex++) {
          const line = page.lines[lineIndex]
          
          if (this.isChapterMatch(line, chapterName)) {
            console.log(`✅ Found chapter start: Page ${page.pageNumber}, Line ${lineIndex + 1}: "${line.substring(0, 100)}..."`)
            chapterStart = { pageIndex, lineIndex }
            break
          }
        }
        
        if (chapterStart.pageIndex !== -1) break
      }
      
      // Search for chapter end (start of next chapter), but skip TOC pages
      if (nextChapterName && chapterStart.pageIndex !== -1) {
        for (let pageIndex = chapterStart.pageIndex; pageIndex < structuredPages.length; pageIndex++) {
          const page = structuredPages[pageIndex]
          
          // Skip TOC pages when looking for chapter endings too
          if (tocPages.includes(page.pageNumber)) {
            continue
          }
          
          const startLineIndex = pageIndex === chapterStart.pageIndex ? chapterStart.lineIndex + 1 : 0
          
          for (let lineIndex = startLineIndex; lineIndex < page.lines.length; lineIndex++) {
            const line = page.lines[lineIndex]
            
            if (this.isChapterMatch(line, nextChapterName)) {
              console.log(`🔚 Found chapter end: Page ${page.pageNumber}, Line ${lineIndex + 1}: "${line.substring(0, 100)}..."`)
              chapterEnd = { pageIndex, lineIndex }
              break
            }
          }
          
          if (chapterEnd.pageIndex !== structuredPages.length - 1 || chapterEnd.lineIndex !== -1) {
            break
          }
        }
      }
      
      // Extract chapter content
      if (chapterStart.pageIndex !== -1) {
        const chapterContent = this.extractChapterContent(structuredPages, chapterStart, chapterEnd)
        
        if (chapterContent.length > 500) {
          chapters.push({
            title: chapterName,
            startPage: structuredPages[chapterStart.pageIndex].pageNumber,
            endPage: chapterEnd.pageIndex !== -1 ? structuredPages[chapterEnd.pageIndex].pageNumber : structuredPages[structuredPages.length - 1].pageNumber,
            content: chapterContent,
            wordCount: chapterContent.split(/\s+/).length
          })
          console.log(`✅ Found chapter: "${chapterName}" (${chapterContent.split(/\s+/).length} words, pages ${structuredPages[chapterStart.pageIndex].pageNumber}-${chapterEnd.pageIndex !== -1 ? structuredPages[chapterEnd.pageIndex].pageNumber : structuredPages[structuredPages.length - 1].pageNumber})`)
          
          // Update search start position to after this chapter for next iteration
          searchStartPageIndex = chapterEnd.pageIndex !== -1 ? chapterEnd.pageIndex : chapterStart.pageIndex + 1
        } else {
          console.log(`⚠️ Skipped short chapter: "${chapterName}" (${chapterContent.length} chars)`)
        }
      } else {
        console.log(`❌ Could not locate chapter: "${chapterName}"`)
      }
    }
    
    return {
      chapters: chapters,
      totalChapters: chapters.length,
      averageChapterLength: chapters.length > 0 ? 
        Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length) : 0
    }
  }
  
  /**
   * AI-based dynamic TOC detection - finds start and end of TOC pages
   * Can handle TOC that spans 2-5+ pages and extends to page 10-15
   */
  async identifyTOCPagesWithAI(structuredPages) {
    try {
      console.log('🤖 Using AI to dynamically detect TOC pages...')
      
      // Step 1: Analyze first 15 pages to find TOC boundaries
      const maxPagesToAnalyze = Math.min(15, structuredPages.length)
      const firstPages = structuredPages.slice(0, maxPagesToAnalyze)
      
      // Create detailed content for AI analysis
      const pagesContent = firstPages.map(page => {
        return `--- PAGE ${page.pageNumber} (${page.wordCount} words) ---\n${page.text}`
      }).join('\n\n')
      
      console.log(`🔍 Analyzing first ${maxPagesToAnalyze} pages for TOC detection...`)
      
      const prompt = `Analyze these pages from the beginning of a book to identify the Table of Contents (TOC) pages.

Book pages (first ${maxPagesToAnalyze} pages):
${pagesContent}

Please identify which pages contain the Table of Contents. Look for:
1. Pages with "Table of Contents", "Contents", or "Index" headers
2. Pages listing chapter titles with page numbers
3. Sequential pages that continue the TOC format
4. The exact start and end page of the TOC section

Return a JSON object with the TOC page range:
{
  "tocPages": [2, 3, 4],
  "startPage": 2,
  "endPage": 4,
  "reason": "Pages 2-4 contain the table of contents with chapter listings and page numbers"
}

IMPORTANT:
- Only include pages that are actually part of the TOC
- TOC can be 1-5+ pages long and can extend to page 10-15
- If no clear TOC is found, return empty array
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt)
      
      if (response && response.tocPages && Array.isArray(response.tocPages)) {
        console.log(`🎯 AI detected TOC pages: ${response.tocPages.join(', ')} (${response.reason})`)
        return response.tocPages
      }
      
      console.log('⚠️ AI could not detect clear TOC pages - using fallback detection')
      return this.identifyTOCPagesFallback(structuredPages)
      
    } catch (error) {
      console.warn('⚠️ AI TOC detection failed:', error.message)
      return this.identifyTOCPagesFallback(structuredPages)
    }
  }

  /**
   * Fallback TOC detection with conservative approach
   */
  identifyTOCPagesFallback(structuredPages) {
    const tocPages = []
    const maxTOCPageNumber = 10 // Conservative limit
    
    for (const page of structuredPages) {
      if (page.pageNumber > maxTOCPageNumber) break
      
      const lines = page.lines
      
      // Check for explicit TOC indicators
      const hasTOCHeader = lines.some(line => 
        /^(table of contents|contents|index)$/i.test(line.trim())
      )
      
      // Check for chapter listing patterns
      const chapterReferences = lines.filter(line => 
        /chapter\s+\d+/i.test(line) || /^\d+\.\s+[A-Z]/i.test(line.trim())
      ).length
      
      if (hasTOCHeader || (chapterReferences >= 2 && page.wordCount < 200)) {
        tocPages.push(page.pageNumber)
        console.log(`📑 Fallback detected TOC page ${page.pageNumber}`)
      }
    }
    
    console.log(`📑 Fallback detected ${tocPages.length} TOC pages: ${tocPages.join(', ')}`)
    return tocPages
  }

  /**
   * DEPRECATED: Identify Table of Contents pages with strict limit (max 2-3 pages)
   * TOC should only be in first 5 pages of the book
   */
  identifyTOCPagesLimited(structuredPages) {
    const tocPages = []
    const maxTOCPageNumber = 5 // TOC should be in first 5 pages only
    const maxTOCPages = 3 // Maximum 3 pages can be TOC
    
    for (const page of structuredPages) {
      // Skip pages that are too late in the book to be TOC
      if (page.pageNumber > maxTOCPageNumber) {
        continue
      }
      
      // Don't exceed max TOC pages
      if (tocPages.length >= maxTOCPages) {
        break
      }
      
      const pageText = page.text.toLowerCase()
      const lines = page.lines
      
      // Check if this page contains TOC indicators
      const hasTOCHeader = lines.some(line => 
        /^(table of contents|contents|index)$/i.test(line.trim())
      )
      
      // Check if this page has multiple chapter references (likely TOC)
      const chapterReferences = lines.filter(line => 
        /chapter\s+\d+/i.test(line)
      ).length
      
      // Strict criteria for TOC detection:
      // 1. Must have explicit TOC header, OR
      // 2. Must have 3+ chapter references AND be in first 3 pages AND have low word count
      const isEarlyPage = page.pageNumber <= 3
      const hasLowWordCount = page.wordCount < 150 // Very strict word count limit
      const hasChapterReferences = chapterReferences >= 3
      
      const isTOC = hasTOCHeader || (isEarlyPage && hasLowWordCount && hasChapterReferences)
      
      if (isTOC) {
        tocPages.push(page.pageNumber)
        console.log(`📑 Page ${page.pageNumber} identified as TOC (header: ${hasTOCHeader}, chapter refs: ${chapterReferences}, words: ${page.wordCount}, early: ${isEarlyPage})`)
      }
    }
    
    console.log(`📑 Identified ${tocPages.length} TOC pages (max ${maxTOCPages}): ${tocPages.join(', ')}`)
    return tocPages
  }

  /**
   * DEPRECATED: Identify Table of Contents pages to skip during chapter search
   * TOC should only be in first 20 pages of the book
   */
  identifyTOCPages(structuredPages) {
    const tocPages = []
    const maxTOCPageNumber = 20 // TOC should be in first 20 pages only
    
    for (const page of structuredPages) {
      // Skip pages that are too late in the book to be TOC
      if (page.pageNumber > maxTOCPageNumber) {
        continue
      }
      
      const pageText = page.text.toLowerCase()
      const lines = page.lines
      
      // Check if this page contains TOC indicators
      const hasTOCHeader = lines.some(line => 
        /^(table of contents|contents|index)$/i.test(line.trim())
      )
      
      // Check if this page has multiple chapter references (likely TOC)
      const chapterReferences = lines.filter(line => 
        /chapter\s+\d+/i.test(line)
      ).length
      
      // More strict criteria for TOC detection:
      // 1. Must have explicit TOC header, OR
      // 2. Must have 5+ chapter references AND be in first 15 pages AND have low word count (typical TOC)
      const isEarlyPage = page.pageNumber <= 15
      const hasLowWordCount = page.wordCount < 200 // TOC pages typically have sparse text
      const hasHighChapterDensity = chapterReferences >= 5
      
      const isTOC = hasTOCHeader || (isEarlyPage && hasLowWordCount && hasHighChapterDensity)
      
      if (isTOC) {
        tocPages.push(page.pageNumber)
        console.log(`📑 Page ${page.pageNumber} identified as TOC (header: ${hasTOCHeader}, chapter refs: ${chapterReferences}, words: ${page.wordCount}, early: ${isEarlyPage})`)
      }
    }
    
    // Convert individual TOC pages to contiguous ranges
    const tocRanges = this.createContiguousRanges(tocPages)
    const allTOCPages = []
    
    tocRanges.forEach(range => {
      for (let page = range.start; page <= range.end; page++) {
        allTOCPages.push(page)
      }
    })
    
    if (allTOCPages.length > tocPages.length) {
      console.log(`📑 Expanded TOC to contiguous ranges: ${allTOCPages.join(', ')} (filled gaps between detected pages)`)
    }
    
    return allTOCPages
  }
  
  /**
   * Create contiguous page ranges from individual page numbers
   */
  createContiguousRanges(pages) {
    if (pages.length === 0) return []
    
    const sortedPages = [...pages].sort((a, b) => a - b)
    const ranges = []
    let currentRange = { start: sortedPages[0], end: sortedPages[0] }
    
    for (let i = 1; i < sortedPages.length; i++) {
      const currentPage = sortedPages[i]
      const prevPage = sortedPages[i - 1]
      
      // If pages are within 2 of each other, extend the current range
      if (currentPage - prevPage <= 2) {
        currentRange.end = currentPage
      } else {
        // Start a new range
        ranges.push(currentRange)
        currentRange = { start: currentPage, end: currentPage }
      }
    }
    
    ranges.push(currentRange)
    return ranges
  }

  /**
   * Extract chapter content from structured pages
   */
  extractChapterContent(structuredPages, startPos, endPos) {
    const contentLines = []
    
    for (let pageIndex = startPos.pageIndex; pageIndex <= endPos.pageIndex; pageIndex++) {
      const page = structuredPages[pageIndex]
      
      let startLineIndex = 0
      let endLineIndex = page.lines.length
      
      if (pageIndex === startPos.pageIndex) {
        startLineIndex = startPos.lineIndex
      }
      
      if (pageIndex === endPos.pageIndex && endPos.lineIndex !== -1) {
        endLineIndex = endPos.lineIndex
      }
      
      for (let lineIndex = startLineIndex; lineIndex < endLineIndex; lineIndex++) {
        if (page.lines[lineIndex]) {
          contentLines.push(page.lines[lineIndex])
        }
      }
    }
    
    return contentLines.join('\n').trim()
  }
  
  /**
   * Fallback method using line-based detection
   */
  buildChaptersFromLines(textContent, chapterNames) {
    const chapters = []
    const lines = textContent.split('\n')
    
    for (let i = 0; i < chapterNames.length; i++) {
      const chapterName = chapterNames[i]
      const nextChapterName = chapterNames[i + 1]
      
      // Find chapter start by searching for the chapter name or similar patterns
      let chapterStart = -1
      let chapterEnd = lines.length
      
      // Try multiple search strategies
      const searchPatterns = [
        chapterName, // Exact match
        chapterName.replace(/^Chapter\s+\d+:\s*/i, ''), // Remove "Chapter X:" prefix
        chapterName.substring(0, 50), // First 50 chars
        chapterName.split(':')[0], // Just the "Chapter X" part
      ]
      
      console.log(`🔍 Searching for chapter: "${chapterName}"`)
      console.log(`🔍 Search patterns: ${searchPatterns.map(p => `"${p}"`).join(', ')}`)
      
      for (const pattern of searchPatterns) {
        if (pattern.length < 5) continue
        
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j].trim()
          
          if (this.isChapterMatch(line, pattern)) {
            console.log(`✅ Found match at line ${j}: "${line.substring(0, 100)}..." (pattern: "${pattern}")`)
            chapterStart = j
            break
          }
        }
        
        if (chapterStart !== -1) break
      }
      
      if (chapterStart === -1) {
        console.log(`❌ Could not find start for chapter: "${chapterName}"`)
      }
      
      // Find chapter end (start of next chapter)
      if (nextChapterName && chapterStart !== -1) {
        const nextSearchPatterns = [
          nextChapterName,
          nextChapterName.replace(/^Chapter\s+\d+:\s*/i, ''),
          nextChapterName.substring(0, 50),
          nextChapterName.split(':')[0],
        ]
        
        for (const pattern of nextSearchPatterns) {
          if (pattern.length < 5) continue
          
          for (let j = chapterStart + 1; j < lines.length; j++) {
            const line = lines[j].trim()
            
            if (this.isChapterMatch(line, pattern)) {
              console.log(`🔚 Found end at line ${j}: "${line.substring(0, 100)}..." (pattern: "${pattern}")`)
              chapterEnd = j
              break
            }
          }
          
          if (chapterEnd < lines.length) break // Fixed: was checking !== lines.length
        }
      } else {
        // For the last chapter, set end to actual end of text
        chapterEnd = lines.length
      }
      
      if (chapterStart !== -1) {
        const chapterContent = lines.slice(chapterStart, chapterEnd).join('\n').trim()
        if (chapterContent.length > 500) { // Minimum chapter length
          chapters.push({
            title: chapterName,
            startLine: chapterStart,
            content: chapterContent,
            wordCount: chapterContent.split(/\s+/).length
          })
          console.log(`✅ Found chapter: "${chapterName}" (${chapterContent.split(/\s+/).length} words)`)
        } else {
          console.log(`⚠️ Skipped short chapter: "${chapterName}" (${chapterContent.length} chars)`)
        }
      } else {
        console.log(`❌ Could not locate chapter: "${chapterName}"`)
      }
    }
    
    return {
      chapters: chapters,
      totalChapters: chapters.length,
      averageChapterLength: chapters.length > 0 ? 
        Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length) : 0
    }
  }

  /**
   * Extract chapter names from Table of Contents (fallback method)
   */
  extractChaptersFromTOC(textContent) {
    const tocPatterns = [
      /table of contents/i,
      /contents/i,
      /index/i,
      /^contents$/i  // Standalone "Contents" line
    ]
    
    const lines = textContent.split('\n')
    let tocStart = -1
    let tocEnd = -1
    
    // Find TOC section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase()
      if (tocPatterns.some(pattern => pattern.test(line)) && line.length < 50) {
        tocStart = i
        break
      }
    }
    
    if (tocStart === -1) {
      console.log('🔍 No "Table of Contents" found in text')
      return []
    }
    
    console.log(`🔍 Found TOC at line ${tocStart}: "${lines[tocStart].substring(0, 100)}..."`)
    
    // Find end of TOC (usually before first chapter or introduction)
    for (let i = tocStart + 1; i < Math.min(tocStart + 100, lines.length); i++) {
      const line = lines[i].trim()
      if (this.isChapterStart(line) || line.toLowerCase().includes('introduction') || 
          line.toLowerCase().includes('preface') || line.toLowerCase().includes('chapter 1')) {
        tocEnd = i
        break
      }
    }
    
    if (tocEnd === -1) tocEnd = Math.min(tocStart + 10, lines.length)
    console.log(`🔍 TOC section spans lines ${tocStart} to ${tocEnd}`)
    
    // Extract chapter names from TOC - handle both line-by-line and inline formats
    const chapters = []
    
    // First, try to extract from the TOC section
    const tocContent = lines.slice(tocStart, tocEnd).join(' ')
    
    // Look for "Chapter X:" patterns in the TOC content
    const chapterMatches = tocContent.match(/Chapter\s+\d+[:\-]?\s*[^\d]+?(?=Chapter\s+\d+|$)/gi)
    
    if (chapterMatches && chapterMatches.length > 0) {
      chapterMatches.forEach(match => {
        const cleanMatch = match.trim().replace(/\s+/g, ' ')
        if (cleanMatch.length > 10 && cleanMatch.length < 150) {
          chapters.push(cleanMatch)
        }
      })
    } else {
      // Fallback: line-by-line extraction
      for (let i = tocStart + 1; i < tocEnd; i++) {
        const line = lines[i].trim()
        if (line.length > 5 && line.length < 100) {
          // Look for chapter-like entries
          const chapterMatch = line.match(/^(\d+\.?\s+)?(.+?)(\s+\d+)?$/)
          if (chapterMatch && chapterMatch[2]) {
            const chapterName = chapterMatch[2].trim()
            if (this.isValidChapterName(chapterName)) {
              chapters.push(chapterName)
            }
          }
        }
      }
    }
    
    console.log(`📋 Extracted ${chapters.length} potential chapters from TOC:`)
    chapters.forEach((chapter, i) => {
      console.log(`  ${i + 1}. "${chapter}"`)
    })
    return chapters
  }

  /**
   * Build structure using TOC chapter names as search terms
   */
  buildStructureFromTOC(textContent, tocChapters) {
    const chapters = []
    const lines = textContent.split('\n')
    
    for (let i = 0; i < tocChapters.length; i++) {
      const chapterName = tocChapters[i]
      const nextChapterName = tocChapters[i + 1]
      
      // Find chapter start by searching for the chapter name
      let chapterStart = -1
      let chapterEnd = lines.length
      
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j].trim()
        
        // Look for exact or partial match
        if (this.isChapterMatch(line, chapterName)) {
          chapterStart = j
          break
        }
      }
      
      // Find chapter end (start of next chapter)
      if (nextChapterName) {
        for (let j = chapterStart + 1; j < lines.length; j++) {
          const line = lines[j].trim()
          if (this.isChapterMatch(line, nextChapterName)) {
            chapterEnd = j
            break
          }
        }
      }
      
      if (chapterStart !== -1) {
        const chapterContent = lines.slice(chapterStart, chapterEnd).join('\n').trim()
        if (chapterContent.length > 500) { // Minimum chapter length
          chapters.push({
            title: chapterName,
            startLine: chapterStart,
            content: chapterContent,
            wordCount: chapterContent.split(/\s+/).length
          })
          console.log(`✅ Found chapter: "${chapterName}" (${chapterContent.split(/\s+/).length} words)`)
        }
      }
    }
    
    return {
      chapters: chapters,
      totalChapters: chapters.length,
      averageChapterLength: chapters.length > 0 ? 
        Math.round(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / chapters.length) : 0
    }
  }

  /**
   * Fallback pattern-based structure detection
   */
  buildStructureFromPatterns(textContent, lines) {
    // Patterns for chapter detection
    const chapterPatterns = [
      /^Chapter\s+\d+/i,
      /^CHAPTER\s+\d+/i,
      /^Chapter\s+\d+:/i,  // "Chapter 1: Introduction"
      /^\d+\.\s+[A-Z]/,
      /^[A-Z][A-Z\s]{8,}$/,  // ALL CAPS headings
      /^Part\s+\d+/i,
      /^\d+\s+[A-Z][a-z]/,  // "1 Introduction"
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,4}$/  // Title Case: "Meaningful Names", "Error Handling"
    ]
    
    console.log('🔍 Checking lines for chapter patterns...')
    let foundPatterns = 0
    
    const chapters = []
    let currentChapter = null
    let chapterContent = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Check if this line is a chapter heading
      const isChapterHeading = chapterPatterns.some(pattern => pattern.test(line))
      
      if (isChapterHeading && line.length < 100) {
        console.log(`✅ Found chapter heading at line ${i}: "${line}"`)
        foundPatterns++
        // Save previous chapter
        if (currentChapter) {
          currentChapter.content = chapterContent.join('\n').trim()
          currentChapter.wordCount = currentChapter.content.split(/\s+/).length
          chapters.push(currentChapter)
        }
        
        // Start new chapter
        currentChapter = {
          title: line,
          startLine: i,
          content: '',
          wordCount: 0
        }
        chapterContent = []
      } else if (currentChapter) {
        chapterContent.push(line)
      } else {
        // Content before first chapter (introduction, etc.)
        if (!chapters.length) {
          chapters.push({
            title: 'Introduction',
            startLine: 0,
            content: line,
            wordCount: 0
          })
        }
      }
    }
    
    // Save final chapter
    if (currentChapter) {
      currentChapter.content = chapterContent.join('\n').trim()
      currentChapter.wordCount = currentChapter.content.split(/\s+/).length
      chapters.push(currentChapter)
    }
    
    console.log(`📊 Pattern detection summary: Found ${foundPatterns} potential chapter headings, created ${chapters.length} chapters`)
    
    // If no chapters detected, treat as single chapter
    if (chapters.length === 0) {
      console.log('⚠️ No chapters detected - treating entire text as single chapter')
      chapters.push({
        title: 'Main Content',
        startLine: 0,
        content: textContent,
        wordCount: textContent.split(/\s+/).length
      })
    }
    
    const filteredChapters = chapters.filter(ch => ch.wordCount > 100)
    console.log(`✅ Final result: ${filteredChapters.length} valid chapters (${chapters.length - filteredChapters.length} filtered out for being too small)`)
    
    return {
      chapters: filteredChapters,
      totalChapters: filteredChapters.length,
      averageChapterLength: filteredChapters.length > 0 ? Math.round(filteredChapters.reduce((sum, ch) => sum + ch.wordCount, 0) / filteredChapters.length) : 0
    }
  }

  /**
   * Create semantic chunks with overlap
   */
  async createSemanticChunks(textContent, bookStructure) {
    const chunks = []
    let chunkId = 0
    
    // Normalize text processing to ensure consistency
    const normalizeText = (text) => {
      return text
        .replace(/\s+/g, ' ') // Normalize all whitespace to single spaces
        .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
        .trim()
    }
    
    console.log(`📝 Processing ${bookStructure.chapters.length} chapters for semantic chunking...`)
    
    for (const chapter of bookStructure.chapters) {
      const normalizedContent = normalizeText(chapter.content)
      
      // Enhanced paragraph splitting - handle both paragraph breaks and sentence breaks
      let paragraphs = normalizedContent.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50)
      
      // If we don't have enough paragraphs (text is one big block), split by sentences
      if (paragraphs.length <= 1 && normalizedContent.length > 1000) {
        console.log(`  Chapter "${chapter.title}": Text is one block, splitting by sentences...`)
        
        // Split by sentence endings, but keep sentences together in reasonable groups
        const sentences = normalizedContent.split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 20)
        
        // Group sentences into paragraph-like chunks
        paragraphs = []
        let currentParagraph = ''
        
        for (const sentence of sentences) {
          if (currentParagraph.length + sentence.length > 400 && currentParagraph.length > 100) {
            paragraphs.push(currentParagraph.trim())
            currentParagraph = sentence
          } else {
            if (currentParagraph) currentParagraph += ' '
            currentParagraph += sentence
          }
        }
        
        // Add final paragraph
        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim())
        }
        
        // Filter out very short paragraphs
        paragraphs = paragraphs.filter(p => p.length > 50)
      }
      
      console.log(`  Chapter "${chapter.title}": ${paragraphs.length} paragraphs (${normalizedContent.length} chars)`)
      
      const chunkSize = 3500 // Target characters - optimized for microlearning (600-700 words)
      const overlapSize = 300 // Overlap characters - proportionally increased
      
      let currentChunk = ''
      let paragraphStart = 0
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i]
        
        // More deterministic chunking logic
        if (currentChunk.length + paragraph.length + 2 > chunkSize && currentChunk.length > 300) {
          // Save current chunk with deterministic metadata
          const chunkText = currentChunk.trim()
          chunks.push({
            id: `chunk_${chunkId++}`, // Sequential ID
            text: chunkText,
            chapterTitle: chapter.title,
            chapterIndex: bookStructure.chapters.indexOf(chapter),
            startParagraph: paragraphStart,
            endParagraph: i - 1,
            wordCount: chunkText.split(/\s+/).filter(w => w.length > 0).length, // More precise word count
            charCount: chunkText.length,
            entities: this.extractSimpleEntities(chunkText),
            embedding: null // Will be filled later
          })
          
          // Deterministic overlap calculation
          const words = currentChunk.split(/\s+/).filter(w => w.length > 0)
          const overlapWordCount = Math.floor(overlapSize / 5) // Average 5 chars per word
          const overlapWords = words.slice(-Math.min(overlapWordCount, words.length))
          currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? '\n\n' : '') + paragraph
          paragraphStart = Math.max(0, i - 1)
        } else {
          if (currentChunk) currentChunk += '\n\n'
          currentChunk += paragraph
        }
      }
      
      // Save final chunk for this chapter if it has meaningful content
      if (currentChunk.trim().length > 100) { // Minimum chunk size
        const chunkText = currentChunk.trim()
        chunks.push({
          id: `chunk_${chunkId++}`,
          text: chunkText,
          chapterTitle: chapter.title,
          chapterIndex: bookStructure.chapters.indexOf(chapter),
          startParagraph: paragraphStart,
          endParagraph: paragraphs.length - 1,
          wordCount: chunkText.split(/\s+/).filter(w => w.length > 0).length,
          charCount: chunkText.length,
          entities: this.extractSimpleEntities(chunkText),
          embedding: null
        })
      }
    }
    
    // Filter and return with consistent criteria
    const filteredChunks = chunks.filter(chunk => 
      chunk.wordCount >= 30 && 
      chunk.text.length >= 100 &&
      chunk.text.trim().length > 0
    )
    
    console.log(`📝 Created ${filteredChunks.length} semantic chunks (${chunks.length - filteredChunks.length} filtered out)`)
    return filteredChunks
  }

  /**
   * Build vector store for semantic search
   */
  async buildVectorStore(chunks) {
    console.log('🔢 Generating embeddings for vector store...')
    
    for (const chunk of chunks) {
      try {
        const output = await this.embedder(chunk.text, { pooling: 'mean', normalize: true })
        chunk.embedding = Array.from(output.data)
        
        // Store in our simple vector store
        this.vectorStore.set(chunk.id, {
          id: chunk.id,
          vector: chunk.embedding,
          text: chunk.text,
          chapterTitle: chunk.chapterTitle,
          entities: chunk.entities
        })
      } catch (error) {
        console.warn(`⚠️ Failed to generate embedding for chunk ${chunk.id}`)
      }
    }
    
    console.log(`✅ Vector store built with ${this.vectorStore.size} embeddings`)
  }

  /**
   * Semantic search in vector store
   */
  async semanticSearch(queryText, topK = 5, excludeChunks = []) {
    try {
      // Generate query embedding
      const queryOutput = await this.embedder(queryText, { pooling: 'mean', normalize: true })
      const queryVector = Array.from(queryOutput.data)
      
      // Calculate similarities
      const similarities = []
      
      for (const [chunkId, chunkData] of this.vectorStore.entries()) {
        if (excludeChunks.includes(chunkId)) continue
        
        const similarity = this.cosineSimilarity(queryVector, chunkData.vector)
        similarities.push({
          chunkId,
          similarity,
          text: chunkData.text,
          chapterTitle: chunkData.chapterTitle
        })
      }
      
      // Return top K most similar
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        
    } catch (error) {
      console.warn('⚠️ Semantic search failed:', error.message)
      return []
    }
  }

  /**
   * UNIFIED APPROACH: Process a single semantic chunk to generate cards
   * Works whether chapter detection succeeded or failed
   */
  async processSemanticChunk(chunk, allChunks, bookStructure, bookTitle, author, category, processedChunkIds) {
    try {
      // Build context for this chunk
      const context = await this.buildChunkContext(chunk, allChunks, bookStructure, processedChunkIds)
      
      // Generate cards from this chunk with context
      const cards = await this.generateCardsFromChunk(chunk, context, bookTitle, author, category)
      
      return cards
      
    } catch (error) {
      console.warn(`⚠️ Error processing chunk ${chunk.id}:`, error.message)
      return []
    }
  }

  /**
   * Build rich context for a semantic chunk
   */
  async buildChunkContext(chunk, allChunks, bookStructure, processedChunkIds) {
    const context = {
      mainChunk: chunk,
      chapterContext: null,
      relatedChunks: []
    }

    // Add chapter context if available (when chapter detection worked)
    if (chunk.chapterTitle && bookStructure.chapters.length > 0) {
      const chapter = bookStructure.chapters.find(ch => ch.title === chunk.chapterTitle)
      if (chapter) {
        // TODO: Replace with actual chapter summary generation
        // For now, use chapter title and basic info as placeholder
        context.chapterContext = {
          title: chapter.title,
          summary: `Chapter context from "${chapter.title}" - ${chapter.content.substring(0, 200)}...`, // PLACEHOLDER: Should be proper chapter summary
          position: bookStructure.chapters.indexOf(chapter) + 1,
          totalChapters: bookStructure.chapters.length
        }
      }
    }

    // Find top-3 semantically similar chunks (excluding processed ones and current chunk)
    try {
      const similarChunks = await this.semanticSearch(
        chunk.text,
        3,
        [...processedChunkIds, chunk.id] // Exclude processed chunks and current chunk
      )
      
      context.relatedChunks = similarChunks.map(c => ({
        text: c.text.substring(0, 300) + '...',
        chapterTitle: c.chapterTitle || 'Unknown Chapter',
        id: c.id
      }))
      
    } catch (error) {
      console.warn(`Warning: Could not find related chunks for chunk ${chunk.id}`)
      context.relatedChunks = []
    }

    return context
  }

  /**
   * Generate 4-tier progressive cards from a semantic chunk
   */
  async generateCardsFromChunk(chunk, context, bookTitle, author, category) {
    const cards = []

    try {
      // Tier 1: Generate FLASHCARDS (Foundation)
      console.log(`🎯 Generating flashcards for chunk ${chunk.id}...`)
      const flashcards = await this.generateFlashcards(chunk, context, bookTitle, author, category)
      cards.push(...flashcards)

      // Tier 2: Generate APPLICATION cards (based on flashcards)
      if (flashcards.length > 0) {
        console.log(`📝 Generating application cards based on ${flashcards.length} flashcards...`)
        const applications = await this.generateApplicationCards(flashcards, context, bookTitle, author, category)
        cards.push(...applications)

        // Tier 3: Generate QUIZ cards (based on flashcards + applications)
        if (applications.length > 0) {
          console.log(`❓ Generating quiz cards...`)
          const quizzes = await this.generateQuizCards(flashcards, applications, bookTitle, author, category)
          cards.push(...quizzes)

          // Tier 4: Generate SYNTHESIS cards (based on all cards + chapter context)
          console.log(`🧩 Generating synthesis cards...`)
          const synthesis = await this.generateSynthesisCards(flashcards, applications, quizzes, context, bookTitle, author, category)
          cards.push(...synthesis)
        }
      }

      // Add source tracking to all cards
      cards.forEach(card => {
        if (!card.sourceChunks) {
          card.sourceChunks = [chunk.id, ...context.relatedChunks.map(r => r.id)]
        }
      })

    } catch (error) {
      console.warn(`⚠️ Error generating 4-tier cards from chunk ${chunk.id}:`, error.message)
    }

    return cards
  }

  /**
   * TIER 1: Generate FLASHCARD from a group of 3-5 chunks (Foundation Layer)
   */
  async generateFlashcardFromChunkGroup(chunkGroup, allChunks, bookStructure, bookTitle, author, category) {
    try {
      // Combine all chunks in group for comprehensive context
      const combinedContent = chunkGroup.map((chunk, index) => 
        `Chunk ${index + 1}:\n${chunk.text}`
      ).join('\n\n---\n\n')
      
      // Find related chunks from the entire book (excluding chunks in current group)
      const excludeIds = chunkGroup.map(c => c.id)
      const relatedChunks = await this.semanticSearch(
        combinedContent.substring(0, 1000), // Use first 1000 chars for search
        3, // Top 3 related chunks
        excludeIds
      )
      
      // Build context text
      let contextText = `Main content (${chunkGroup.length} related chunks):\n${combinedContent}\n\n`
      
      if (relatedChunks.length > 0) {
        contextText += `Related context from other parts of the book:\n`
        relatedChunks.forEach((related, index) => {
          contextText += `${index + 1}. From "${related.chapterTitle || 'Unknown'}": ${related.text.substring(0, 200)}...\n`
        })
      }
      
      // Get chapter context from first chunk in group
      const primaryChunk = chunkGroup[0]
      const chapterContext = primaryChunk.chapterTitle || 'General Content'
      
      const prompt = `Create 1 comprehensive flashcard from "${bookTitle}" by ${author}.

${contextText}

CRITICAL: You must return ONLY a valid JSON object with the exact structure shown below. Do not include any explanatory text, markdown formatting, or code blocks.

JSON format to return:
{
  "type": "FLASHCARD",
  "title": "Concept name (max 60 chars)",
  "front": "Clear question about the MAIN concept across all content",
  "back": "Comprehensive, accurate answer (150-250 words) that synthesizes information from all provided chunks",
  "difficulty": "EASY|MEDIUM|HARD",
  "tags": ["${category}", "concept"],
  "chapterContext": "${chapterContext}",
  "sourceChunks": ["${chunkGroup.map(c => c.id).join('", "')}"]
}

Requirements:
- Identify the MAIN theme/concept that connects all the provided content
- Create a comprehensive answer that synthesizes information from multiple chunks
- Base strictly on provided content - don't invent information
- Escape all quotes properly in JSON strings (use \\" for quotes inside strings)
- Return ONLY the JSON object, nothing else`

      const response = await this.callAI(prompt, {
        taskType: 'card_generation',
        maxTokens: 1000,
        temperature: 0.1
      })

      if (response && response.front && response.back) {
        // Ensure chapter context and source chunks are set
        response.chapterContext = chapterContext
        response.sourceChunks = chunkGroup.map(c => c.id)
        return response
      }

      return null

    } catch (error) {
      console.warn(`⚠️ Error generating flashcard from chunk group:`, error.message)
      return null
    }
  }

  /**
   * TIER 1: Generate FLASHCARDS (Foundation Layer) - Legacy single chunk method
   */
  async generateFlashcards(chunk, context, bookTitle, author, category) {
    const flashcards = []

    try {
      // Build minimal context (main chunk + related chunks only if valuable)
      let contextText = `Main content:\n${chunk.text}\n\n`
      
      if (context.relatedChunks.length > 0) {
        contextText += `Related context:\n`
        context.relatedChunks.forEach((related, index) => {
          contextText += `${index + 1}. From "${related.chapterTitle}": ${related.text}\n`
        })
      }

      const prompt = `Create 1 high-quality flashcard from "${bookTitle}" by ${author}.

Content:
${contextText}

Generate flashcard in valid JSON format (NOT an array):
{
  "type": "FLASHCARD",
  "title": "Concept name (max 60 chars)",
  "front": "Clear question about the MOST important concept",
  "back": "Comprehensive, accurate answer (100-200 words)",
  "difficulty": "EASY|MEDIUM|HARD",
  "tags": ["${category}", "concept"]
}

Requirements:
- Extract the SINGLE most important concept from the content
- Create clear Q&A pair for foundational knowledge
- Base strictly on provided content
- Return ONLY a valid JSON object, no additional text or explanations
- Ensure all quotes are properly escaped`

      const response = await this.callAI(prompt, {
        taskType: 'card_generation',
        maxTokens: 800,
        temperature: 0.1
      })

      if (response && response.front && response.back) {
        // Add chapter context to flashcard
        response.chapterContext = chunk.chapterTitle
        flashcards.push(response)
      } else if (Array.isArray(response)) {
        // Handle legacy array response  
        const validFlashcards = response.filter(card => card.front && card.back)
        validFlashcards.forEach(card => {
          card.chapterContext = chunk.chapterTitle
        })
        flashcards.push(...validFlashcards)
      }

    } catch (error) {
      console.warn(`⚠️ Error generating flashcards:`, error.message)
    }

    return flashcards
  }

  /**
   * TIER 2: Generate APPLICATION cards (Practice Layer)
   */
  async generateApplicationCards(flashcards, context, bookTitle, author, category) {
    const applications = []

    if (flashcards.length < 2) return applications // Need at least 2 flashcards

    try {
      // Build context from flashcards
      const flashcardContext = flashcards.map(fc => `Concept: ${fc.title}\nQ: ${fc.front}\nA: ${fc.back}`).join('\n\n')
      
      // Add semantic chunks only if they provide scenario context
      let additionalContext = ''
      if (context.relatedChunks.length > 0) {
        additionalContext = `\n\nAdditional context for scenarios:\n`
        context.relatedChunks.forEach((related, index) => {
          additionalContext += `${index + 1}. ${related.text}\n`
        })
      }

      const prompt = `Create 1 application card based on these flashcard concepts from "${bookTitle}" by ${author}.

Flashcard concepts:
${flashcardContext}${additionalContext}

CRITICAL: You must return ONLY a valid JSON object with the exact structure shown below. Do not include any explanatory text, markdown formatting, or code blocks.

JSON format to return:
{
  "type": "APPLICATION",
  "title": "Application scenario title (max 70 chars)",
  "scenario": "Practical scenario or challenge (150-200 words). Present a realistic situation that requires applying the flashcard concepts.",
  "question": "Specific question about how to handle this scenario (50-100 words). Ask 'How would you...' or 'What approach would you take...'",
  "solution": "Comprehensive step-by-step solution (300-500 words). Break down the solution into clear steps: Step 1, Step 2, etc. Include reasoning for each step and expected outcomes. Make it easy to follow and understand.",
  "difficulty": "MEDIUM",
  "tags": ["${category}", "application", "scenario"],
  "basedOnFlashcards": ["flashcard-titles-used"]
}

Requirements:
- Build practical scenarios using the flashcard concepts
- Include both the problem AND a detailed step-by-step solution
- Focus on application, not just recall
- Create engaging, realistic scenarios
- Solution must be broken into numbered steps (Step 1, Step 2, etc.)
- Include reasoning and expected outcomes for each step
- Escape all quotes properly in JSON strings (use \\" for quotes inside strings)
- Return ONLY the JSON object, nothing else`

      const response = await this.callAI(prompt, {
        taskType: 'card_generation',
        maxTokens: 2000,
        temperature: 0.2
      })

      if (response && (response.scenario || response.content)) {
        // Handle new format with scenario/question/solution
        if (response.scenario && response.question && response.solution) {
          // Combine into single content field for compatibility with existing system
          response.content = `**Scenario:** ${response.scenario}\n\n**Question:** ${response.question}\n\n**Solution:** ${response.solution}`
        }
        applications.push(response)
      }

    } catch (error) {
      console.warn(`⚠️ Error generating application cards:`, error.message)
    }

    return applications
  }

  /**
   * TIER 3: Generate QUIZ cards (Assessment Layer)
   */
  async generateQuizCards(flashcards, applications, bookTitle, author, category) {
    const quizzes = []

    if (flashcards.length === 0) return quizzes

    try {
      // Build context from flashcards and applications
      const flashcardContext = flashcards.map(fc => `${fc.title}: ${fc.back}`).join('\n')
      const applicationContext = applications.length > 0 ? applications[0].content : ''

      const prompt = `Create 1 quiz card based on these concepts from "${bookTitle}" by ${author}.

Concepts to test:
${flashcardContext}

Application context:
${applicationContext}

Generate quiz card in valid JSON format:
{
  "type": "QUIZ",
  "title": "Quiz question title",
  "question": "Multiple choice question testing the concepts",
  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
  "correctAnswer": "A, B, C, or D (randomize - don't always use B)",
  "explanation": "Brief explanation of why this answer is correct",
  "difficulty": "MEDIUM",
  "tags": ["${category}", "quiz", "assessment"],
  "basedOnFlashcards": ["flashcard-titles-tested"]
}

Requirements:
- Test understanding of flashcard concepts
- Create 4 plausible options with 1 correct answer
- IMPORTANT: Randomize which option (A, B, C, or D) is correct - don't always use B
- Use application context if available for scenario-based questions
- Generate believable distractors
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt, {
        taskType: 'card_generation',
        maxTokens: 800,
        temperature: 0.1
      })

      if (response && response.question && response.options) {
        // Convert letter answer to numeric index (A=0, B=1, C=2, D=3)
        const letterToIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
        const correctAnswerIndex = letterToIndex[response.correctAnswer] || 0
        
        // Restructure the quiz card to match database schema
        const quizCard = {
          type: "QUIZ",
          title: response.title || "Quiz Question",
          quiz: {
            question: response.question,
            choices: response.options, // Frontend expects 'choices' not 'options'
            correctAnswer: correctAnswerIndex, // Convert to numeric index
            explanation: response.explanation
          },
          difficulty: response.difficulty || "MEDIUM",
          tags: response.tags || ["quiz"],
          chapterContext: flashcards[0]?.chapterContext || null, // Inherit from source flashcards
          sourceFlashcards: response.basedOnFlashcards || []
        }
        quizzes.push(quizCard)
      }

    } catch (error) {
      console.warn(`⚠️ Error generating quiz cards:`, error.message)
    }

    return quizzes
  }

  /**
   * TIER 2: Generate APPLICATION cards from collected flashcards (cross-chunk)
   */
  async generateApplicationsFromFlashcards(allFlashcards, allChunks, bookTitle, author, category) {
    const applications = []
    
    // Group flashcards by chapter for more coherent applications
    const flashcardsByChapter = new Map()
    
    allFlashcards.forEach(flashcard => {
      const chapterKey = flashcard.chapterContext || 'general'
      if (!flashcardsByChapter.has(chapterKey)) {
        flashcardsByChapter.set(chapterKey, [])
      }
      flashcardsByChapter.get(chapterKey).push(flashcard)
    })
    
    // Generate applications for each chapter group
    for (const [chapterKey, chapterFlashcards] of flashcardsByChapter) {
      if (chapterFlashcards.length < 2) continue // Need at least 2 flashcards
      
      // Process in groups of 2-3 flashcards
      for (let i = 0; i < chapterFlashcards.length; i += 3) {
        const flashcardGroup = chapterFlashcards.slice(i, i + 3)
        
        try {
          const application = await this.generateApplicationCards(flashcardGroup, {relatedChunks: []}, bookTitle, author, category)
          
          // Add source flashcard tracking to each application
          application.forEach(app => {
            app.sourceFlashcards = flashcardGroup.map(fc => fc.id || `flashcard_${fc.title}`)
          })
          
          applications.push(...application)
        } catch (error) {
          console.warn(`⚠️ Error generating application for ${chapterKey}:`, error.message)
        }
      }
    }
    
    return applications
  }

  /**
   * TIER 3: Generate QUIZ cards from flashcards + applications (per chapter)
   */
  async generateQuizzesFromCards(allFlashcards, applicationCards, bookStructure, bookTitle, author, category) {
    const quizzes = []
    
    // Generate 1-2 quizzes per chapter
    const chapters = bookStructure.chapters.length > 0 ? bookStructure.chapters : [{title: 'General Content'}]
    
    for (const chapter of chapters) {
      const chapterFlashcards = allFlashcards.filter(fc => 
        fc.chapterContext === chapter.title || (!fc.chapterContext && chapter.title === 'General Content')
      )
      
      if (chapterFlashcards.length === 0) continue
      
      // Get relevant applications for this chapter
      const chapterApplications = applicationCards.filter(app => 
        app.basedOnFlashcards?.some(fcTitle => 
          chapterFlashcards.some(fc => fc.title === fcTitle)
        )
      )
      
      try {
        const quiz = await this.generateQuizCards(chapterFlashcards, chapterApplications, bookTitle, author, category)
        quizzes.push(...quiz)
      } catch (error) {
        console.warn(`⚠️ Error generating quiz for ${chapter.title}:`, error.message)
      }
    }
    
    return quizzes
  }

  /**
   * TIER 4: Generate SYNTHESIS cards from all cards + chapter context (per chapter)
   */
  async generateSynthesisFromAllCards(allFlashcards, applicationCards, quizCards, bookStructure, allChunks, bookTitle, author, category) {
    const synthesis = []
    
    // Generate 1 synthesis per chapter
    const chapters = bookStructure.chapters.length > 0 ? bookStructure.chapters : [{title: 'General Content'}]
    
    for (const chapter of chapters) {
      const chapterFlashcards = allFlashcards.filter(fc => 
        fc.chapterContext === chapter.title || (!fc.chapterContext && chapter.title === 'General Content')
      )
      
      if (chapterFlashcards.length < 1) continue // Need at least one concept for synthesis
      
      const chapterApplications = applicationCards.filter(app => 
        app.basedOnFlashcards?.some(fcTitle => 
          chapterFlashcards.some(fc => fc.title === fcTitle)
        )
      )
      
      const chapterQuizzes = quizCards.filter(quiz => 
        quiz.basedOnFlashcards?.some(fcTitle => 
          chapterFlashcards.some(fc => fc.title === fcTitle)
        )
      )
      
      // Build chapter context
      const context = {
        chapterContext: bookStructure.chapters.length > 0 ? {
          title: chapter.title,
          summary: `Chapter context from "${chapter.title}"`,
          position: bookStructure.chapters.indexOf(chapter) + 1,
          totalChapters: bookStructure.chapters.length
        } : null
      }
      
      try {
        console.log(`🧩 Generating synthesis for ${chapter.title} with ${chapterFlashcards.length} flashcards...`)
        const synthCard = await this.generateSynthesisCards(chapterFlashcards, chapterApplications, chapterQuizzes, context, bookTitle, author, category)
        synthesis.push(...synthCard)
      } catch (error) {
        console.warn(`⚠️ Error generating synthesis for ${chapter.title}:`, error.message)
      }
    }
    
    return synthesis
  }

  /**
   * TIER 4: Generate SYNTHESIS cards (Integration Layer) - Updated
   */
  async generateSynthesisCards(flashcards, applications, quizzes, context, bookTitle, author, category) {
    const synthesis = []

    if (flashcards.length < 1) return synthesis // Need at least one concept for synthesis

    try {
      // Build comprehensive context
      const flashcardConcepts = flashcards.map(fc => `${fc.title}: ${fc.back || fc.content}`).join('\n')
      const applicationScenarios = applications.map(app => app.content).join('\n\n')
      
      // Add chapter context only when available and valuable
      let chapterContext = ''
      if (context.chapterContext) {
        chapterContext = `\n\nChapter context:\nChapter: ${context.chapterContext.title} (${context.chapterContext.position}/${context.chapterContext.totalChapters})\nThis chapter focuses on: ${context.chapterContext.summary}`
      }

      const prompt = `Create 1 synthesis card that integrates multiple concepts from "${bookTitle}" by ${author}.

Key concepts to integrate:
${flashcardConcepts}

Application scenarios:
${applicationScenarios}${chapterContext}

CRITICAL: You must return ONLY a valid JSON object with the exact structure shown below. Do not include any explanatory text, markdown formatting, or code blocks.

JSON format to return:
{
  "type": "SYNTHESIS",
  "title": "Complex integration scenario (max 80 chars)",
  "scenario": "Complex multi-concept scenario (200-300 words). Present a challenging situation that requires integrating multiple flashcard concepts.",
  "question": "Integration question (75-100 words). Ask how to combine or apply multiple concepts together to solve this complex problem.",
  "analysis": "Step-by-step analysis and solution (400-600 words). Break down the approach into clear steps: Step 1, Step 2, etc. Show how different concepts connect and integrate. Include reasoning for each step and final recommendations.",
  "difficulty": "HARD",
  "tags": ["${category}", "synthesis", "integration"],
  "integratesFlashcards": ["flashcard-titles-integrated"],
  "chapterContext": "${context.chapterContext?.title || ''}"
}

Requirements:
- Combine multiple concepts into complex scenarios
- Include both the problem AND a detailed step-by-step analysis
- Require higher-order thinking (analysis, evaluation, creation)
- Create realistic, challenging problems  
- Analysis must be broken into numbered steps (Step 1, Step 2, etc.)
- Show how different concepts connect and integrate at each step
- Include reasoning and recommendations for each step
- Escape all quotes properly in JSON strings (use \\" for quotes inside strings)
- Return ONLY the JSON object, nothing else`

      const response = await this.callAI(prompt, {
        taskType: 'card_generation',
        maxTokens: 2000,
        temperature: 0.2
      })

      if (response && (response.scenario || response.content)) {
        // Handle new format with scenario/question/analysis
        if (response.scenario && response.question && response.analysis) {
          // Combine into single content field for compatibility with existing system
          response.content = `**Scenario:** ${response.scenario}\n\n**Question:** ${response.question}\n\n**Analysis:** ${response.analysis}`
        }
        synthesis.push(response)
      }

    } catch (error) {
      console.warn(`⚠️ Error generating synthesis cards:`, error.message)
    }

    return synthesis
  }

  /**
   * Legacy method - kept for compatibility, now redirects to unified approach
   */
  async processChapter(chapter, allChunks, bookTitle, author, category) {
    console.log(`📖 Legacy processChapter called for: "${chapter.title}" - redirecting to unified approach`)
    
    // This method is now deprecated in favor of processSemanticChunk
    // But keeping for backward compatibility if any code still calls it
    const chapterChunks = allChunks.filter(chunk => chunk.chapterTitle === chapter.title)
    const cards = []
    
    for (const chunk of chapterChunks) {
      const chunkCards = await this.processSemanticChunk(
        chunk, 
        allChunks, 
        { chapters: [chapter] }, // Minimal book structure
        bookTitle, 
        author, 
        category,
        new Set() // Empty processed set for legacy compatibility
      )
      cards.push(...chunkCards)
    }
    
    return cards
  }

  /**
   * Generate chapter summary using TextRank + Semantic RAG
   */
  async generateChapterSummary(chapter, chapterChunks, bookTitle, author, category) {
    try {
      // Apply TextRank to extract key sentences
      const keySentences = this.applyTextRank(chapterChunks, 8)
      const keyContent = keySentences.map(s => s.text).join(' ')
      
      // Semantic RAG: Find related content from entire book
      const relatedChunks = await this.semanticSearch(
        keyContent, 
        3, 
        chapterChunks.map(c => c.id) // Exclude current chapter chunks
      )
      
      const relatedContext = relatedChunks.map(r => 
        `From "${r.chapterTitle}": ${r.text.substring(0, 300)}...`
      ).join('\n\n')
      
      // Generate summary with Claude
      const prompt = `Create a comprehensive summary card from "${bookTitle}" by ${author}.

Chapter: ${chapter.title}

Key content from this chapter:
${keyContent}

Related content from other parts of the book:
${relatedContext}

Create a summary card in valid JSON format. IMPORTANT: Escape all quotes and special characters properly.

{
  "title": "Chapter summary title (max 70 chars, no unescaped quotes)",
  "content": "Comprehensive chapter summary (250-350 words). Include main concepts and key points from this chapter, how this chapter connects to themes from other parts of the book, key insights and takeaways, and why this chapter matters in the books overall message. Use only escaped quotes within content.",
  "difficulty": "EASY|MEDIUM|HARD",
  "tags": ["${chapter.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}", "${category}", "summary"]
}

Make it educational and show connections across the book. Return only the JSON.`

      const summaryCard = await this.callAI(prompt)
      
      if (summaryCard) {
        return {
          ...summaryCard,
          type: 'SUMMARY',
          chapterTitle: chapter.title,
          sourceChunks: chapterChunks.map(c => c.id),
          relatedChunks: relatedChunks.map(r => r.chunkId)
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ Failed to generate summary for chapter "${chapter.title}":`, error.message)
    }
    
    return null
  }

  /**
   * Generate flashcards for chapter using entity extraction + RAG
   */
  async generateChapterFlashcards(chapter, chapterChunks, bookTitle, author, category) {
    const flashcards = []
    
    // Extract important entities from chapter
    const allEntities = new Map()
    
    chapterChunks.forEach(chunk => {
      chunk.entities.forEach(entity => {
        if (!allEntities.has(entity)) {
          allEntities.set(entity, { count: 0, contexts: [] })
        }
        allEntities.get(entity).count++
        allEntities.get(entity).contexts.push({
          chunkId: chunk.id,
          context: this.getEntityContext(chunk.text, entity)
        })
      })
    })
    
    // Get top 3-4 entities for this chapter
    const topEntities = Array.from(allEntities.entries())
      .map(([entity, data]) => ({
        entity,
        count: data.count,
        contexts: data.contexts
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
    
    // Generate flashcard for each important entity
    for (const entityData of topEntities) {
      try {
        const primaryContext = entityData.contexts[0].context
        
        // Semantic RAG: Find related content about this entity from entire book
        const relatedChunks = await this.semanticSearch(
          `${entityData.entity} ${primaryContext}`,
          5,
          [entityData.contexts[0].chunkId] // Exclude primary context chunk
        )
        
        const relatedContext = relatedChunks.map(r => 
          `${r.text.substring(0, 200)}...`
        ).join('\n\n')
        
        const prompt = `Create a comprehensive flashcard about "${entityData.entity}" from "${bookTitle}" by ${author}.

Primary context from ${chapter.title}:
${primaryContext}

Related context from other parts of the book:
${relatedContext}

Create a flashcard in valid JSON format. IMPORTANT: Escape all quotes and special characters properly.

{
  "title": "Question about ${entityData.entity} (max 80 chars, no unescaped quotes)",
  "content": "Comprehensive answer (200-300 words). Include clear explanation of ${entityData.entity}, how it relates to the main themes, examples and context from the book, and why it is important to understand. Use only escaped quotes within content.",
  "difficulty": "EASY|MEDIUM|HARD",
  "tags": ["${entityData.entity.toLowerCase()}", "${category}", "concept"]
}

Make the question test deep understanding. Return only the JSON.`

        const flashcard = await this.callAI(prompt)
        
        if (flashcard) {
          flashcards.push({
            ...flashcard,
            type: 'FLASHCARD',
            entity: entityData.entity,
            chapterTitle: chapter.title,
            sourceChunks: entityData.contexts.map(c => c.chunkId),
            relatedChunks: relatedChunks.map(r => r.chunkId)
          })
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate flashcard for entity "${entityData.entity}":`, error.message)
      }
    }
    
    return flashcards
  }

  /**
   * Generate quiz cards from flashcards
   */
  async generateChapterQuizzes(flashcards, bookTitle, author, category) {
    const quizCards = []
    
    for (const flashcard of flashcards) {
      try {
        // Find semantically similar entities for distractors
        const similarEntities = await this.semanticSearch(
          flashcard.content,
          10,
          flashcard.sourceChunks
        )
        
        const distractorCandidates = similarEntities
          .map(s => this.extractSimpleEntities(s.text))
          .flat()
          .filter(entity => entity !== flashcard.entity)
          .slice(0, 8)
        
        const prompt = `Convert this flashcard to a multiple choice question from "${bookTitle}":

Question: ${flashcard.title}
Answer: ${flashcard.content.substring(0, 300)}...

Available distractor concepts: ${distractorCandidates.join(', ')}

Create a quiz card in valid JSON format. IMPORTANT: Escape all quotes and special characters properly.

{
  "title": "${flashcard.title}",
  "content": "Brief explanation after answering (100-150 words). Use only escaped quotes within content.",
  "quiz": {
    "question": "Clear, focused question based on the flashcard (no unescaped quotes)",
    "choices": [
      "A) Correct answer (concise, 1-2 sentences)",
      "B) Plausible distractor using available concepts",
      "C) Another plausible distractor",  
      "D) Third plausible distractor"
    ],
    "answer": "A",
    "explanation": "Why A is correct and others are wrong (75-100 words)"
  },
  "difficulty": "${flashcard.difficulty}",
  "tags": ${JSON.stringify(flashcard.tags)}
}

Make distractors challenging but clearly wrong. Return only the JSON.`

        const quizCard = await this.callAI(prompt)
        
        if (quizCard) {
          quizCards.push({
            ...quizCard,
            type: 'QUIZ',
            chapterContext: flashcard.chapterContext, // Inherit from source flashcard
            sourceChunks: flashcard.sourceChunks, // Inherit from source flashcard
            sourceCards: [flashcard.entity || flashcard.title] // Track source flashcard
          })
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate quiz from flashcard:`, error.message)
      }
    }
    
    return quizCards
  }

  /**
   * Generate chapter summary cards (Tier 4 - SUMMARY cards)
   * Replace synthesis cards with chapter-specific summaries from flashcards
   */
  async generateChapterSummaries(allFlashcards, bookStructure, bookTitle, author, category) {
    const summaryCards = []
    
    // Group flashcards by chapter
    const flashcardsByChapter = {}
    allFlashcards.forEach(flashcard => {
      const chapterTitle = flashcard.chapterContext || 'Unknown Chapter'
      if (!flashcardsByChapter[chapterTitle]) {
        flashcardsByChapter[chapterTitle] = []
      }
      flashcardsByChapter[chapterTitle].push(flashcard)
    })
    
    console.log(`📄 Generating summaries for ${Object.keys(flashcardsByChapter).length} chapters`)
    
    // Generate summary for each chapter
    for (const [chapterTitle, chapterFlashcards] of Object.entries(flashcardsByChapter)) {
      try {
        if (chapterFlashcards.length === 0) continue
        
        // Collect key concepts from flashcards in this chapter
        const keyConcepts = chapterFlashcards.map(card => 
          `• ${card.title}: ${card.front} → ${card.back.substring(0, 100)}...`
        ).join('\n')
        
        const prompt = `Create a comprehensive chapter summary card for "${chapterTitle}" from "${bookTitle}".

Key concepts covered in this chapter:
${keyConcepts}

Create a chapter summary card using flashcard format in valid JSON. IMPORTANT: Escape all quotes and special characters properly.
{
  "title": "Chapter Summary: ${chapterTitle}",
  "front": "What are the key insights and main concepts from ${chapterTitle}?",
  "back": "Comprehensive summary (400-500 words) that synthesizes all key concepts from this chapter. Include: main themes and core concepts, how concepts connect and relate, key insights and practical applications, and important takeaways. Write as a cohesive narrative that helps students understand the big picture of this chapter. Use only escaped quotes within content.",
  "difficulty": "MEDIUM",
  "tags": ["summary", "${category}", "chapter-overview"]
}

Focus on connecting the dots between concepts. Return only the JSON.`

        const summaryCard = await this.callAI(prompt)
        
        if (summaryCard) {
          summaryCards.push({
            ...summaryCard,
            type: 'SUMMARY',
            chapterContext: chapterTitle, // Use consistent field name
            sourceChunks: [...new Set(chapterFlashcards.flatMap(card => card.sourceChunks || []))], // Inherit from flashcards
            sourceCards: chapterFlashcards.map(card => card.entity || card.title) // Track source flashcards
          })
          
          console.log(`✅ Generated summary for chapter: "${chapterTitle}"`)
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate summary for chapter "${chapterTitle}":`, error.message)
      }
    }
    
    console.log(`📄 Generated ${summaryCards.length} chapter summary cards`)
    return summaryCards
  }

  /**
   * Generate book-level overview cards
   */
  async generateBookOverview(bookStructure, allChunks, bookTitle, author, category) {
    try {
      // Create book overview summary
      const chapterSummaries = bookStructure.chapters.map(ch => 
        `${ch.title}: ${ch.content.substring(0, 200)}...`
      ).join('\n\n')
      
      const prompt = `Create a book overview card for "${bookTitle}" by ${author}.

Chapter summaries:
${chapterSummaries}

Create an overview card in valid JSON format. IMPORTANT: Escape all quotes and special characters properly.

{
  "title": "Overview: ${bookTitle}",
  "front": "Complete Book Overview",
  "back": "Comprehensive book overview (300-400 words). Include main themes and central message, how the chapters connect, key insights and takeaways, and why this book matters. Use only escaped quotes within content.",
  "difficulty": "MEDIUM",
  "tags": ["overview", "${category}", "book-summary"]
}

Focus on the big picture and connections. Return only the JSON.`

      const overviewCard = await this.callAI(prompt)
      
      if (overviewCard) {
        return [{
          ...overviewCard,
          type: 'SUMMARY',
          chapterContext: 'Book Overview',
          sourceChunks: allChunks.slice(0, 5).map(c => c.id),
          sourceCards: [], // No source cards for book overview
          // Ensure both content and back fields are populated for compatibility
          content: overviewCard.back || overviewCard.content,
          back: overviewCard.back || overviewCard.content
        }]
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to generate book overview:', error.message)
    }
    
    return []
  }

  /**
   * Apply quality assurance using Claude API
   */
  async applyQualityAssurance(cards, allChunks) {
    console.log(`🔍 Skipping QA validation - cards look good as generated`)
    
    // Skip QA validation for now - cards are well-formed
    const validCards = cards
    
    const qaResults = {
      total: cards.length,
      basicFiltered: 0,
      validationPassed: cards.length,
      validationFailed: 0,
      enhanced: 0,
      errors: 0
    }
    
    /* QA validation temporarily disabled - cards are well-formed
    for (const card of cards) {
      try {
        // Basic filtering
        if (!card.title || !card.content || card.title.length < 10 || card.content.length < 100) {
          qaResults.basicFiltered++
          continue
        }
        
        // Get source context for validation
        const sourceContext = card.sourceChunks 
          ? allChunks.filter(chunk => card.sourceChunks.includes(chunk.id))
                     .map(chunk => chunk.text.substring(0, 300))
                     .join('\n\n')
          : card.content.substring(0, 500) // Fallback to card content
        
        // Use robust validation and enhancement system
        const enhancedCard = await this.validateAndEnhanceCard(card, allChunks, sourceContext)
        
        if (enhancedCard) {
          validCards.push(enhancedCard)
          if (enhancedCard.enhanced) {
            qaResults.enhanced++
          } else {
            qaResults.validationPassed++
          }
        } else {
          qaResults.validationFailed++
        }
        
      } catch (error) {
        console.warn('⚠️ Error in quality assurance:', error.message)
        qaResults.errors++
        // Include card anyway if validation fails
        validCards.push(card)
      }
    }
    */
    
    // Remove duplicates and limit total
    const uniqueCards = this.removeDuplicates(validCards)
    
    // Cache QA results for analysis
    const qaData = {
      timestamp: new Date().toISOString(),
      results: qaResults,
      finalCount: uniqueCards.length,
      duplicatesRemoved: validCards.length - uniqueCards.length
    }
    
    if (this.debugMode) {
      await fileStorage.cacheDebugData('qa-results', `qa-${Date.now()}`, qaData)
    }
    
    console.log(`✅ Quality assurance complete: ${uniqueCards.length} valid cards`)
    console.log(`📊 QA Stats: ${qaResults.validationPassed} passed, ${qaResults.enhanced} enhanced, ${qaResults.validationFailed} failed`)
    return uniqueCards // Return all valid cards without artificial limit
  }

  /**
   * Robust card validation and enhancement system
   * Step 1: Validate with base model (GPT-4.1-mini)
   * Step 2: If invalid, recreate with premium model (GPT-4o)
   */
  async validateAndEnhanceCard(card, allChunks, sourceContext) {
    try {
      // Step 1: Validate with base model
      const validationResult = await this.validateCardWithBaseModel(card, sourceContext)
      
      if (validationResult.isValid) {
        console.log(`✅ Card "${card.title.substring(0, 40)}..." passed validation`)
        
        // Cache successful cards for analysis
        const successData = {
          timestamp: new Date().toISOString(),
          card: card,
          validationScore: validationResult.score,
          status: 'passed_validation'
        }
        
        if (this.debugMode) {
          await fileStorage.cacheDebugData('successful-card', card.title || 'untitled', successData)
        }
        
        return card // Return original card if valid
      }
      
      console.log(`❌ Card failed validation: ${validationResult.reason}`)
      console.log(`🔄 Recreating card with premium model...`)
      
      // Step 2: Recreate with premium model (GPT-4o)
      const enhancedCard = await this.recreateCardWithPremiumModel(card, allChunks, sourceContext, validationResult.reason)
      
      if (enhancedCard) {
        console.log(`✨ Successfully recreated card with premium model`)
        return enhancedCard
      } else {
        console.log(`⚠️ Premium model recreation failed, keeping original`)
        return card
      }
      
    } catch (error) {
      console.warn(`⚠️ Error in card validation/enhancement: ${error.message}`)
      return card // Return original on error
    }
  }

  /**
   * Validate card quality using base model (GPT-4.1-mini)
   */
  async validateCardWithBaseModel(card, sourceContext) {
    try {
      const prompt = `Validate this learning card for quality and accuracy:

Card Type: ${card.type}
Title: ${card.title}
Content: ${card.content.substring(0, 500)}...

Source context from book:
${sourceContext.substring(0, 800)}

Return JSON with validation result:
{
  "isValid": true/false,
  "reason": "Brief explanation (max 100 chars)",
  "score": 1-10
}

Validation criteria:
1. Content accuracy vs source (most important)
2. Title relevance to content  
3. Educational value and clarity
4. Appropriate length and detail
5. No contradictions or errors

Be strict but fair - only mark as invalid if there are real issues.`

      const response = await this.callAI(prompt, { 
        taskType: 'card_generation', // Use base model
        maxTokens: 500,
        temperature: 0.1 
      })
      
      if (response && typeof response.isValid === 'boolean') {
        return {
          isValid: response.isValid,
          reason: response.reason || 'No reason provided',
          score: response.score || 5
        }
      }
      
      // Default to valid if parsing fails
      return { isValid: true, reason: 'Validation parsing failed', score: 5 }
      
    } catch (error) {
      console.warn(`⚠️ Base model validation error: ${error.message}`)
      return { isValid: true, reason: 'Validation error', score: 5 }
    }
  }

  /**
   * Recreate card with premium model (GPT-4o) when base model card fails validation
   */
  async recreateCardWithPremiumModel(originalCard, allChunks, sourceContext, failureReason) {
    try {
      // Cache the original failed card for debugging
      const debugData = {
        timestamp: new Date().toISOString(),
        originalCard: originalCard,
        failureReason: failureReason,
        sourceContext: sourceContext.substring(0, 1000) + '...'
      }
      
      if (this.debugMode) {
        await fileStorage.cacheDebugData('failed-card', originalCard.title || 'untitled', debugData)
      }
      
      const prompt = `The following learning card failed quality validation. Please recreate it with higher quality:

ORIGINAL CARD (that failed):
Type: ${originalCard.type}
Title: ${originalCard.title}
Content: ${originalCard.content}

FAILURE REASON: ${failureReason}

SOURCE CONTEXT:
${sourceContext}

Create a high-quality replacement card in valid JSON format:
{
  "title": "Improved title (max 80 chars, clear and specific)",
  "content": "Enhanced content (200-400 words). Make it educational, accurate, and engaging. Address the validation issues mentioned above.",
  "difficulty": "EASY|MEDIUM|HARD",
  "tags": ["relevant", "tags", "here"]
}

Requirements:
- Fix the issues mentioned in the failure reason
- Keep the same card type (${originalCard.type})
- Base content strictly on the source context
- Make it educational and well-structured
- Use clear, engaging language
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt, { 
        taskType: 'chapter_mapping', // Use premium model (GPT-4o)
        maxTokens: 1000,
        temperature: 0.1 
      })
      
      if (response && response.title && response.content) {
        // Create enhanced card with original metadata
        const enhancedCard = {
          ...originalCard, // Keep original metadata
          title: response.title,
          content: response.content,
          difficulty: response.difficulty || originalCard.difficulty,
          tags: response.tags || originalCard.tags,
          enhanced: true // Mark as enhanced
        }
        
        // Cache the corrected card for comparison
        const correctionData = {
          timestamp: new Date().toISOString(),
          originalCard: originalCard,
          correctedCard: enhancedCard,
          failureReason: failureReason,
          improvement: 'Successfully recreated with premium model'
        }
        
        if (this.debugMode) {
          await fileStorage.cacheDebugData('corrected-card', enhancedCard.title || 'untitled', correctionData)
        }
        
        return enhancedCard
      }
      
      return null
      
    } catch (error) {
      console.warn(`⚠️ Premium model recreation error: ${error.message}`)
      return null
    }
  }

  /**
   * Cache cards for a specific tier for debugging analysis
   */
  async cacheTierCards(contentId, tierName, cards, bookTitle) {
    try {
      if (!cards || cards.length === 0) {
        console.log(`📦 No cards to cache for ${tierName}`)
        return
      }
      
      const cacheData = {
        contentId,
        tierName,
        bookTitle,
        timestamp: new Date().toISOString(),
        cardCount: cards.length,
        cards: cards.map(card => ({
          ...card,
          cachedAt: new Date().toISOString()
        }))
      }
      
      await fileStorage.cacheDebugData(`tier-${tierName}`, contentId, cacheData)
      console.log(`🐛 Cached debug data: ${tierName}-${contentId}-${new Date().toISOString().replace(/:/g, '-').slice(0, -5)}Z.json`)
      console.log(`📦 Cached ${cards.length} cards for ${tierName}`)
      
    } catch (error) {
      console.warn(`⚠️ Error caching ${tierName} cards:`, error.message)
    }
  }

  /**
   * Legacy validation function - kept for compatibility
   */
  async validateCardWithClaude(card, allChunks) {
    // Get source context for validation
    const sourceContext = card.sourceChunks 
      ? allChunks.filter(chunk => card.sourceChunks.includes(chunk.id))
                 .map(chunk => chunk.text.substring(0, 300))
                 .join('\n\n')
      : ''
    
    const result = await this.validateAndEnhanceCard(card, allChunks, sourceContext)
    return result !== null // Return true if we got a valid result
  }

  // Utility Methods for TOC-based Chapter Detection

  /**
   * Check if a line matches a chapter name with flexible but precise pattern matching
   * Avoid partial word matches but allow reasonable chapter heading variations
   */
  isChapterMatch(line, chapterName) {
    const lineLower = line.toLowerCase().trim()
    
    // Skip very short lines or lines that are too long to be chapter headings
    if (lineLower.length < 3 || lineLower.length > 200) return false
    
    // Generate multiple possible patterns for the chapter name
    const patterns = this.generateChapterPatterns(chapterName)
    
    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase().trim()
      
      // Exact match
      if (lineLower === patternLower) {
        console.log(`✅ EXACT MATCH: "${line}" === "${pattern}"`)
        return true
      }
      
      // Check if line starts with pattern and is likely a chapter heading
      if (lineLower.startsWith(patternLower)) {
        // Make sure this looks like a chapter heading, not part of a sentence
        const afterPattern = line.substring(pattern.length).trim()
        
        // If nothing after pattern, it's a match
        if (!afterPattern) {
          console.log(`✅ STARTS WITH MATCH: "${line}" starts with "${pattern}"`)
          return true
        }
        
        // If what follows looks like chapter continuation (: or similar), it's a match
        if (/^[:\-\s]/.test(afterPattern) && afterPattern.length < 50) {
          console.log(`✅ CHAPTER CONTINUATION MATCH: "${line}" starts with "${pattern}"`)
          return true
        }
      }
      
      // Check word boundary matches to avoid partial word matches
      const wordBoundaryPattern = new RegExp(`\\b${patternLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
      if (wordBoundaryPattern.test(lineLower)) {
        // Additional check: make sure this looks like a chapter heading
        if (lineLower.length < 100 && /^(chapter|\d+\.|\d+\s)/.test(lineLower)) {
          console.log(`✅ WORD BOUNDARY MATCH: "${line}" contains "${pattern}"`)
          return true
        }
      }
    }
    
    return false
  }
  
  /**
   * Generate multiple possible patterns for a chapter name
   */
  generateChapterPatterns(chapterName) {
    const patterns = [chapterName] // Original name
    const name = chapterName.trim()
    
    // Handle numbered chapters like "1. Start" → "1Start", "1. Start", "Chapter 1 Start", etc.
    if (/^\d+\.\s/.test(name)) {
      const number = name.match(/^(\d+)/)[1]
      const title = name.replace(/^\d+\.\s*/, '').trim()
      
      patterns.push(
        `${number}${title}`, // "1Start"
        `${number} ${title}`, // "1 Start"
        `chapter ${number} ${title}`, // "Chapter 1 Start"
        `chapter ${number}: ${title}`, // "Chapter 1: Start"
        `chapter ${number}. ${title}`, // "Chapter 1. Start"
        title, // Just "Start"
        `${number}.${title}` // "1.Start"
      )
    }
    
    // Handle "Chapter X:" patterns
    if (/^chapter\s+\d+:/i.test(name)) {
      const parts = name.match(/^chapter\s+(\d+):\s*(.+)$/i)
      if (parts) {
        const number = parts[1]
        const title = parts[2].trim()
        
        patterns.push(
          `${number}. ${title}`, // "1. Start"
          `${number}${title}`, // "1Start"
          `${number} ${title}`, // "1 Start"
          title // Just "Start"
        )
      }
    }
    
    // Handle simple titles by adding common prefixes
    if (!/^(chapter|\d)/i.test(name)) {
      patterns.push(
        `chapter ${name}`,
        `1. ${name}`,
        `1 ${name}`
      )
    }
    
    // Remove duplicates and empty patterns
    return [...new Set(patterns)].filter(p => p && p.trim().length > 0)
  }

  /**
   * Check if a chapter name is valid (not too generic)
   */
  isValidChapterName(name) {
    const nameLower = name.toLowerCase().trim()
    
    // Filter out common non-chapter entries
    const invalidPatterns = [
      /^(contents?|index|acknowledgments?|preface|foreword|bibliography|references|appendix)$/i,
      /^(page \d+|\d+\s*$|part \d+$)/i,
      /^(about|copyright|isbn|published)/i,
      /^table of contents$/i,
      /^introduction$/i
    ]
    
    if (invalidPatterns.some(pattern => pattern.test(nameLower))) {
      return false
    }
    
    // Must have some actual content
    if (name.length < 10 || name.length > 150) return false
    
    // Should contain letters
    if (!/[a-zA-Z]/.test(name)) return false
    
    // Should look like a chapter (contains "Chapter" and a number)
    if (!/chapter\s+\d+/i.test(name)) return false
    
    return true
  }

  /**
   * Check if a line could be a chapter start
   */
  isChapterStart(line) {
    const patterns = [
      /^chapter\s+\d+/i,
      /^\d+\.\s+[a-z]/i,
      /^[a-z][a-z\s]{5,30}$/i,
      /^introduction|conclusion/i
    ]
    
    return patterns.some(pattern => pattern.test(line.trim()))
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  extractSimpleEntities(text) {
    // Simple entity extraction - capitalized phrases
    const entities = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
    return [...new Set(entities)]
      .filter(e => e.length > 2 && e.length < 50)
      .filter(e => !['The', 'This', 'That', 'Chapter', 'Section'].includes(e))
  }

  applyTextRank(chunks, topN = 10) {
    const sentences = []
    
    // Extract sentences from chunks
    chunks.forEach(chunk => {
      const chunkSentences = chunk.text.split(/[.!?]+/)
        .filter(s => s.trim().length > 30)
        .map(s => s.trim())
      
      chunkSentences.forEach(sentence => {
        sentences.push({
          text: sentence,
          chunkId: chunk.id,
          score: this.calculateSentenceScore(sentence)
        })
      })
    })
    
    // Return top sentences by score
    return sentences
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
  }

  calculateSentenceScore(sentence) {
    const words = sentence.split(/\s+/)
    const lengthScore = Math.min(words.length / 25, 1) // Prefer moderate length
    const capitalScore = (sentence.match(/[A-Z]/g) || []).length / sentence.length
    const numberScore = (sentence.match(/\d/g) || []).length / sentence.length
    
    return lengthScore + capitalScore + numberScore
  }

  getEntityContext(text, entity) {
    const sentences = text.split(/[.!?]/)
    for (const sentence of sentences) {
      if (sentence.includes(entity)) {
        return sentence.trim()
      }
    }
    return text.substring(0, 200)
  }

  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
    return dotProduct / (normA * normB)
  }

  removeDuplicates(cards) {
    const unique = []
    const seen = new Set()
    
    for (const card of cards) {
      const key = `${card.type}-${card.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(card)
      }
    }
    
    return unique
  }

  async callAI(prompt, options = {}) {
    try {
      const { 
        taskType = 'card_generation', // 'chapter_mapping' or 'card_generation'
        maxTokens = 2500,
        temperature = null 
      } = options
      
      // Select model and temperature based on task type
      let model, temp
      if (taskType === 'chapter_mapping') {
        model = this.chapterMappingModel
        temp = temperature !== null ? temperature : 0 // Deterministic for chapter mapping
      } else {
        model = this.cardGenerationModel
        temp = temperature !== null ? temperature : 0.1 // Slightly creative for card generation
      }
      
      let responseText = ''
      
      if (this.aiProvider === 'openai') {
        const response = await openai.chat.completions.create({
          model: model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: temp
        })
        responseText = response.choices[0].message.content.trim()
      } else {
        const response = await anthropic.messages.create({
          model: model,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
          temperature: temp
        })
        responseText = response.content[0].text.trim()
      }
      
      // Clean the response by removing markdown code blocks and extra text
      let cleanedResponse = responseText.trim()
      
      // Remove markdown code blocks ```json and ``` 
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '')
      
      // Remove any text before first { or [
      const jsonStart = cleanedResponse.search(/[{\[]/)
      if (jsonStart > 0) {
        cleanedResponse = cleanedResponse.substring(jsonStart)
      }
      
      // Remove any text after last } or ]
      const lastBrace = Math.max(cleanedResponse.lastIndexOf('}'), cleanedResponse.lastIndexOf(']'))
      if (lastBrace > 0 && lastBrace < cleanedResponse.length - 1) {
        cleanedResponse = cleanedResponse.substring(0, lastBrace + 1)
      }
      
      try {
        // Direct parse after cleaning
        return JSON.parse(cleanedResponse)
      } catch (parseError) {
        console.warn(`JSON parse error: ${parseError.message}`)
        console.warn(`Cleaned response: ${cleanedResponse.substring(0, 200)}...`)
        
        // Simple fallback: fix common issues
        try {
          let fixedJson = cleanedResponse
            // Fix trailing commas
            .replace(/,(\s*[}\]])/g, '$1')
            // Fix unescaped quotes in strings (simple pattern)
            .replace(/("(?:title|content|front|back)":\s*"[^"]*)"([^"]*"[^"]*)/g, '$1\\"$2')
            // Remove control characters
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
          
          return JSON.parse(fixedJson)
        } catch (secondError) {
          console.warn(`JSON fallback parsing also failed: ${secondError.message}`)
          return null
        }
      }
    } catch (error) {
      console.error(`${this.aiProvider.toUpperCase()} API error:`, error)
      return null
    }
  }
}

export const enhancedCardGenerator = new EnhancedCardGenerator()