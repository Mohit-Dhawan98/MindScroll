import express from 'express'
import { body } from 'express-validator'
import { 
  register, 
  login, 
  getMe, 
  updateProfile,
  forgotPassword,
  resetPassword
} from '../controllers/auth.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required')
], register)

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], login)

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, getMe)

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('name').optional().notEmpty(),
  body('interests').optional().isArray(),
  body('dailyGoal').optional().isInt({ min: 1, max: 20 }),
  body('timezone').optional().notEmpty()
], updateProfile)

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], forgotPassword)

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
], resetPassword)

export default router