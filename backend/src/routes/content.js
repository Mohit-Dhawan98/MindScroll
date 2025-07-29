import express from 'express'
import { body, query } from 'express-validator'
import {
  getContent,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
  getDailyFeed,
  getCardsByContent,
  updateProgress,
  searchContent
} from '../controllers/content.js'
import { protect, authorize } from '../middleware/auth.js'

const router = express.Router()

// @desc    Get all content with filtering and pagination
// @route   GET /api/content
// @access  Private
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['SUMMARY', 'ARTICLE', 'COURSE', 'UPLOADED']),
  query('difficulty').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  query('topics').optional().isArray()
], getContent)

// @desc    Search content
// @route   GET /api/content/search
// @access  Private
router.get('/search', protect, [
  query('q').notEmpty().withMessage('Search query is required')
], searchContent)

// @desc    Get daily feed for user
// @route   GET /api/content/feed
// @access  Private
router.get('/feed', protect, getDailyFeed)

// @desc    Get content by ID
// @route   GET /api/content/:id
// @access  Private
router.get('/:id', protect, getContentById)

// @desc    Get cards for specific content
// @route   GET /api/content/:id/cards
// @access  Private
router.get('/:id/cards', protect, getCardsByContent)

// @desc    Create new content
// @route   POST /api/content
// @access  Private (Admin only)
router.post('/', protect, authorize('ADMIN', 'SUPER_ADMIN'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('type').isIn(['SUMMARY', 'ARTICLE', 'COURSE', 'UPLOADED']),
  body('source').isIn(['CURATED', 'AI_GENERATED', 'USER_UPLOADED']),
  body('difficulty').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  body('topics').optional().isArray(),
  body('tags').optional().isArray(),
  body('estimatedTime').optional().isInt({ min: 1 })
], createContent)

// @desc    Update content
// @route   PUT /api/content/:id
// @access  Private (Admin only)
router.put('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), [
  body('title').optional().notEmpty(),
  body('description').optional(),
  body('difficulty').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  body('topics').optional().isArray(),
  body('tags').optional().isArray()
], updateContent)

// @desc    Delete content
// @route   DELETE /api/content/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), deleteContent)

// @desc    Update user progress on a card
// @route   POST /api/content/progress
// @access  Private
router.post('/progress', protect, [
  body('cardId').notEmpty().withMessage('Card ID is required'),
  body('status').isIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_REVIEW']),
  body('score').optional().isFloat({ min: 0, max: 1 })
], updateProgress)

export default router