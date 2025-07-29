import { validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { UploadStatus } from '../utils/constants.js'
import contentProcessor from '../services/contentProcessor.js'
import path from 'path'
import fs from 'fs/promises'

const prisma = new PrismaClient()

// @desc    Upload content file
// @route   POST /api/upload
// @access  Private
export const uploadContent = async (req, res, next) => {
  try {
    // Handle both file upload and URL upload
    if (req.file) {
      // File upload
      const { file } = req
      const userId = req.user.id

      const upload = await prisma.contentUpload.create({
        data: {
          userId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: file.path,
          status: UploadStatus.PROCESSING
        }
      })

      // Process file in background
      processFileUpload(upload.id, file.path, file.mimetype)

      res.status(201).json({
        success: true,
        data: upload,
        message: 'File uploaded successfully. Processing will begin shortly.'
      })
    } else {
      // URL upload
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        })
      }

      const { url, title } = req.body
      const userId = req.user.id

      const upload = await prisma.contentUpload.create({
        data: {
          userId,
          filename: 'url-content',
          originalName: title || url,
          mimeType: 'text/html',
          size: 0,
          url,
          status: UploadStatus.PROCESSING
        }
      })

      // Process URL in background
      processUrlUpload(upload.id, url)

      res.status(201).json({
        success: true,
        data: upload,
        message: 'URL submitted successfully. Processing will begin shortly.'
      })
    }
  } catch (error) {
    next(error)
  }
}

// @desc    Get upload status
// @route   GET /api/upload/:id/status
// @access  Private
export const getUploadStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const upload = await prisma.contentUpload.findFirst({
      where: {
        id,
        userId
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            type: true
          }
        }
      }
    })

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: 'Upload not found'
      })
    }

    res.json({
      success: true,
      data: upload
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get user uploads
// @route   GET /api/upload/my-uploads
// @access  Private
export const getUserUploads = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page = 1, limit = 10 } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const uploads = await prisma.contentUpload.findMany({
      where: { userId },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            type: true
          }
        }
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    })

    const total = await prisma.contentUpload.count({
      where: { userId }
    })

    res.json({
      success: true,
      data: uploads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Process uploaded content
// @route   POST /api/upload/:id/process
// @access  Private
export const processUpload = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { id } = req.params
    const {
      generateQuiz = true,
      generateFlashcards = true,
      generateVisuals = false,
      difficulty = 'INTERMEDIATE',
      topics = []
    } = req.body

    const userId = req.user.id

    const upload = await prisma.contentUpload.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: 'Upload not found'
      })
    }

    if (upload.status !== UploadStatus.COMPLETED) {
      return res.status(400).json({
        success: false,
        error: 'Upload processing not completed yet'
      })
    }

    // Reprocess with new options
    processFileUpload(id, upload.url, upload.mimeType, {
      generateQuiz,
      generateFlashcards,
      generateVisuals,
      difficulty,
      topics
    })

    res.json({
      success: true,
      message: 'Content reprocessing started with new options'
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Delete upload
// @route   DELETE /api/upload/:id
// @access  Private
export const deleteUpload = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const upload = await prisma.contentUpload.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: 'Upload not found'
      })
    }

    // Delete file if it exists
    if (upload.url && !upload.url.startsWith('http')) {
      try {
        await fs.unlink(upload.url)
      } catch (error) {
        console.error('Error deleting file:', error)
      }
    }

    // Delete from database
    await prisma.contentUpload.delete({
      where: { id }
    })

    res.json({
      success: true,
      message: 'Upload deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

// Background processing functions
async function processFileUpload(uploadId, filePath, mimeType, options = {}) {
  try {
    console.log(`Processing file upload ${uploadId}...`)

    let contentData
    if (mimeType === 'application/pdf') {
      contentData = await contentProcessor.processPDF(filePath)
    } else {
      // For other file types, read as text
      const text = await fs.readFile(filePath, 'utf-8')
      contentData = { text, title: path.basename(filePath) }
    }

    // Generate metadata
    const metadata = contentProcessor.generateMetadata(contentData)

    // Create content record
    const content = await prisma.content.create({
      data: {
        title: contentData.title || 'Uploaded Content',
        description: `Uploaded file: ${path.basename(filePath)}`,
        type: 'UPLOADED',
        source: 'USER_UPLOADED',
        difficulty: options.difficulty || metadata.difficulty,
        topics: JSON.stringify(options.topics || metadata.topics),
        tags: JSON.stringify([]),
        estimatedTime: metadata.readingTime,
        isAiGenerated: true,
        sourceType: mimeType
      }
    })

    // Generate cards
    const cards = await contentProcessor.generateCards(contentData.text, {
      difficulty: options.difficulty || metadata.difficulty,
      generateQuiz: options.generateQuiz !== false,
      generateFlashcards: options.generateFlashcards !== false,
      generateSummary: true
    })

    // Save cards to database
    for (const cardData of cards) {
      await prisma.card.create({
        data: {
          contentId: content.id,
          type: cardData.type,
          title: cardData.title,
          text: cardData.text || null,
          front: cardData.front || null,
          back: cardData.back || null,
          quiz: cardData.quiz ? JSON.stringify(cardData.quiz) : null,
          order: cardData.order
        }
      })
    }

    // Update upload status
    await prisma.contentUpload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.COMPLETED,
        contentId: content.id
      }
    })

    console.log(`File upload ${uploadId} processed successfully`)
  } catch (error) {
    console.error(`Error processing file upload ${uploadId}:`, error)

    await prisma.contentUpload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.FAILED,
        error: error.message
      }
    })
  }
}

async function processUrlUpload(uploadId, url) {
  try {
    console.log(`Processing URL upload ${uploadId}: ${url}`)

    const contentData = await contentProcessor.processURL(url)
    const metadata = contentProcessor.generateMetadata(contentData)

    // Create content record
    const content = await prisma.content.create({
      data: {
        title: contentData.title,
        description: contentData.description,
        type: 'UPLOADED',
        source: 'USER_UPLOADED',
        sourceUrl: url,
        difficulty: metadata.difficulty,
        topics: JSON.stringify(metadata.topics),
        tags: JSON.stringify([]),
        estimatedTime: metadata.readingTime,
        isAiGenerated: true,
        sourceType: 'webpage'
      }
    })

    // Generate cards
    const cards = await contentProcessor.generateCards(contentData.text, {
      difficulty: metadata.difficulty,
      generateQuiz: true,
      generateFlashcards: true,
      generateSummary: true
    })

    // Save cards to database
    for (const cardData of cards) {
      await prisma.card.create({
        data: {
          contentId: content.id,
          type: cardData.type,
          title: cardData.title,
          text: cardData.text || null,
          front: cardData.front || null,
          back: cardData.back || null,
          quiz: cardData.quiz ? JSON.stringify(cardData.quiz) : null,
          order: cardData.order
        }
      })
    }

    // Update upload status
    await prisma.contentUpload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.COMPLETED,
        contentId: content.id
      }
    })

    console.log(`URL upload ${uploadId} processed successfully`)
  } catch (error) {
    console.error(`Error processing URL upload ${uploadId}:`, error)

    await prisma.contentUpload.update({
      where: { id: uploadId },
      data: {
        status: UploadStatus.FAILED,
        error: error.message
      }
    })
  }
}