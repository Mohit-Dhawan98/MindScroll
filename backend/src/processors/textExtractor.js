import fs from 'fs'
import path from 'path'
import { extractText } from 'unpdf'
import { EPub } from 'epub2'
import natural from 'natural'

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
    
    // Return the text content for backwards compatibility
    return result.text
    
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error)
    throw error
  }
}

async function extractFromPDF(filePath) {
  try {
    console.log(`📄 Extracting PDF: ${path.basename(filePath)}`)
    
    const dataBuffer = fs.readFileSync(filePath)
    const extractedText = await extractText(dataBuffer)
    
    if (!extractedText || extractedText.length < 100) {
      throw new Error('PDF appears to be empty or contains mostly images')
    }
    
    // Clean and normalize the extracted text
    let cleanText = extractedText
      .replace(/\f/g, '\n\n') // Form feeds to paragraph breaks
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/[^\w\s.,!?;:()\-"'\n]/g, '') // Remove special chars but keep punctuation
      .trim()
    
    // Extract metadata (unpdf provides less detail than pdf-parse)
    const metadata = {
      wordCount: cleanText.split(/\s+/).length,
      charCount: cleanText.length,
      extractedWith: 'unpdf'
    }
    
    console.log(`✅ PDF extracted: ${metadata.wordCount} words, ${metadata.charCount} characters`)
    
    return {
      text: cleanText,
      metadata
    }
    
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error(`Failed to extract PDF: ${error.message}`)
  }
}

async function extractFromEPUB(filePath) {
  try {
    console.log(`📖 Extracting EPUB: ${path.basename(filePath)}`)
    
    const epub = new EPub(filePath)
    await epub.parse()
    
    let fullText = ''
    const chapters = []
    
    // Extract text from each chapter
    for (const chapter of epub.flow) {
      try {
        const chapterText = await epub.getChapterRaw(chapter.id)
        
        // Strip HTML tags and clean text
        const cleanChapterText = chapterText
          .replace(/<[^>]*>/g, ' ') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
          .trim()
        
        if (cleanChapterText.length > 100) {
          chapters.push({
            title: chapter.title || `Chapter ${chapters.length + 1}`,
            text: cleanChapterText
          })
          fullText += cleanChapterText + '\n\n'
        }
      } catch (chapterError) {
        console.warn(`Failed to extract chapter ${chapter.id}:`, chapterError.message)
      }
    }
    
    if (fullText.length < 100) {
      throw new Error('EPUB appears to be empty or unreadable')
    }
    
    const metadata = {
      title: epub.metadata.title,
      author: epub.metadata.creator,
      chapters: chapters.length,
      wordCount: fullText.split(/\s+/).length,
      charCount: fullText.length
    }
    
    console.log(`✅ EPUB extracted: ${chapters.length} chapters, ${metadata.wordCount} words`)
    
    return {
      text: fullText,
      chapters,
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