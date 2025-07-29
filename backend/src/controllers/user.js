import { validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { UserRole, parseJsonField } from '../utils/constants.js'

const prisma = new PrismaClient()

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        xp: true,
        level: true,
        streak: true,
        lastActive: true,
        createdAt: true
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    })

    const total = await prisma.user.count()

    res.json({
      success: true,
      data: users,
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

// @desc    Get leaderboard
// @route   GET /api/users/leaderboard
// @access  Private
export const getLeaderboard = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        avatar: true,
        xp: true,
        level: true,
        streak: true
      },
      orderBy: [
        { xp: 'desc' },
        { level: 'desc' },
        { streak: 'desc' }
      ],
      take: parseInt(limit)
    })

    res.json({
      success: true,
      data: users
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get user stats
// @route   GET /api/users/stats
// @access  Private
export const getUserStats = async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get user's progress stats
    const progressStats = await prisma.userProgress.groupBy({
      by: ['status'],
      where: { userId },
      _count: true
    })

    // Get learning sessions stats
    const sessionsCount = await prisma.learningSession.count({
      where: { userId }
    })

    const totalCardsCompleted = await prisma.learningSession.aggregate({
      where: { userId },
      _sum: { cardsCompleted: true }
    })

    const totalTimeSpent = await prisma.learningSession.aggregate({
      where: { userId },
      _sum: { duration: true }
    })

    // Format progress stats
    const formattedStats = {
      notStarted: 0,
      inProgress: 0,
      completed: 0,
      needsReview: 0
    }

    progressStats.forEach(stat => {
      switch (stat.status) {
        case 'NOT_STARTED':
          formattedStats.notStarted = stat._count
          break
        case 'IN_PROGRESS':
          formattedStats.inProgress = stat._count
          break
        case 'COMPLETED':
          formattedStats.completed = stat._count
          break
        case 'NEEDS_REVIEW':
          formattedStats.needsReview = stat._count
          break
      }
    })

    res.json({
      success: true,
      data: {
        user: {
          xp: req.user.xp,
          level: req.user.level,
          streak: req.user.streak
        },
        progress: formattedStats,
        sessions: {
          total: sessionsCount,
          cardsCompleted: totalCardsCompleted._sum.cardsCompleted || 0,
          timeSpent: totalTimeSpent._sum.duration || 0 // in seconds
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get user progress
// @route   GET /api/users/progress
// @access  Private
export const getUserProgress = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page = 1, limit = 20 } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const progress = await prisma.userProgress.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            content: {
              select: {
                id: true,
                title: true,
                type: true
              }
            }
          }
        }
      },
      skip,
      take,
      orderBy: { updatedAt: 'desc' }
    })

    const total = await prisma.userProgress.count({
      where: { userId }
    })

    res.json({
      success: true,
      data: progress,
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

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params

    // Users can only view their own profile unless they're admin
    if (req.user.id !== id && req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this profile'
      })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        interests: true,
        dailyGoal: true,
        timezone: true,
        notifications: true,
        xp: true,
        level: true,
        streak: true,
        lastActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    // Parse interests field
    const formattedUser = {
      ...user,
      interests: parseJsonField(user.interests)
    }

    res.json({
      success: true,
      data: formattedUser
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only or own profile)
export const updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { id } = req.params

    // Users can only update their own profile unless they're admin
    if (req.user.id !== id && req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this profile'
      })
    }

    const updateData = {}
    const allowedFields = ['name', 'email']
    
    // Only admins can change roles
    if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN) {
      allowedFields.push('role')
    }

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field]
      }
    })

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        interests: true,
        dailyGoal: true,
        timezone: true,
        notifications: true,
        xp: true,
        level: true,
        streak: true,
        lastActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    res.json({
      success: true,
      data: {
        ...user,
        interests: parseJsonField(user.interests)
      }
    })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }
    next(error)
  }
}

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Super Admin only)
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params

    await prisma.user.delete({
      where: { id }
    })

    res.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }
    next(error)
  }
}

// @desc    Update user XP
// @route   POST /api/users/xp
// @access  Private
export const updateUserXP = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { amount } = req.body
    const userId = req.user.id

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: amount },
        // Simple level calculation: level = floor(xp / 1000) + 1
        level: Math.floor((req.user.xp + amount) / 1000) + 1
      },
      select: {
        id: true,
        xp: true,
        level: true,
        streak: true
      }
    })

    res.json({
      success: true,
      data: user
    })
  } catch (error) {
    next(error)
  }
}