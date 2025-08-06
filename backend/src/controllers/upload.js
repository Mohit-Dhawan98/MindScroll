import { validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { UploadStatus } from '../utils/constants.js'
import contentProcessor from '../services/contentProcessor.js'
import { extractTextFromPDF } from '../processors/textExtractor.js'
import { EnhancedCardGenerator } from '../processors/enhancedCardGenerator.js'
import { addJob, JOB_TYPES } from '../services/queueService.js'
import path from 'path'
import fs from 'fs/promises'

const prisma = new PrismaClient()

// @desc    Upload content file
// @route   POST /api/upload
// @access  Private
export const uploadContent = async (req, res, next) => {
  try {
    console.log('📤 Upload request received:')
    console.log('- Body:', req.body)
    console.log('- File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file')
    console.log('- User:', req.user ? `ID: ${req.user.id}` : 'No user')
    
    if (!req.user) {
      console.log('❌ No user found - authentication failed')
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
    }
    
    const userId = req.user.id
    const { 
      type, 
      title, 
      difficulty = 'medium', 
      category = 'general', 
      customInstructions,
      url 
    } = req.body

    // Handle file upload
    if (req.file) {
      const file = req.file
      
      // Validate file type matches selected type
      if (type === 'pdf' && file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          success: false,
          error: 'Please upload a PDF file'
        })
      }

      const upload = await prisma.contentUpload.create({
        data: {
          userId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: file.path,
          status: UploadStatus.PROCESSING,
          metadata: JSON.stringify({
            type,
            title: title || file.originalname.replace(/\.[^/.]+$/, ''),
            difficulty,
            category,
            customInstructions
          })
        }
      })

      // Check if there's already a job for this upload to prevent duplicates
      const existingJob = await prisma.processingJob.findFirst({
        where: { uploadId: upload.id }
      })

      if (existingJob) {
        console.log(`⚠️ Job already exists for upload ${upload.id}, skipping duplicate`)
        return res.status(200).json({
          success: true,
          data: { 
            id: upload.id,
            jobId: existingJob.queueJobId,
            title: title || file.originalname.replace(/\.[^/.]+$/, ''),
            status: upload.status
          },
          message: 'Upload already queued for processing.'
        })
      }

      // Queue file processing job instead of inline processing
      const jobType = file.mimetype === 'application/pdf' ? JOB_TYPES.PROCESS_PDF_UPLOAD : JOB_TYPES.PROCESS_TEXT_UPLOAD
      
      const job = await addJob(jobType, {
        uploadId: upload.id,
        userId,
        filePath: file.path,
        mimeType: file.mimetype,
        metadata: {
          title: title || file.originalname.replace(/\.[^/.]+$/, ''),
          difficulty,
          category,
          customInstructions
        }
      })

      console.log(`📋 Queued ${jobType} job ${job.id} for upload ${upload.id}`)
    console.log(`📋 Upload record created: ${upload.id} with status: ${upload.status}`)

      res.status(201).json({
        success: true,
        data: { 
          id: upload.id,
          jobId: job.id,
          title: title || file.originalname.replace(/\.[^/.]+$/, ''),
          status: upload.status
        },
        message: 'File uploaded successfully. Processing has been queued and will begin shortly.'
      })
    } 
    // Handle URL upload
    else if (url) {
      // Validate URL format
      try {
        new URL(url)
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid URL'
        })
      }

      const upload = await prisma.contentUpload.create({
        data: {
          userId,
          filename: 'url-content',
          originalName: title || url,
          mimeType: 'text/html',
          size: 0,
          url,
          status: UploadStatus.PROCESSING,
          metadata: JSON.stringify({
            type,
            title: title || extractTitleFromUrl(url),
            difficulty,
            category,
            customInstructions
          })
        }
      })

      // Check if there's already a job for this upload to prevent duplicates
      const existingJob = await prisma.processingJob.findFirst({
        where: { uploadId: upload.id }
      })

      if (existingJob) {
        console.log(`⚠️ Job already exists for upload ${upload.id}, skipping duplicate`)
        return res.status(200).json({
          success: true,
          data: { 
            id: upload.id,
            jobId: existingJob.queueJobId,
            title: title || extractTitleFromUrl(url),
            status: upload.status
          },
          message: 'Upload already queued for processing.'
        })
      }

      // Queue URL processing job instead of inline processing
      const job = await addJob(JOB_TYPES.PROCESS_URL_UPLOAD, {
        uploadId: upload.id,
        userId,
        url,
        metadata: {
          title: title || extractTitleFromUrl(url),
          difficulty,
          category,
          customInstructions
        }
      })

      console.log(`📋 Queued URL processing job ${job.id} for upload ${upload.id}`)

      res.status(201).json({
        success: true,
        data: { 
          id: upload.id,
          jobId: job.id,
          title: title || extractTitleFromUrl(url),
          status: upload.status
        },
        message: 'URL submitted successfully. Processing has been queued and will begin shortly.'
      })
    } 
    else {
      console.log('❌ No file or URL provided')
      return res.status(400).json({
        success: false,
        error: 'Please provide either a file or URL'
      })
    }
  } catch (error) {
    console.error('❌ Upload error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
}

// Helper function to extract title from URL
function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname + urlObj.pathname
  } catch {
    return url
  }
}

