# Content Processing Architecture

## 🏗️ **Storage Strategy**

### **Current Problem:**
- Storing full book text in database (inefficient)
- No chunking strategy
- No file-based storage for large content

### **Recommended Architecture:**

```
📁 content-storage/
├── 📁 library/
│   ├── 📁 raw-text/                 # Extracted text files
│   │   ├── content-id-123.txt       # Full book text
│   │   └── content-id-124.txt
│   ├── 📁 chunks/                   # Chunked content for AI processing
│   │   ├── content-id-123/
│   │   │   ├── chunk-001.txt
│   │   │   ├── chunk-002.txt
│   │   │   └── metadata.json
│   │   └── content-id-124/
│   └── 📁 processed/                # AI-generated cards cache
│       ├── content-id-123-cards.json
│       └── content-id-124-cards.json
└── 📁 user-uploads/
    ├── 📁 user-456/
    │   ├── upload-789.txt
    │   └── upload-790.txt
    └── 📁 user-457/
```

### **Database Storage:**
```sql
-- Only metadata and cards in DB, not full text
content (
  id, title, author, category,
  text_file_path,      -- Path to full text file
  chunks_directory,    -- Path to chunks folder  
  total_chunks,        -- Number of chunks
  processing_status,   -- PENDING/PROCESSING/COMPLETED
  ...
)

cards (
  id, content_id, title, content,  -- Only card content in DB
  chunk_source,                    -- Which chunk this came from
  ...
)
```

## 🤖 **AI Processing Pipeline**

### **Current Prompts (from aiCardGenerator.js):**
```javascript
const prompt = `You are an expert educator creating microlearning cards from the book "${bookTitle}" by ${author} in the ${category} category.

Extract the most important concepts, ideas, and insights from this text chunk and create learning cards.

Text chunk:
${textChunk}

Create 3-5 learning cards in this exact JSON format:
[
  {
    "title": "Clear, concise question or concept title (max 80 chars)",
    "content": "Detailed explanation, key insights, or answer (200-400 words). Use bullet points and examples where helpful.",
    "difficulty": "EASY|MEDIUM|HARD",
    "tags": ["concept1", "concept2", "concept3"]
  }
]

