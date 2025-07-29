import express from 'express'
import multer from 'multer'
import { body } from 'express-validator'
import {
  uploadContent,
  getUploadStatus,
  getUserUploads,
  deleteUpload,
  processUpload
} from '../controllers/upload.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop())
  }
})

const fileFilter = (req, file, cb) => {
  // Accept PDFs, DOCs, and text files
  if (file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'text/plain') {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
})

// @desc    Upload content file
// @route   POST /api/upload
// @access  Private
router.post('/', protect, upload.single('file'), uploadContent)

// @desc    Upload content from URL
// @route   POST /api/upload/url
// @access  Private
router.post('/url', protect, [
  body('url').isURL().withMessage('Valid URL is required'),
  body('title').optional().notEmpty()
], uploadContent)

// @desc    Get upload status
// @route   GET /api/upload/:id/status
// @access  Private
router.get('/:id/status', protect, getUploadStatus)

// @desc    Get user uploads
// @route   GET /api/upload/my-uploads
// @access  Private
router.get('/my-uploads', protect, getUserUploads)

// @desc    Process uploaded content
// @route   POST /api/upload/:id/process
// @access  Private
router.post('/:id/process', protect, [
  body('generateQuiz').optional().isBoolean(),
  body('generateFlashcards').optional().isBoolean(),
  body('generateVisuals').optional().isBoolean(),
  body('difficulty').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  body('topics').optional().isArray()
], processUpload)

// @desc    Delete upload
// @route   DELETE /api/upload/:id
// @access  Private
router.delete('/:id', protect, deleteUpload)

export default router