// @desc    Get upload status with job progress
// @route   GET /api/upload/:id/status
// @access  Private
export const getUploadStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    console.log(`🔍 Checking upload status for ID: ${id}, User: ${userId}`)

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
      console.log(`❌ Upload ${id} not found for user ${userId}`)
      return res.status(404).json({
        success: false,
        error: 'Upload not found'
      })
    }

    console.log(`✅ Found upload ${id} with status: ${upload.status}`)

    // Get job status from database
    const jobs = await prisma.processingJob.findMany({
      where: { uploadId: id },
      orderBy: { createdAt: 'desc' }
    })
    
    const activeJob = jobs.find(job => job.status === 'active' || job.status === 'waiting')
    const completedJobs = jobs.filter(job => job.status === 'completed')
    const failedJobs = jobs.filter(job => job.status === 'failed')

    const response = {
      success: true,
      data: {
        ...upload,
        processing: {
          jobs: jobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length,
          currentJob: activeJob ? {
            id: activeJob.id,
            status: activeJob.status,
            progress: activeJob.progress,
            jobType: activeJob.jobType,
            createdAt: activeJob.createdAt,
            startedAt: activeJob.startedAt,
            error: activeJob.error
          } : null,
          lastJob: jobs.length > 0 ? {
            id: jobs[0].id,
            status: jobs[0].status,
            progress: jobs[0].progress,
            jobType: jobs[0].jobType,
            createdAt: jobs[0].createdAt,
            startedAt: jobs[0].startedAt,
            completedAt: jobs[0].completedAt,
            error: jobs[0].error
          } : null
        }
      }
    }

    res.json(response)
  } catch (error) {
    console.error('Error getting upload status:', error)
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
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get the most recent job for each upload
        }
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    })

    const total = await prisma.contentUpload.count({
      where: { userId }
    })

    // Format uploads with job information
    const formattedUploads = uploads.map(upload => ({
      ...upload,
      processing: {
        hasJobs: upload.jobs.length > 0,
        latestJob: upload.jobs.length > 0 ? {
          id: upload.jobs[0].id,
          status: upload.jobs[0].status,
          progress: upload.jobs[0].progress,
          jobType: upload.jobs[0].jobType,
          createdAt: upload.jobs[0].createdAt,
          startedAt: upload.jobs[0].startedAt,
          completedAt: upload.jobs[0].completedAt,
          error: upload.jobs[0].error
        } : null
      },
      jobs: undefined // Remove jobs array from response to avoid duplication
    }))

    res.json({
      success: true,
      data: formattedUploads,
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

// Note: Background processing functions moved to worker.js for queue-based processing