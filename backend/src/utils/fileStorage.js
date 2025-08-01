import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Storage directories
const STORAGE_ROOT = path.join(__dirname, '../../storage')
const TEXT_STORAGE = path.join(STORAGE_ROOT, 'extracted-text')
const CHUNKS_STORAGE = path.join(STORAGE_ROOT, 'chunks')
const CACHE_STORAGE = path.join(STORAGE_ROOT, 'cache')

class FileStorage {
  constructor() {
    this.ensureDirectories()
  }

  ensureDirectories() {
    const dirs = [STORAGE_ROOT, TEXT_STORAGE, CHUNKS_STORAGE, CACHE_STORAGE]
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  /**
   * Generate a unique ID for content based on title, author, and file hash
   */
  generateContentId(title, author, filePath = '') {
    const content = `${title}-${author}-${filePath}`
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * Store extracted text to file system instead of database
   */
  async storeExtractedText(contentId, textData) {
    try {
      const filePath = path.join(TEXT_STORAGE, `${contentId}.json`)
      
      const storageData = {
        contentId,
        extractedAt: new Date().toISOString(),
        text: textData.text || textData,
        metadata: textData.metadata || {},
        chapters: textData.chapters || []
      }
      
      await fs.promises.writeFile(filePath, JSON.stringify(storageData, null, 2))
      
      console.log(`💾 Stored extracted text: ${filePath}`)
      return filePath
      
    } catch (error) {
      console.error('Error storing extracted text:', error)
      throw error
    }
  }

  /**
   * Retrieve stored text
   */
  async getExtractedText(contentId) {
    try {
      const filePath = path.join(TEXT_STORAGE, `${contentId}.json`)
      
      if (!fs.existsSync(filePath)) {
        return null
      }
      
      const data = await fs.promises.readFile(filePath, 'utf-8')
      return JSON.parse(data)
      
    } catch (error) {
      console.error('Error retrieving extracted text:', error)
      return null
    }
  }

  /**
   * Store processed chunks
   */
  async storeChunks(contentId, chunks) {
    try {
      const chunkDir = path.join(CHUNKS_STORAGE, contentId)
      
      if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true })
      }
      
      // Store metadata
      const metadata = {
        contentId,
        totalChunks: chunks.length,
        createdAt: new Date().toISOString(),
        chunkSizes: chunks.map(chunk => chunk.length)
      }
      
      await fs.promises.writeFile(
        path.join(chunkDir, 'metadata.json'), 
        JSON.stringify(metadata, null, 2)
      )
      
      // Store individual chunks
      const chunkFiles = []
      for (let i = 0; i < chunks.length; i++) {
        const chunkFile = path.join(chunkDir, `chunk-${String(i + 1).padStart(3, '0')}.txt`)
        await fs.promises.writeFile(chunkFile, chunks[i])
        chunkFiles.push(chunkFile)
      }
      
      console.log(`💾 Stored ${chunks.length} chunks for content ${contentId}`)
      return chunkFiles
      
    } catch (error) {
      console.error('Error storing chunks:', error)
      throw error
    }
  }

  /**
   * Get stored chunks
   */
  async getChunks(contentId) {
    try {
      const chunkDir = path.join(CHUNKS_STORAGE, contentId)
      
      if (!fs.existsSync(chunkDir)) {
        return null
      }
      
      const metadataPath = path.join(chunkDir, 'metadata.json')
      if (!fs.existsSync(metadataPath)) {
        return null
      }
      
      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'))
      
      const chunks = []
      for (let i = 1; i <= metadata.totalChunks; i++) {
        const chunkFile = path.join(chunkDir, `chunk-${String(i).padStart(3, '0')}.txt`)
        if (fs.existsSync(chunkFile)) {
          const chunkText = await fs.promises.readFile(chunkFile, 'utf-8')
          chunks.push(chunkText)
        }
      }
      
      return {
        metadata,
        chunks
      }
      
    } catch (error) {
      console.error('Error retrieving chunks:', error)
      return null
    }
  }

  /**
   * Cache processed cards to avoid re-processing
   */
  async cacheProcessedCards(contentId, cards) {
    try {
      const cacheFile = path.join(CACHE_STORAGE, `${contentId}-cards.json`)
      
      const cacheData = {
        contentId,
        cards,
        cachedAt: new Date().toISOString(),
        totalCards: cards.length
      }
      
      await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData, null, 2))
      
      console.log(`💾 Cached ${cards.length} processed cards for ${contentId}`)
      return cacheFile
      
    } catch (error) {
      console.error('Error caching processed cards:', error)
      throw error
    }
  }

  /**
   * Get cached cards
   */
  async getCachedCards(contentId) {
    try {
      const cacheFile = path.join(CACHE_STORAGE, `${contentId}-cards.json`)
      
      if (!fs.existsSync(cacheFile)) {
        return null
      }
      
      const data = await fs.promises.readFile(cacheFile, 'utf-8')
      const cacheData = JSON.parse(data)
      
      // Check if cache is recent (within 7 days)
      const cacheAge = Date.now() - new Date(cacheData.cachedAt).getTime()
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
      
      if (cacheAge > maxAge) {
        console.log(`⚠️  Cache expired for ${contentId}, will regenerate`)
        return null
      }
      
      console.log(`📦 Using cached cards for ${contentId}`)
      return cacheData.cards
      
    } catch (error) {
      console.error('Error retrieving cached cards:', error)
      return null
    }
  }

  /**
   * Clear cache for specific content ID (used with override)
   */
  /**
   * Cache chapter structure for consistent processing
   */
  async cacheChapterStructure(contentId, chapterStructure) {
    try {
      const cacheFile = path.join(CACHE_STORAGE, `${contentId}-chapters.json`)
      
      const cacheData = {
        contentId,
        chapterStructure,
        cachedAt: new Date().toISOString(),
        totalChapters: chapterStructure.chapters ? chapterStructure.chapters.length : 0
      }
      
      await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData, null, 2))
      console.log(`💾 Cached chapter structure: ${cacheData.totalChapters} chapters`)
      
    } catch (error) {
      console.error('Error caching chapter structure:', error)
      throw error
    }
  }

  /**
   * Get cached chapter structure
   */
  async getCachedChapterStructure(contentId) {
    try {
      const cacheFile = path.join(CACHE_STORAGE, `${contentId}-chapters.json`)
      
      if (!fs.existsSync(cacheFile)) {
        return null
      }
      
      const data = await fs.promises.readFile(cacheFile, 'utf-8')
      const cacheData = JSON.parse(data)
      
      // Check if cache is recent (within 30 days for chapter structure)
      const cacheAge = Date.now() - new Date(cacheData.cachedAt).getTime()
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days (longer than cards)
      
      if (cacheAge > maxAge) {
        console.log(`⚠️  Chapter structure cache expired for ${contentId}, will regenerate`)
        return null
      }
      
      console.log(`📚 Using cached chapter structure for ${contentId} (${cacheData.totalChapters} chapters)`)
      return cacheData.chapterStructure
      
    } catch (error) {
      console.error('Error retrieving cached chapter structure:', error)
      return null
    }
  }

  async clearCache(contentId) {
    try {
      const files = [
        path.join(CACHE_STORAGE, `${contentId}-cards.json`),
        path.join(CACHE_STORAGE, `${contentId}-chapters.json`),
        path.join(TEXT_STORAGE, `${contentId}.json`)
      ]
      
      const chunkDir = path.join(CHUNKS_STORAGE, contentId)
      
      let cleared = 0
      
      // Remove cache files
      for (const file of files) {
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file)
          cleared++
        }
      }
      
      // Remove chunks directory
      if (fs.existsSync(chunkDir)) {
        await fs.promises.rm(chunkDir, { recursive: true, force: true })
        cleared++
      }
      
      console.log(`🗑️ Cleared ${cleared} cached files for content ${contentId}`)
      return cleared
      
    } catch (error) {
      console.error('Error clearing cache:', error)
      throw error
    }
  }

  /**
   * Clean up old files
   */
  async cleanup(olderThanDays = 30) {
    try {
      const maxAge = olderThanDays * 24 * 60 * 60 * 1000
      const now = Date.now()
      
      let cleaned = 0
      
      // Clean old cache files
      const cacheFiles = await fs.promises.readdir(CACHE_STORAGE)
      for (const file of cacheFiles) {
        const filePath = path.join(CACHE_STORAGE, file)
        const stats = await fs.promises.stat(filePath)
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.promises.unlink(filePath)
          cleaned++
        }
      }
      
      console.log(`🧹 Cleaned up ${cleaned} old cache files`)
      return cleaned
      
    } catch (error) {
      console.error('Error during cleanup:', error)
      throw error
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    try {
      const stats = {
        extractedTexts: 0,
        chunks: 0,
        cachedCards: 0,
        totalSizeMB: 0
      }
      
      // Count extracted texts
      if (fs.existsSync(TEXT_STORAGE)) {
        stats.extractedTexts = (await fs.promises.readdir(TEXT_STORAGE)).length
      }
      
      // Count chunk directories
      if (fs.existsSync(CHUNKS_STORAGE)) {
        stats.chunks = (await fs.promises.readdir(CHUNKS_STORAGE)).length
      }
      
      // Count cached cards
      if (fs.existsSync(CACHE_STORAGE)) {
        stats.cachedCards = (await fs.promises.readdir(CACHE_STORAGE)).length
      }
      
      // Calculate total size (rough estimate)
      const getDirSize = async (dir) => {
        if (!fs.existsSync(dir)) return 0
        
        let size = 0
        const files = await fs.promises.readdir(dir, { withFileTypes: true })
        
        for (const file of files) {
          const filePath = path.join(dir, file.name)
          if (file.isDirectory()) {
            size += await getDirSize(filePath)
          } else {
            const stat = await fs.promises.stat(filePath)
            size += stat.size
          }
        }
        
        return size
      }
      
      const totalSize = await getDirSize(STORAGE_ROOT)
      stats.totalSizeMB = Math.round(totalSize / (1024 * 1024) * 100) / 100
      
      return stats
      
    } catch (error) {
      console.error('Error getting storage stats:', error)
      return null
    }
  }

  /**
   * Cache debug data for analyzing card generation issues
   */
  async cacheDebugData(type, identifier, data) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const debugFile = path.join(CACHE_STORAGE, `debug-${type}-${identifier.replace(/[^a-z0-9]/gi, '_')}-${timestamp}.json`)
      
      await fs.promises.writeFile(debugFile, JSON.stringify(data, null, 2))
      console.log(`🐛 Cached debug data: ${path.basename(debugFile)}`)
      
      return debugFile
    } catch (error) {
      console.error('Error caching debug data:', error)
      return null
    }
  }
}

export default new FileStorage()