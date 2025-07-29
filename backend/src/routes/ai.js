import express from 'express'
import { body } from 'express-validator'
import {
  chatWithTutor,
  generateContent,
  generateQuiz,
  generateSummary,
  generateVisual,
  textToSpeech,
  getChatHistory,
  startNewConversation
} from '../controllers/ai.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// @desc    Chat with AI tutor
// @route   POST /api/ai/chat
// @access  Private
router.post('/chat', protect, [
  body('message').notEmpty().withMessage('Message is required'),
  body('conversationId').optional().isUUID()
], chatWithTutor)

// @desc    Start new conversation
// @route   POST /api/ai/conversation
// @access  Private
router.post('/conversation', protect, [
  body('title').optional().notEmpty()
], startNewConversation)

// @desc    Get chat history
// @route   GET /api/ai/conversations
// @access  Private
router.get('/conversations', protect, getChatHistory)

// @desc    Generate content from text
// @route   POST /api/ai/generate-content
// @access  Private
router.post('/generate-content', protect, [
  body('text').notEmpty().withMessage('Text content is required'),
  body('type').isIn(['summary', 'flashcards', 'quiz', 'visual']),
  body('difficulty').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  body('topics').optional().isArray()
], generateContent)

// @desc    Generate quiz from content
// @route   POST /api/ai/generate-quiz
// @access  Private
router.post('/generate-quiz', protect, [
  body('contentId').isUUID().withMessage('Valid content ID is required'),
  body('numQuestions').optional().isInt({ min: 1, max: 20 }),
  body('difficulty').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
], generateQuiz)

// @desc    Generate summary from URL or text
// @route   POST /api/ai/generate-summary
// @access  Private
router.post('/generate-summary', protect, [
  body('source').notEmpty().withMessage('Source URL or text is required'),
  body('type').isIn(['url', 'text']),
  body('length').optional().isIn(['short', 'medium', 'long']),
  body('style').optional().isIn(['academic', 'casual', 'detailed'])
], generateSummary)

// @desc    Generate visual content
// @route   POST /api/ai/generate-visual
// @access  Private
router.post('/generate-visual', protect, [
  body('prompt').notEmpty().withMessage('Visual prompt is required'),
  body('style').optional().isIn(['diagram', 'infographic', 'illustration', 'chart']),
  body('cardId').optional().isUUID()
], generateVisual)

// @desc    Convert text to speech
// @route   POST /api/ai/text-to-speech
// @access  Private
router.post('/text-to-speech', protect, [
  body('text').notEmpty().withMessage('Text is required'),
  body('voice').optional().isIn(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']),
  body('speed').optional().isFloat({ min: 0.25, max: 4.0 })
], textToSpeech)

export default router