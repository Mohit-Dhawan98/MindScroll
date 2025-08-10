import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import path from 'path'
import { Readable } from 'stream'

/**
 * Simple R2 Streaming Storage
 * Upload → Stream when needed → Clean up
 */
class R2StreamingStorage {
  constructor() {
    this.s3 = new S3Client({
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
      },
      region: 'auto'
    })
    
    this.bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME
    
    if (!this.bucket || !process.env.CLOUDFLARE_R2_ENDPOINT) {
      console.warn('⚠️ R2 storage not configured')
      this.enabled = false
    } else {
      this.enabled = true
      console.log(`☁️ R2 Storage initialized: ${this.bucket}`)
    }
  }

  /**
   * Get content type for file
   */
  getContentType(filename) {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain'
    }
    const ext = path.extname(filename).toLowerCase()
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * Generate unique key for temp storage
   */
  generateTempKey(originalName, uploadId) {
    const timestamp = Date.now()
    const random = crypto.randomBytes(4).toString('hex')
    const extension = path.extname(originalName).toLowerCase()
    return `temp/uploads/${uploadId}_${timestamp}_${random}${extension}`
  }

  /**
   * Simple upload to R2
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename  
   * @param {string} uploadId - Upload ID
   * @returns {Promise<{key: string}>}
   */
  async upload(buffer, originalName, uploadId) {
    if (!this.enabled) {
      throw new Error('R2 storage not configured')
    }

    try {
      const key = this.generateTempKey(originalName, uploadId)
      const contentType = this.getContentType(originalName)
      
      console.log(`☁️ Uploading to R2: ${key} (${Math.round(buffer.length / 1024)}KB)`)
      
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          'upload-id': uploadId,
          'original-name': originalName,
          'uploaded-at': new Date().toISOString()
        }
      }))
      
      console.log(`✅ R2 upload successful: ${key}`)
      return { key }
      
    } catch (error) {
      console.error('❌ R2 upload failed:', error.message)
      throw new Error(`R2 upload failed: ${error.message}`)
    }
  }

  /**
   * Stream download from R2
   * @param {string} key - R2 object key
   * @returns {Promise<Readable>} - Node.js readable stream
   */
  async streamDownload(key) {
    if (!this.enabled) {
      throw new Error('R2 storage not configured')
    }

    try {
      console.log(`⬇️ Streaming from R2: ${key}`)
      
      const response = await this.s3.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      }))
      
      // Convert AWS SDK v3 stream to Node.js readable stream
      const webStream = response.Body.transformToWebStream()
      const nodeStream = Readable.fromWeb(webStream)
      
      console.log(`✅ R2 stream ready: ${Math.round(response.ContentLength / 1024)}KB`)
      return nodeStream
      
    } catch (error) {
      console.error('❌ R2 stream failed:', error.message)
      throw new Error(`R2 stream failed: ${error.message}`)
    }
  }

  /**
   * Delete file from R2
   * @param {string} key - R2 object key
   */
  async delete(key) {
    if (!this.enabled) {
      return false
    }

    try {
      console.log(`🗑️ Deleting from R2: ${key}`)
      
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      }))
      
      console.log(`✅ R2 delete successful: ${key}`)
      return true
      
    } catch (error) {
      console.error('❌ R2 delete failed:', error.message)
      return false
    }
  }

  /**
   * Check if file exists
   * @param {string} key - R2 object key
   */
  async exists(key) {
    if (!this.enabled) {
      return false
    }

    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      }))
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'R2 storage not configured' }
    }

    try {
      // Try a simple operation
      const testKey = 'test-connection'
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: testKey,
        Body: Buffer.from('test')
      }))
      
      await this.delete(testKey)
      
      return { 
        success: true, 
        bucket: this.bucket,
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT
      }
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      }
    }
  }
}

export default new R2StreamingStorage()