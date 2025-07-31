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
 * Hierarchical Processing + TextRank + Semantic RAG + API-based Quality
 */
export class EnhancedCardGenerator {
  constructor(aiProvider = 'openai') {
    this.embedder = null
    this.tfidf = new natural.TfIdf()
    this.initialized = false
    this.vectorStore = new Map() // Simple in-memory vector store
    this.aiProvider = aiProvider // 'openai' or 'anthropic'
    this.model = aiProvider === 'openai' ? 'gpt-4.1-mini' : 'claude-3-haiku-20240307'
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
  async generateEnhancedLearningCards(textContent, bookTitle, author, category) {
    try {
      await this.initialize()
      
      console.log(`🧠 Enhanced card generation for: ${bookTitle} by ${author}`)
      
      // Step 1: Detect book structure (chapters/sections)
      const bookStructure = await this.detectBookStructure(textContent)
      console.log(`📚 Detected ${bookStructure.chapters.length} chapters`)
      
      // Step 2: Create semantic chunks for entire book
      const allChunks = await this.createSemanticChunks(textContent, bookStructure)
      console.log(`📝 Created ${allChunks.length} semantic chunks`)
      
      // Step 3: Generate embeddings for all chunks (for RAG)
      await this.buildVectorStore(allChunks)
      console.log(`🔢 Built vector store with ${allChunks.length} embeddings`)
      
      // Step 4: Process each chapter + generate book-level cards
      const allCards = []
      
      // Generate chapter-level cards
      for (const chapter of bookStructure.chapters) {
        const chapterCards = await this.processChapter(chapter, allChunks, bookTitle, author, category)
        allCards.push(...chapterCards)
        console.log(`📖 Chapter "${chapter.title}": Generated ${chapterCards.length} cards`)
      }
      
      // Generate book-level overview cards
      const overviewCards = await this.generateBookOverview(bookStructure, allChunks, bookTitle, author, category)
      allCards.push(...overviewCards)
      console.log(`📋 Generated ${overviewCards.length} book overview cards`)
      
      // Step 5: Quality assurance and final filtering
      const finalCards = await this.applyQualityAssurance(allCards, allChunks)
      
      console.log(`✨ Final output: ${finalCards.length} high-quality cards`)
      console.log(`📊 Breakdown: ${finalCards.filter(c => c.type === 'SUMMARY').length} summaries, ${finalCards.filter(c => c.type === 'FLASHCARD').length} flashcards, ${finalCards.filter(c => c.type === 'QUIZ').length} quizzes`)
      
      return finalCards
      
    } catch (error) {
      console.error('❌ Error in enhanced card generation:', error)
      return []
    }
  }

  /**
   * SIMPLIFIED 2-TIER APPROACH for chapter detection
   * Tier 1: AI chapter name detection + AI page range mapping
   * Tier 2: Page-level chunking fallback based on average words per page
   */
  async detectBookStructure(textContent) {
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
    return tier2Result
  }

  /**
   * AI-powered chapter detection using first pages of the book with structured data
   */
  async detectChaptersWithAI(firstPagesText, structuredPages = null) {
    try {
      const prompt = `Analyze this excerpt from the beginning of a book and extract all chapter titles/names.

Book excerpt (first ~10 pages):
${firstPagesText}

Please identify all chapter titles from this text. Look for:
1. Table of Contents entries
2. Chapter headings (Chapter 1:, Chapter 2:, etc.)
3. Section titles that appear to be main chapters

Return a JSON array of chapter titles in the order they appear:
{
  "chapters": [
    "Chapter 1: Introduction to Clean Code",
    "Chapter 2: Meaningful Names",
    "Chapter 3: Functions"
  ]
}

IMPORTANT:
- Only include actual chapter titles, not subsections
- Preserve the original chapter names as they appear in the book
- Return empty array if no clear chapters are found
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt)
      
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
      
      // Create comprehensive page summary for AI analysis (more content per page)
      const pagesSummary = bookPages.map(page => {
        // Use full page content (not just first few lines)
        const pageContent = page.text.substring(0, 800) // First 800 chars per page
        return `Page ${page.pageNumber}: ${pageContent}${page.text.length > 800 ? '...' : ''}`
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
- Map ALL ${chapterNames.length} detected chapters (don't skip any)
- Use the EXACT chapter names I provided above
- Each chapter should span multiple pages (minimum 3 pages)
- Ensure page ranges don't overlap
- Return only the JSON, no additional text`

      const response = await this.callAI(prompt)
      
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
    
    // Map missing chapters to gaps
    const filledChapters = [...mappedChapters]
    
    for (let i = 0; i < Math.min(missingChapters.length, gaps.length); i++) {
      const missingChapter = missingChapters[i]
      const gap = gaps[i]
      
      // Get pages for this gap
      const gapPages = structuredPages.filter(page => 
        page.pageNumber >= gap.startPage && page.pageNumber <= gap.endPage
      )
      
      if (gapPages.length > 0) {
        const gapContent = gapPages.map(page => page.text).join('\n\n')
        const wordCount = gapContent.split(/\s+/).length
        
        const filledChapter = {
          title: missingChapter,
          startPage: gap.startPage,
          endPage: gap.endPage,
          content: gapContent,
          wordCount: wordCount,
          isGapFilled: true
        }
        
        filledChapters.push(filledChapter)
        console.log(`✅ Gap-filled chapter "${missingChapter}" to pages ${gap.startPage}-${gap.endPage} (${wordCount} words)`)
      }
    }
    
    // Sort all chapters by start page again
    filledChapters.sort((a, b) => a.startPage - b.startPage)
    
    console.log(`🎯 Final result: ${filledChapters.length}/${allChapterNames.length} chapters (${filledChapters.filter(ch => ch.isGapFilled).length} gap-filled)`)
    
    return filledChapters
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
    
    for (const chapter of bookStructure.chapters) {
      const paragraphs = chapter.content.split(/\n\s*\n/).filter(p => p.trim().length > 50)
      const chunkSize = 1800 // Target characters
      const overlapSize = 200 // Overlap characters
      
      let currentChunk = ''
      let paragraphStart = 0
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim()
        
        if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 300) {
          // Save current chunk
          chunks.push({
            id: `chunk_${chunkId++}`,
            text: currentChunk.trim(),
            chapterTitle: chapter.title,
            startParagraph: paragraphStart,
            endParagraph: i - 1,
            wordCount: currentChunk.split(/\s+/).length,
            entities: this.extractSimpleEntities(currentChunk),
            embedding: null // Will be filled later
          })
          
          // Start new chunk with overlap
          const words = currentChunk.split(/\s+/)
          const overlapWords = words.slice(-Math.floor(overlapSize / 6)) // Approximate overlap
          currentChunk = overlapWords.join(' ') + ' ' + paragraph
          paragraphStart = Math.max(0, i - 2)
        } else {
          if (currentChunk) currentChunk += '\n\n'
          currentChunk += paragraph
        }
      }
      
      // Save final chunk for this chapter
      if (currentChunk.trim()) {
        chunks.push({
          id: `chunk_${chunkId++}`,
          text: currentChunk.trim(),
          chapterTitle: chapter.title,
          startParagraph: paragraphStart,
          endParagraph: paragraphs.length - 1,
          wordCount: currentChunk.split(/\s+/).length,
          entities: this.extractSimpleEntities(currentChunk),
          embedding: null
        })
      }
    }
    
    return chunks.filter(chunk => chunk.wordCount > 30)
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
   * Process individual chapter to generate cards
   */
  async processChapter(chapter, allChunks, bookTitle, author, category) {
    console.log(`📖 Processing chapter: "${chapter.title}"`)
    
    const chapterChunks = allChunks.filter(chunk => chunk.chapterTitle === chapter.title)
    const cards = []
    
    try {
      // 1. Generate summary card for chapter using TextRank + RAG
      const summaryCard = await this.generateChapterSummary(chapter, chapterChunks, bookTitle, author, category)
      if (summaryCard) cards.push(summaryCard)
      
      // 2. Generate flashcards for key entities in chapter
      const flashcards = await this.generateChapterFlashcards(chapter, chapterChunks, bookTitle, author, category)
      cards.push(...flashcards)
      
      // 3. Generate quiz cards from best flashcards
      const quizCards = await this.generateChapterQuizzes(flashcards.slice(0, 2), bookTitle, author, category)
      cards.push(...quizCards)
      
    } catch (error) {
      console.warn(`⚠️ Error processing chapter "${chapter.title}":`, error.message)
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

Create a summary card in JSON format:
{
  "title": "Chapter summary title (max 70 chars)",
  "content": "Comprehensive chapter summary (250-350 words). Include:\n• Main concepts and key points from this chapter\n• How this chapter connects to themes from other parts of the book\n• Key insights and takeaways\n• Why this chapter matters in the book's overall message",
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

Create a flashcard in JSON format:
{
  "title": "Question about ${entityData.entity} (max 80 chars)",
  "content": "Comprehensive answer (200-300 words). Include:\n• Clear explanation of ${entityData.entity}\n• How it relates to the main themes\n• Examples and context from the book\n• Why it's important to understand",
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

Create a quiz card in JSON format:
{
  "title": "${flashcard.title}",
  "content": "Brief explanation after answering (100-150 words)",
  "quiz": {
    "question": "Clear, focused question based on the flashcard",
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
            chapterTitle: flashcard.chapterTitle,
            sourceFlashcard: flashcard.entity,
            sourceChunks: flashcard.sourceChunks
          })
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate quiz from flashcard:`, error.message)
      }
    }
    
    return quizCards
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

Create an overview card in JSON format:
{
  "title": "Overview: ${bookTitle}",
  "content": "Comprehensive book overview (300-400 words). Include:\n• Main themes and central message\n• How the chapters connect\n• Key insights and takeaways\n• Why this book matters",
  "difficulty": "MEDIUM",
  "tags": ["overview", "${category}", "book-summary"]
}

Focus on the big picture and connections. Return only the JSON.`

      const overviewCard = await this.callAI(prompt)
      
      if (overviewCard) {
        return [{
          ...overviewCard,
          type: 'SUMMARY',
          chapterTitle: 'Book Overview',
          sourceChunks: allChunks.slice(0, 5).map(c => c.id)
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
    console.log(`🔍 Applying quality assurance to ${cards.length} cards...`)
    
    const validCards = []
    
    for (const card of cards) {
      try {
        // Basic filtering
        if (!card.title || !card.content || card.title.length < 10 || card.content.length < 100) {
          continue
        }
        
        // API-based validation with Claude
        const isValid = await this.validateCardWithClaude(card, allChunks)
        
        if (isValid) {
          validCards.push(card)
        }
        
      } catch (error) {
        console.warn('⚠️ Error in quality assurance:', error.message)
        // Include card anyway if validation fails
        validCards.push(card)
      }
    }
    
    // Remove duplicates and limit total
    const uniqueCards = this.removeDuplicates(validCards)
    
    console.log(`✅ Quality assurance complete: ${uniqueCards.length} valid cards`)
    return uniqueCards.slice(0, 35) // Limit to 35 total cards
  }

  /**
   * Validate card quality using Claude API
   */
  async validateCardWithClaude(card, allChunks) {
    try {
      // Get source context for validation
      const sourceContext = card.sourceChunks 
        ? allChunks.filter(chunk => card.sourceChunks.includes(chunk.id))
                   .map(chunk => chunk.text.substring(0, 300))
                   .join('\n\n')
        : ''
      
      const prompt = `Validate this learning card for accuracy and quality:

Card Type: ${card.type}
Title: ${card.title}
Content: ${card.content}

Source context from book:
${sourceContext}

Answer with JSON:
{
  "isValid": true/false,
  "reason": "Brief explanation of validation result"
}

Validate that:
1. Content is accurate based on source
2. Title matches content
3. Information is educational and clear
4. No contradictions or errors

Return only the JSON.`

      const validation = await this.callAI(prompt)
      
      return validation && validation.isValid
      
    } catch (error) {
      console.warn('⚠️ Card validation failed:', error.message)
      return true // Default to valid if validation fails
    }
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

  async callAI(prompt) {
    try {
      let responseText = ''
      
      if (this.aiProvider === 'openai') {
        const response = await openai.chat.completions.create({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2500,
          temperature: 0.1
        })
        responseText = response.choices[0].message.content.trim()
      } else {
        const response = await anthropic.messages.create({
          model: this.model,
          max_tokens: 2500,
          messages: [{ role: "user", content: prompt }]
        })
        responseText = response.content[0].text.trim()
      }
      
      // First, clean the response by removing markdown code blocks
      let cleanedResponse = responseText.trim()
      
      // Remove markdown code blocks (```json ... ``` or ``` ... ```)
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '')
      cleanedResponse = cleanedResponse.replace(/\n?\s*```\s*$/i, '')
      
      // Extract JSON object
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch (parseError) {
          console.warn(`JSON parse error: ${parseError.message}`)
          console.warn(`Raw response: ${responseText.substring(0, 500)}...`)
          
          // Try to fix common JSON issues
          let fixedJson = jsonMatch[0]
          
          // Fix unescaped single quotes in JSON strings (common issue)
          fixedJson = fixedJson.replace(/(:\s*"[^"]*)'([^"]*")/g, '$1\\\'$2')
          
          // Fix unescaped double quotes inside JSON strings
          fixedJson = fixedJson.replace(/(:\s*"[^"]*[^\\])"([^"]*")/g, '$1\\"$2')
          
          // Fix newlines and carriage returns that break JSON
          fixedJson = fixedJson.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
          
          // Fix tab characters
          fixedJson = fixedJson.replace(/\t/g, '\\t')
          
          try {
            return JSON.parse(fixedJson)
          } catch (secondError) {
            console.warn(`Second JSON parse attempt failed: ${secondError.message}`)
            console.warn(`Attempted to parse: ${fixedJson.substring(0, 200)}...`)
            
            // Last resort: try to extract just the structure we need
            try {
              const titleMatch = fixedJson.match(/"title":\s*"([^"]+)"/i)
              const contentMatch = fixedJson.match(/"content":\s*"([^"]+(?:\\.[^"]*)*)"/)
              const difficultyMatch = fixedJson.match(/"difficulty":\s*"([^"]+)"/i)
              const tagsMatch = fixedJson.match(/"tags":\s*\[([^\]]*)\]/)
              
              if (titleMatch && contentMatch) {
                const result = {
                  title: titleMatch[1],
                  content: contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
                  difficulty: difficultyMatch ? difficultyMatch[1] : 'MEDIUM',
                  tags: tagsMatch ? JSON.parse(`[${tagsMatch[1]}]`) : []
                }
                console.log(`✅ Successfully extracted JSON using fallback parsing`)
                return result
              }
            } catch (fallbackError) {
              console.warn(`Fallback parsing failed: ${fallbackError.message}`)
            }
            
            return null
          }
        }
      }
      
      return null
    } catch (error) {
      console.error(`${this.aiProvider.toUpperCase()} API error:`, error)
      return null
    }
  }
}

export const enhancedCardGenerator = new EnhancedCardGenerator()