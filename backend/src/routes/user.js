import express from 'express'
import { body } from 'express-validator'
import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  getUserProgress,
  updateUserXP,
  getLeaderboard
} from '../controllers/user.js'
import { protect, authorize } from '../middleware/auth.js'

const router = express.Router()

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
router.get('/', protect, authorize('ADMIN', 'SUPER_ADMIN'), getUsers)

// @desc    Get leaderboard
// @route   GET /api/users/leaderboard
// @access  Private
router.get('/leaderboard', protect, getLeaderboard)

// @desc    Get user stats
// @route   GET /api/users/stats
// @access  Private
router.get('/stats', protect, getUserStats)

// @desc    Get user progress
// @route   GET /api/users/progress
// @access  Private
router.get('/progress', protect, getUserProgress)

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
router.get('/:id', protect, getUserById)

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only or own profile)
router.put('/:id', protect, [
  body('name').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['USER', 'ADMIN', 'SUPER_ADMIN'])
], updateUser)

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Super Admin only)
router.delete('/:id', protect, authorize('SUPER_ADMIN'), deleteUser)

// @desc    Update user XP
// @route   POST /api/users/xp
// @access  Private
router.post('/xp', protect, [
  body('amount').isInt({ min: 1 }).withMessage('XP amount must be positive integer')
], updateUserXP)

export default router