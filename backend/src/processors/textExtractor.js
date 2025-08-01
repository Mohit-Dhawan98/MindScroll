import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { EPub } from 'epub2'
import natural from 'natural'

// pdf.js-extract uses CommonJS, need to import it differently
const require = createRequire(import.meta.url)
const PDFExtract = require('pdf.js-extract').PDFExtract
const pdfExtract = new PDFExtract()

export async function extractTextFromPDF(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase()
    
    let result
    switch (ext) {
      case '.pdf':
        result = await extractFromPDF(filePath)
        break
      case '.epub':
        result = await extractFromEPUB(filePath)
        break
      case '.txt':
        result = await extractFromTXT(filePath)
        break
      default:
        throw new Error(`Unsupported file type: ${ext}`)
    }
    
    // For backwards compatibility, return text if result is a string
    if (typeof result === 'string') {
      return result
    }
    
    // Return the full structured result object (not just text for backwards compatibility)
    // This preserves page structure and metadata for enhanced processing
    return result
    
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error)
    throw error
  }
}

async function extractFromPDF(filePath) {
  try {
    console.log(`📄 Extracting PDF: ${path.basename(filePath)}`)
    
    // Use pdf.js-extract for reliable extraction
    const pdfData = await new Promise((resolve, reject) => {
      pdfExtract.extract(filePath, {}, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
    
    // Extract text from all pages with proper structure preservation
    let fullText = ''
    const pages = []
    
    console.log(`📊 Processing ${pdfData.pages.length} pages with detailed structure...`)
    
    for (let pageNum = 0; pageNum < pdfData.pages.length; pageNum++) {
      const page = pdfData.pages[pageNum]
      
      // Sort content by Y position (top to bottom) then X position (left to right)
      const sortedContent = page.content
        .filter(item => item.str && item.str.trim())
        .sort((a, b) => {
          // Sort by Y position first (top to bottom)
          const yDiff = Math.abs(a.y - b.y)
          if (yDiff > 5) { // Same line tolerance
            return b.y - a.y // Higher Y values come first (top of page)
          }
          // If on same line, sort by X position (left to right)
          return a.x - b.x
        })
      
      // Group content into lines based on Y position
      const lines = []
      let currentLine = []
      let currentY = null
      
      for (const item of sortedContent) {
        if (currentY === null || Math.abs(item.y - currentY) <= 5) {
          // Same line (within 5 units tolerance)
          currentLine.push(item.str.trim())
          currentY = item.y
        } else {
          // New line
          if (currentLine.length > 0) {
            lines.push(currentLine.join(' '))
          }
          currentLine = [item.str.trim()]
          currentY = item.y
        }
      }
      
      // Add the last line
      if (currentLine.length > 0) {
        lines.push(currentLine.join(' '))
      }
      
      // Join lines for this page
      const pageText = lines
        .filter(line => line.length > 0)
        .join('\n')
      
      if (pageText.trim()) {
        pages.push({
          pageNumber: pageNum + 1,
          text: pageText.trim(),
          lines: lines.filter(line => line.length > 0),
          wordCount: pageText.split(/\s+/).length
        })
        
        // Add page break marker and page content to full text
        fullText += `\n--- PAGE ${pageNum + 1} ---\n`
        fullText += pageText + '\n\n'
      }
    }
    
    console.log(`📊 Structured extraction: ${pages.length} pages, ${pages.reduce((sum, p) => sum + p.lines.length, 0)} total lines`)
    
    if (!fullText || fullText.length < 100) {
      throw new Error('PDF appears to be empty or contains mostly images')
    }
    
    // Clean and normalize the extracted text
    let cleanText = fullText
      .replace(/\f/g, '\n\n') // Form feeds to paragraph breaks
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
      // Don't collapse spaces within lines, but normalize line structure
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim()) // Normalize spaces within each line
      .filter(line => line.length > 0) // Remove empty lines
      .join('\n')
      .replace(/[^\w\s.,!?;:()\-"'\n]/g, '') // Remove special chars but keep punctuation
      .trim()
    
    // Extract metadata
    const metadata = {
      pages: pdfData.pages.length,
      extractedPages: pages.length,
      wordCount: cleanText.split(/\s+/).length,
      charCount: cleanText.length,
      extractedWith: 'pdf.js-extract',
      averageWordsPerPage: pages.length > 0 ? Math.round(pages.reduce((sum, p) => sum + p.wordCount, 0) / pages.length) : 0
    }
    
    console.log(`✅ PDF extracted: ${metadata.pages} pages, ${metadata.wordCount} words`)
    
    return {
      text: cleanText,
      pages: pages, // Structured page data
      metadata
    }
    
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error(`Failed to extract PDF: ${error.message}`)
  }
}

function cleanHtmlContent(htmlContent) {
  if (!htmlContent) return ''
  
  // Enhanced HTML cleaning that preserves text structure
  let cleanText = htmlContent
    // First, handle specific HTML elements that should become line breaks
    .replace(/<\/?(h[1-6]|p|div|br|li|tr)(\s[^>]*)?\s*>/gi, '\n')
    .replace(/<\/?(ul|ol|table)(\s[^>]*)?\s*>/gi, '\n\n')
    
    // Convert HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, ' ')
    
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  
  return cleanText
}

async function extractFromEPUB(filePath) {
  try {
    console.log(`📖 Extracting EPUB: ${path.basename(filePath)}`)
    
    const epub = new EPub(filePath)
    
    // Parse the EPUB file
    await new Promise((resolve, reject) => {
      epub.parse()
      epub.on('end', resolve)
      epub.on('error', reject)
    })
    
    let fullText = ''
    const pages = [] // Use pages array for compatibility with enhanced card generator
    const chapters = []
    
    console.log(`📊 Processing ${epub.flow.length} EPUB chapters with enhanced structure...`)
    
    // Extract text from each chapter with proper HTML processing
    for (let chapterIndex = 0; chapterIndex < epub.flow.length; chapterIndex++) {
      const chapter = epub.flow[chapterIndex]
      try {
        const chapterHtml = await new Promise((resolve, reject) => {
          epub.getChapterRaw(chapter.id, (err, text) => {
            if (err) reject(err)
            else resolve(text)
          })
        })
        
        // Enhanced HTML cleaning that preserves structure
        const cleanChapterText = cleanHtmlContent(chapterHtml)
        
        if (cleanChapterText.length > 100) {
          // Split chapter into logical sections/paragraphs for page-like structure
          const paragraphs = cleanChapterText
            .split(/\n\s*\n/)
            .filter(p => p.trim().length > 50)
          
          // Group paragraphs into "pages" (similar to PDF pages for consistency)
          const wordsPerPage = 300 // Reasonable page size for EPUB
          let currentPageText = ''
          let currentPageLines = []
          
          for (const paragraph of paragraphs) {
            const paragraphWords = paragraph.split(/\s+/).length
            
            if (currentPageText.split(/\s+/).length + paragraphWords > wordsPerPage && currentPageText) {
              // Create a "page" from accumulated content
              pages.push({
                pageNumber: pages.length + 1,
                text: currentPageText.trim(),
                lines: currentPageLines.filter(line => line.length > 0),
                wordCount: currentPageText.split(/\s+/).length,
                chapterIndex: chapterIndex,
                chapterTitle: chapter.title || `Chapter ${chapterIndex + 1}`
              })
              
              // Add page break marker to full text
              fullText += `\n--- PAGE ${pages.length} ---\n`
              fullText += currentPageText + '\n\n'
              
              // Start new page
              currentPageText = paragraph
              currentPageLines = [paragraph]
            } else {
              if (currentPageText) currentPageText += '\n\n'
              currentPageText += paragraph
              currentPageLines.push(paragraph)
            }
          }
          
          // Add remaining content as final page
          if (currentPageText.trim()) {
            pages.push({
              pageNumber: pages.length + 1,
              text: currentPageText.trim(),
              lines: currentPageLines.filter(line => line.length > 0),
              wordCount: currentPageText.split(/\s+/).length,
              chapterIndex: chapterIndex,
              chapterTitle: chapter.title || `Chapter ${chapterIndex + 1}`
            })
            
            fullText += `\n--- PAGE ${pages.length} ---\n`
            fullText += currentPageText + '\n\n'
          }
          
          // Store chapter info for backwards compatibility
          chapters.push({
            title: chapter.title || `Chapter ${chapterIndex + 1}`,
            text: cleanChapterText,
            startPage: Math.max(1, pages.length - Math.ceil(cleanChapterText.split(/\s+/).length / wordsPerPage)),
            endPage: pages.length
          })
        }
      } catch (chapterError) {
        console.warn(`Failed to extract chapter ${chapter.id}:`, chapterError.message)
      }
    }
    
    if (fullText.length < 100) {
      throw new Error('EPUB appears to be empty or unreadable')
    }
    
    // Clean and normalize the full text (similar to PDF processing)
    let cleanText = fullText
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim()) // Normalize spaces within each line
      .filter(line => line.length > 0) // Remove empty lines
      .join('\n')
      .replace(/[^\w\s.,!?;:()\-"'\n]/g, '') // Remove special chars but keep punctuation
      .trim()
    
    const metadata = {
      title: epub.metadata.title,
      author: epub.metadata.creator,
      pages: pages.length,
      extractedPages: pages.length,
      chapters: chapters.length,
      wordCount: cleanText.split(/\s+/).length,
      charCount: cleanText.length,
      extractedWith: 'epub2',
      averageWordsPerPage: pages.length > 0 ? Math.round(pages.reduce((sum, p) => sum + p.wordCount, 0) / pages.length) : 0
    }
    
    console.log(`✅ EPUB extracted: ${pages.length} pages (${chapters.length} chapters), ${metadata.wordCount} words`)
    
    // Return structure compatible with enhanced card generator (same as PDF)
    return {
      text: cleanText,
      pages: pages, // Structured page data for chapter detection
      chapters: chapters, // Keep for backwards compatibility
      metadata
    }
    
  } catch (error) {
    console.error('EPUB extraction error:', error)
    throw new Error(`Failed to extract EPUB: ${error.message}`)
  }
}

async function extractFromTXT(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    console.error('TXT extraction error:', error)
    return null
  }
}

export function cleanAndChunkText(text, chunkSize = 3000) {
  if (!text) return []
  
  // Enhanced semantic chunking
  const chunks = []
  const paragraphs = text.split(/\n\s*\n/) // Split on paragraph breaks
  
  let currentChunk = ''
  let currentConcepts = []
  
  for (const paragraph of paragraphs) {
    const cleanParagraph = paragraph.trim()
    if (!cleanParagraph) continue
    
    // Detect concept boundaries (chapter headings, sections, etc.)
    const isHeading = isConceptBoundary(cleanParagraph)
    const conceptKeywords = extractKeywords(cleanParagraph)
    
    // Start new chunk if we hit a major concept boundary
    if (isHeading && currentChunk.length > 500) {
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          concepts: currentConcepts,
          wordCount: currentChunk.split(/\s+/).length,
          type: 'content'
        })
      }
      currentChunk = cleanParagraph
      currentConcepts = conceptKeywords
    } else {
      // Add to current chunk
      if (currentChunk) currentChunk += '\n\n'
      currentChunk += cleanParagraph
      currentConcepts = [...new Set([...currentConcepts, ...conceptKeywords])]
    }
    
    // Split chunk if too large (preserve paragraph boundaries)
    if (currentChunk.length > chunkSize) {
      const sentences = currentChunk.split(/(?<=[.!?])\s+/)
      let splitChunk = ''
      
      for (const sentence of sentences) {
        if (splitChunk.length + sentence.length > chunkSize && splitChunk) {
          chunks.push({
            text: splitChunk.trim(),
            concepts: extractKeywords(splitChunk),
            wordCount: splitChunk.split(/\s+/).length,
            type: 'content'
          })
          splitChunk = sentence
        } else {
          if (splitChunk) splitChunk += ' '
          splitChunk += sentence
        }
      }
      
      currentChunk = splitChunk
      currentConcepts = extractKeywords(currentChunk)
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      concepts: currentConcepts,
      wordCount: currentChunk.split(/\s+/).length,
      type: 'content'
    })
  }
  
  // Filter out very small chunks and return just text for backwards compatibility
  return chunks
    .filter(chunk => chunk.wordCount > 50)
    .map(chunk => chunk.text)
}

function isConceptBoundary(text) {
  // Detect chapter headings, sections, major topic changes
  const headingPatterns = [
    /^(Chapter|Section|Part)\s+\d+/i,
    /^\d+\.\s+[A-Z]/,
    /^[A-Z][A-Z\s]{3,}$/,
    /^Introduction|Conclusion|Summary/i
  ]
  
  return headingPatterns.some(pattern => pattern.test(text.substring(0, 100)))
}

function extractKeywords(text) {
  // Simple keyword extraction using natural language processing
  const tokenizer = natural.WordTokenizer()
  const tokens = tokenizer.tokenize(text.toLowerCase())
  
  // Filter out common words and short words
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'])
  
  const keywords = tokens
    .filter(token => token && token.length > 3 && !stopWords.has(token))
    .filter(token => /^[a-zA-Z]+$/.test(token)) // Only alphabetic
  
  // Get frequency and return top keywords
  const frequency = {}
  keywords.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1
  })
  
  return Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word)
}