Guidelines:
- Focus on actionable insights and key concepts
- Make cards standalone (don't reference "the text" or "this chapter")  
- Use clear, educational language
- Include examples or applications when relevant
- Vary difficulty based on concept complexity
- Each card should teach something valuable

Return only the JSON array, no other text.`
```

### **Chunking Strategy:**
```javascript
function cleanAndChunkText(text, chunkSize = 2000) {
  // Current: Simple sentence-based chunking
  // Problem: May break mid-concept
  
  // Recommended: Semantic chunking
  // - Chapter boundaries
  // - Section headings  
  // - Paragraph breaks
  // - Concept completeness
}
```

## 📚 **PDF/EPUB Processing Libraries**

### **Currently Missing - Need to Install:**

```bash
# PDF Processing
npm install pdf-parse pdf2pic pdfjs-dist

# EPUB Processing  
npm install epub2 node-html-parser

# Text Processing
npm install natural compromise

# Web Scraping
npm install puppeteer playwright cheerio

# File Storage
npm install multer sharp
```

### **Recommended Implementation:**
```javascript
// Enhanced PDF extraction
import pdfParse from 'pdf-parse'
import fs from 'fs'

async function extractFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath)
  const data = await pdfParse(dataBuffer)
  
  return {
    text: data.text,
    pages: data.numpages,
    info: data.info,
    metadata: data.metadata
  }
}

// Enhanced EPUB extraction
import { EPub } from 'epub2'

async function extractFromEPUB(filePath) {
  const epub = await EPub.createAsync(filePath)
  
  let fullText = ''
  const chapters = []
  
  for (const chapter of epub.flow) {
    const chapterText = await epub.getChapterAsync(chapter.id)
    chapters.push({
      title: chapter.title,
      text: chapterText
    })
    fullText += chapterText + '\n\n'
  }
  
  return {
    text: fullText,
    chapters,
    metadata: epub.metadata
  }
}
```

## ⚡ **Efficiency Improvements**

### **1. Smart Chunking:**
```javascript
class SmartChunker {
  chunkBySemantics(text, maxChunkSize = 3000) {
    const chunks = []
    const paragraphs = text.split('\n\n')
    
    let currentChunk = ''
    let currentConcepts = []
    
    for (const paragraph of paragraphs) {
      // Detect concept boundaries
      if (this.isNewConcept(paragraph)) {
        if (currentChunk) {
          chunks.push({
            text: currentChunk,
            concepts: currentConcepts,
            wordCount: currentChunk.split(' ').length
          })
        }
        currentChunk = paragraph
        currentConcepts = this.extractConcepts(paragraph)
      } else {
        currentChunk += '\n\n' + paragraph
      }
      
      // Split if too large
      if (currentChunk.length > maxChunkSize) {
        chunks.push({
          text: currentChunk,
          concepts: currentConcepts,
          wordCount: currentChunk.split(' ').length
        })
        currentChunk = ''
        currentConcepts = []
      }
    }
    
    return chunks
  }
}
```

### **2. Caching Strategy:**
```javascript
class ProcessingCache {
  async getCachedCards(contentId, chunkHash) {
    const cacheFile = `content-storage/processed/${contentId}-${chunkHash}.json`
    if (fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile))
    }
    return null
  }
  
  async cacheCards(contentId, chunkHash, cards) {
    const cacheFile = `content-storage/processed/${contentId}-${chunkHash}.json`
    fs.writeFileSync(cacheFile, JSON.stringify(cards, null, 2))
  }
}
```

### **3. Batch Processing:**
```javascript
class BatchProcessor {
  async processInBatches(chunks, batchSize = 5) {
    const batches = []
    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize))
    }
    
    const results = []
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(chunk => this.processChunk(chunk))
      )
      results.push(...batchResults)
      
      // Rate limiting
      await this.delay(1000)
    }
    
    return results
  }
}
```

## 🌐 **Web Content Processing**

### **Current Issues:**
- Basic cheerio scraping
- No JavaScript rendering
- Limited content extraction

### **Enhanced Web Processing:**
```javascript
import puppeteer from 'puppeteer'

class WebContentExtractor {
  async extractWithPuppeteer(url) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    
    await page.goto(url, { waitUntil: 'networkidle0' })
    
    // Extract main content using readability algorithm
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll(
        'nav, header, footer, aside, .ads, .comments, script, style'
      )
      unwanted.forEach(el => el.remove())
      
      // Find main content area
      const candidates = [
        document.querySelector('article'),
        document.querySelector('[role="main"]'),
        document.querySelector('.post-content'),
        document.querySelector('.entry-content'),
        document.querySelector('#content')
      ].filter(Boolean)
      
      const mainContent = candidates[0] || document.body
      
      return {
        title: document.title,
        text: mainContent.innerText,
        html: mainContent.innerHTML,
        wordCount: mainContent.innerText.split(' ').length
      }
    })
    
    await browser.close()
    return content
  }
}
```

## 💾 **Recommended Storage Architecture**

### **File System:**
```
📁 content-storage/
├── 📁 library/              # Static library content
│   ├── 📁 books/            # Original files (backup)
│   ├── 📁 extracted/        # Raw extracted text
│   ├── 📁 chunks/           # Processed chunks
│   └── 📁 cards/            # Generated cards cache
├── 📁 uploads/              # User uploads
│   └── 📁 {userId}/         # Per-user folders
└── 📁 temp/                 # Temporary processing
```

### **Database:**
```sql
-- Minimal metadata only
content (
  id, title, author, category,
  file_path, text_file_path, 
  total_chunks, total_cards,
  status, created_at
)

-- Only card content in DB
cards (
  id, content_id, title, content,
  difficulty, chunk_id, order
)

-- Processing logs
processing_logs (
  id, content_id, status, 
  chunks_processed, error_message,
  started_at, completed_at
)
```

## 🎯 **Recommended Next Steps**

1. **Install proper libraries** for PDF/EPUB processing
2. **Implement file-based storage** for large content
3. **Add semantic chunking** for better concept extraction
4. **Create caching layer** for processed content
5. **Add batch processing** for efficiency
6. **Implement web content extraction** with Puppeteer

Would you like me to implement any of these improvements?