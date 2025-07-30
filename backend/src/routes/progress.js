import express from 'express'
import { protect } from '../middleware/auth.js'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// @desc    Record card interaction (known/unknown/skip)
// @route   POST /api/progress/card-action
// @access  Private
router.post('/card-action', protect, async (req, res) => {
  try {
    const { cardId, action, sessionId } = req.body
    const userId = req.user.id

    if (!cardId || !action) {
      return res.status(400).json({
        success: false,
        error: 'Card ID and action are required'
      })
    }

    // Check if card exists
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { content: true }
    })

    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      })
    }

    // Calculate next review date based on action and spaced repetition
    const nextReviewDate = calculateNextReview(action)
    
    // Find or create user progress for this card
    const existingProgress = await prisma.userProgress.findFirst({
      where: {
        userId,
        cardId
      }
    })

    let userProgress
    if (existingProgress) {
      // Update existing progress
      userProgress = await prisma.userProgress.update({
        where: { id: existingProgress.id },
        data: {
          isKnown: action === 'known',
          lastReviewed: new Date(),
          nextReview: nextReviewDate,
          reviewCount: existingProgress.reviewCount + 1,
          streak: action === 'known' ? existingProgress.streak + 1 : 0,
          difficulty: action === 'unknown' ? Math.min(existingProgress.difficulty + 1, 5) : 
                     action === 'known' ? Math.max(existingProgress.difficulty - 0.1, 1) : 
                     existingProgress.difficulty
        }
      })
    } else {
      // Create new progress
      userProgress = await prisma.userProgress.create({
        data: {
          userId,
          cardId,
          isKnown: action === 'known',
          lastReviewed: new Date(),
          nextReview: nextReviewDate,
          reviewCount: 1,
          streak: action === 'known' ? 1 : 0,
          difficulty: action === 'unknown' ? 3 : action === 'known' ? 2 : 2.5
        }
      })
    }

    // Update user XP and stats
    const xpGain = action === 'known' ? 10 : action === 'unknown' ? 5 : 2
    await prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: xpGain },
        lastActive: new Date()
      }
    })

    res.json({
      success: true,
      data: {
        progress: userProgress,
        xpGained: xpGain,
        nextReview: nextReviewDate
      }
    })

  } catch (error) {
    console.error('Card action error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get user's learning session (cards due for review)
// @route   GET /api/progress/session
// @access  Private
router.get('/session', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const { contentId, limit = 10 } = req.query

    // Build where clause
    const whereClause = {
      AND: [
        { 
          OR: [
            { nextReview: { lte: new Date() } }, // Due for review
            { nextReview: null } // Never reviewed
          ]
        },
        ...(contentId ? [{ contentId }] : [])
      ]
    }

    // Get cards due for review
    const dueCards = await prisma.card.findMany({
      where: {
        content: { isActive: true },
        ...(contentId && { contentId }),
        OR: [
          // Cards never seen by user
          {
            NOT: {
              userProgress: {
                some: { userId }
              }
            }
          },
          // Cards due for review
          {
            userProgress: {
              some: {
                userId,
                nextReview: { lte: new Date() }
              }
            }
          }
        ]
      },
      include: {
        content: true,
        userProgress: {
          where: { userId },
          take: 1
        }
      },
      take: parseInt(limit),
      orderBy: [
        { userProgress: { nextReview: 'asc' } },
        { order: 'asc' }
      ]
    })

    // Transform to include progress info
    const sessionCards = dueCards.map(card => ({
      id: card.id,
      title: card.title,
      content: card.text,
      difficulty: card.difficulty,
      category: 'general',
      isKnown: card.userProgress[0]?.isKnown || false,
      reviewCount: card.userProgress[0]?.reviewCount || 0,
      streak: card.userProgress[0]?.streak || 0
    }))

    res.json({
      success: true,
      data: {
        cards: sessionCards,
        totalDue: sessionCards.length,
        sessionId: `session_${Date.now()}`
      }
    })

  } catch (error) {
    console.error('Session error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get user progress stats
// @route   GET /api/progress/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user.id

    // Get user with basic stats
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true, streak: true }
    })

    // Calculate detailed stats
    const totalCards = await prisma.userProgress.count({
      where: { userId }
    })

    const completedCards = await prisma.userProgress.count({
      where: { userId, status: 'COMPLETED' }
    })

    const cardsDueToday = await prisma.userProgress.count({
      where: {
        userId,
        nextReview: {
          lte: new Date(),
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })

    const averageAccuracy = await prisma.userProgress.aggregate({
      where: { userId },
      _avg: { streak: true }
    })

    // Calculate level from XP (simple formula)
    const level = Math.floor((user?.xp || 0) / 100) + 1

    res.json({
      success: true,
      data: {
        xp: user?.xp || 0,
        level,
        streak: user?.streak || 0,
        totalCards,
        completedCards,
        cardsDueToday,
        accuracy: Math.round((averageAccuracy._avg.streak || 0) * 100) / 100,
        progressPercentage: totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0
      }
    })

  } catch (error) {
    console.error('Stats error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Helper function to calculate next review date using spaced repetition
function calculateNextReview(action, currentDifficulty = 2.5, streak = 0) {
  const now = new Date()
  
  switch (action) {
    case 'known':
      // Successful review - increase interval
      const intervals = [1, 3, 7, 14, 30, 60] // days
      const intervalIndex = Math.min(streak, intervals.length - 1)
      return new Date(now.getTime() + intervals[intervalIndex] * 24 * 60 * 60 * 1000)
      
    case 'unknown':
      // Failed review - show again soon
      return new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes
      
    case 'skip':
      // Skipped - show again in a few hours
      return new Date(now.getTime() + 4 * 60 * 60 * 1000) // 4 hours
      
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000) // 1 day
  }
}

export default router