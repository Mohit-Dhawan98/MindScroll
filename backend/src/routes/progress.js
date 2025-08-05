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

    // Update chapter progress if card was completed
    if (action === 'known' && card.chapterId) {
      // Get or create chapter progress
      let chapterProgress = await prisma.chapterProgress.findFirst({
        where: { userId, chapterId: card.chapterId }
      })

      if (!chapterProgress) {
        // Get totals for this chapter
        const chapter = await prisma.chapter.findUnique({
          where: { id: card.chapterId },
          include: { cards: true }
        })

        const flashcardsTotal = chapter.cards.filter(c => c.type === 'FLASHCARD').length
        const quizzesTotal = chapter.cards.filter(c => c.type === 'QUIZ').length
        const summariesTotal = chapter.cards.filter(c => c.type === 'SUMMARY').length

        chapterProgress = await prisma.chapterProgress.create({
          data: {
            userId,
            chapterId: card.chapterId,
            flashcardsTotal,
            quizzesTotal,
            summariesTotal,
            lastAccessed: new Date()
          }
        })
      }

      // Update chapter progress based on card type
      const updateData = { lastAccessed: new Date() }
      
      switch (card.type) {
        case 'FLASHCARD':
          updateData.flashcardsCompleted = { increment: 1 }
          break
        case 'QUIZ':
          updateData.quizzesCompleted = { increment: 1 }
          break
        case 'SUMMARY':
          updateData.summariesCompleted = { increment: 1 }
          break
      }

      const updatedChapterProgress = await prisma.chapterProgress.update({
        where: { id: chapterProgress.id },
        data: updateData
      })

      // Recalculate completion percentage
      const totalCards = updatedChapterProgress.flashcardsTotal + updatedChapterProgress.quizzesTotal + 
                        updatedChapterProgress.summariesTotal
      const completedCards = updatedChapterProgress.flashcardsCompleted + updatedChapterProgress.quizzesCompleted + 
                            updatedChapterProgress.summariesCompleted
      
      const completionPercentage = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0

      await prisma.chapterProgress.update({
        where: { id: updatedChapterProgress.id },
        data: { completionPercentage }
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

// @desc    Get user's learning session (chapter-based progression)
// @route   GET /api/progress/session
// @access  Private
router.get('/session', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const { contentId, limit = 20 } = req.query

    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Content ID is required'
      })
    }

    console.log(`🎯 Session request for user ${userId}, content ${contentId}`)

    // Get all chapters for this content with progress
    const chapters = await prisma.chapter.findMany({
      where: { contentId },
      include: {
        cards: {
          include: {
            progress: {
              where: { userId },
              take: 1
            }
          },
          orderBy: { order: 'asc' }
        },
        chapterProgress: {
          where: { userId },
          take: 1
        }
      },
      orderBy: { chapterNumber: 'asc' }
    })

    console.log(`📚 Found ${chapters.length} chapters`)

    // Simple approach: Find first chapter with incomplete cards, return all pending cards in order
    let sessionCards = []
    let currentChapter = null
    let progressInfo = {}

    for (const chapter of chapters) {
      // Get all cards for this chapter in order (flashcards, then quizzes, then summaries)
      const allCards = [...chapter.cards].sort((a, b) => {
        // Sort by type first (FLASHCARD=1, QUIZ=2, SUMMARY=3), then by order
        const typeOrder = { 'FLASHCARD': 1, 'QUIZ': 2, 'SUMMARY': 3 }
        const typeA = typeOrder[a.type] || 999
        const typeB = typeOrder[b.type] || 999
        if (typeA !== typeB) return typeA - typeB
        return (a.order || 0) - (b.order || 0)
      })

      console.log(`📖 Chapter "${chapter.chapterTitle}": ${allCards.length} total cards`)

      // Debug: Log all cards and their progress
      console.log(`🔍 Chapter "${chapter.chapterTitle}" cards:`)
      allCards.forEach(card => {
        const hasProgress = card.progress.length > 0
        const isKnown = hasProgress ? card.progress[0].isKnown : false
        console.log(`  - ${card.type} "${card.title}" (progress: ${hasProgress}, known: ${isKnown})`)
      })

      // Find first incomplete card
      const pendingCards = allCards.filter(c => 
        c.progress.length === 0 || !c.progress[0].isKnown
      )

      console.log(`📊 ${allCards.length} total cards, ${pendingCards.length} pending`)

      if (pendingCards.length > 0) {
        // Found incomplete cards in this chapter
        sessionCards = pendingCards.slice(0, parseInt(limit))
        currentChapter = chapter
        
        const completedCount = allCards.length - pendingCards.length
        progressInfo = {
          chapterTitle: chapter.chapterTitle,
          chapterNumber: chapter.chapterNumber,
          currentPhase: `Chapter ${chapter.chapterNumber}`,
          progress: `${completedCount}/${allCards.length} cards completed`
        }
        console.log(`🎯 Serving ${sessionCards.length} cards from chapter "${chapter.chapterTitle}" (${completedCount}/${allCards.length} done)`)
        console.log(`🎯 Next cards to serve:`, sessionCards.map(c => `${c.type}:"${c.title}"`))
        break
      }

      console.log(`✅ Chapter "${chapter.chapterTitle}" is complete, checking next chapter`)
    }

    // If all chapters complete, check for full book summary
    if (sessionCards.length === 0) {
      console.log(`📚 All chapters complete, checking for book summary...`)
      const fullSummary = await prisma.card.findFirst({
        where: {
          contentId,
          type: 'SUMMARY',
          chapterId: null // Full book summary has no chapter
        },
        include: {
          progress: {
            where: { userId },
            take: 1
          }
        }
      })

      if (fullSummary && (fullSummary.progress.length === 0 || !fullSummary.progress[0].isKnown)) {
        sessionCards = [fullSummary]
        progressInfo = {
          chapterTitle: 'Book Complete',
          chapterNumber: chapters.length + 1,
          currentPhase: 'Final Summary',
          progress: 'Book summary available'
        }
        console.log(`🎯 Serving final book summary`)
      } else {
        console.log(`🎉 All content completed!`)
        progressInfo = {
          chapterTitle: 'Congratulations!',
          chapterNumber: chapters.length,
          currentPhase: 'Complete',
          progress: 'All content mastered'
        }
      }
    }

    // Helper function to convert numeric difficulty to labels
    function getDifficultyLabel(difficulty) {
      if (difficulty <= 2) return 'EASY'
      if (difficulty <= 3.5) return 'MEDIUM'
      return 'HARD'
    }
    
    // Transform cards to include proper content structure
    const transformedCards = sessionCards.map(card => {
      let content = ''
      
      // Handle different card types with proper content mapping
      switch (card.type) {
        case 'FLASHCARD':
          content = card.front || card.title || ''
          break
        case 'QUIZ':
          // Use title for quiz cards as the question is in the quiz object
          content = card.title || ''
          break
        case 'SUMMARY':
          content = card.front || card.title || ''
          break
        default:
          content = card.title || ''
      }
      
      return {
        id: card.id,
        title: card.title,
        content: content,
        type: card.type,
        difficulty: getDifficultyLabel(card.progress[0]?.difficulty || 2.5),
        category: 'general',
        isKnown: card.progress[0]?.isKnown || false,
        reviewCount: card.progress[0]?.reviewCount || 0,
        streak: card.progress[0]?.streak || 0,
        // Include original card data for proper rendering
        front: card.front,
        back: card.back,
        quiz: card.quiz,
        order: card.order
      }
    })

    console.log(`📤 Returning ${transformedCards.length} cards`)

    res.json({
      success: true,
      data: {
        cards: transformedCards,
        totalDue: transformedCards.length,
        sessionId: `session_${Date.now()}`,
        progression: progressInfo,
        chapterInfo: currentChapter ? {
          id: currentChapter.id,
          title: currentChapter.chapterTitle,
          number: currentChapter.chapterNumber
        } : null
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

    // 🚀 Parallel queries for better performance
    const [totalCards, completedCards, cardsDueToday, averageAccuracy] = await Promise.all([
      prisma.userProgress.count({
        where: { userId }
      }),
      prisma.userProgress.count({
        where: { userId, isKnown: true }
      }),
      prisma.userProgress.count({
        where: {
          userId,
          nextReview: {
            lte: new Date(),
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.userProgress.aggregate({
        where: { userId },
        _avg: { streak: true }
      })
    ])

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

// @desc    Get chapter progress for content
// @route   GET /api/progress/chapters/:contentId
// @access  Private
router.get('/chapters/:contentId', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const { contentId } = req.params

    // Get all chapters for this content with their progress
    const chapters = await prisma.chapter.findMany({
      where: { contentId },
      include: {
        cards: true,
        chapterProgress: {
          where: { userId },
          take: 1
        }
      },
      orderBy: { chapterNumber: 'asc' }
    })

    // Calculate progress for each chapter
    const chaptersWithProgress = chapters.map(chapter => {
      const cards = chapter.cards
      const flashcards = cards.filter(card => card.type === 'FLASHCARD')
      const quizzes = cards.filter(card => card.type === 'QUIZ')
      const summaries = cards.filter(card => card.type === 'SUMMARY')

      const progress = chapter.chapterProgress[0] || {
        flashcardsCompleted: 0,
        quizzesCompleted: 0,
        summariesCompleted: 0,
        completionPercentage: 0
      }

      // Calculate total completion percentage
      const totalCards = flashcards.length + quizzes.length + summaries.length
      const completedCards = progress.flashcardsCompleted + progress.quizzesCompleted + progress.summariesCompleted

      const completionPercentage = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0

      return {
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.chapterTitle,
        totalCards,
        flashcards: {
          total: flashcards.length,
          completed: progress.flashcardsCompleted
        },
        quizzes: {
          total: quizzes.length,
          completed: progress.quizzesCompleted
        },
        summaries: {
          total: summaries.length,
          completed: progress.summariesCompleted
        },
        completionPercentage,
        lastAccessed: progress.lastAccessed
      }
    })

    res.json({
      success: true,
      data: { chapters: chaptersWithProgress }
    })

  } catch (error) {
    console.error('Chapter progress error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Update chapter progress
// @route   POST /api/progress/chapter
// @access  Private
router.post('/chapter', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const { chapterId, cardType, action } = req.body

    if (!chapterId || !cardType || !action) {
      return res.status(400).json({
        success: false,
        error: 'Chapter ID, card type, and action are required'
      })
    }

    // Get or create chapter progress
    let chapterProgress = await prisma.chapterProgress.findFirst({
      where: { userId, chapterId }
    })

    if (!chapterProgress) {
      // Get totals for this chapter
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { cards: true }
      })

      const flashcardsTotal = chapter.cards.filter(card => card.type === 'FLASHCARD').length
      const quizzesTotal = chapter.cards.filter(card => card.type === 'QUIZ').length
      const summariesTotal = chapter.cards.filter(card => card.type === 'SUMMARY').length

      chapterProgress = await prisma.chapterProgress.create({
        data: {
          userId,
          chapterId,
          flashcardsTotal,
          quizzesTotal,
          summariesTotal,
          lastAccessed: new Date()
        }
      })
    }

    // Update based on card type and action
    const updateData = { lastAccessed: new Date() }

    if (action === 'completed') {
      switch (cardType) {
        case 'FLASHCARD':
          updateData.flashcardsCompleted = { increment: 1 }
          break
        case 'QUIZ':
          updateData.quizzesCompleted = { increment: 1 }
          break
        case 'SUMMARY':
          updateData.summariesCompleted = { increment: 1 }
          break
      }
    }

    // Update chapter progress
    const updatedProgress = await prisma.chapterProgress.update({
      where: { id: chapterProgress.id },
      data: updateData
    })

    // Recalculate completion percentage
    const totalCards = updatedProgress.flashcardsTotal + updatedProgress.quizzesTotal + 
                      updatedProgress.summariesTotal
    const completedCards = updatedProgress.flashcardsCompleted + updatedProgress.quizzesCompleted + 
                          updatedProgress.summariesCompleted
    
    const completionPercentage = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0

    await prisma.chapterProgress.update({
      where: { id: updatedProgress.id },
      data: { completionPercentage }
    })

    res.json({
      success: true,
      data: { chapterProgress: { ...updatedProgress, completionPercentage } }
    })

  } catch (error) {
    console.error('Chapter progress update error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get learning path recommendations
// @route   GET /api/progress/learning-path/:contentId
// @access  Private
router.get('/learning-path/:contentId', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const { contentId } = req.params

    // Get all chapters with progress
    const chapters = await prisma.chapter.findMany({
      where: { contentId },
      include: {
        cards: true,
        chapterProgress: {
          where: { userId },
          take: 1
        }
      },
      orderBy: { chapterNumber: 'asc' }
    })

    // Calculate learning path with recommendations
    const learningPath = chapters.map(chapter => {
      const cards = chapter.cards
      const flashcards = cards.filter(card => card.type === 'FLASHCARD')
      const quizzes = cards.filter(card => card.type === 'QUIZ')
      const summaries = cards.filter(card => card.type === 'SUMMARY')

      const progress = chapter.chapterProgress[0] || {
        flashcardsCompleted: 0,
        quizzesCompleted: 0,
        summariesCompleted: 0
      }

      // Calculate completion rates for each card type (1.0 if no cards of that type exist)
      const flashcardCompletion = flashcards.length > 0 ? progress.flashcardsCompleted / flashcards.length : 1.0
      const quizCompletion = quizzes.length > 0 ? progress.quizzesCompleted / quizzes.length : 1.0
      const summaryCompletion = summaries.length > 0 ? progress.summariesCompleted / summaries.length : 1.0

      // Determine next recommended action based on what card types actually exist
      let nextAction = 'start'
      let nextCardType = 'FLASHCARD'
      let isReady = true

      if (flashcards.length > 0 && flashcardCompletion < 1) {
        nextAction = 'continue'
        nextCardType = 'FLASHCARD'
      } else if (quizzes.length > 0 && quizCompletion < 1) {
        nextAction = 'continue'
        nextCardType = 'QUIZ'
        isReady = flashcards.length === 0 || flashcardCompletion >= 0.8 // Need flashcard foundation for quizzes
      } else if (summaries.length > 0 && summaryCompletion < 1) {
        nextAction = 'summary'
        nextCardType = 'SUMMARY'
        isReady = (flashcards.length === 0 || flashcardCompletion >= 0.8) && 
                  (quizzes.length === 0 || quizCompletion >= 0.7) // Need good understanding for summary
      } else {
        nextAction = 'complete'
        nextCardType = null
      }

      // Calculate overall chapter completion
      const totalCards = flashcards.length + quizzes.length + summaries.length
      const completedCards = progress.flashcardsCompleted + progress.quizzesCompleted + progress.summariesCompleted

      const completionPercentage = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0

      return {
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.chapterTitle,
        completionPercentage,
        nextAction,
        nextCardType,
        isReady,
        cardBreakdown: {
          flashcards: {
            total: flashcards.length,
            completed: progress.flashcardsCompleted,
            completion: flashcardCompletion
          },
          quizzes: {
            total: quizzes.length,
            completed: progress.quizzesCompleted,
            completion: quizCompletion
          },
          summaries: {
            total: summaries.length,
            completed: progress.summariesCompleted,
            completion: summaryCompletion
          }
        },
        lastAccessed: progress.lastAccessed
      }
    })

    // Find the best next chapter to work on
    const incompleteChapters = learningPath.filter(ch => ch.completionPercentage < 100)
    const nextChapter = incompleteChapters.length > 0 ? incompleteChapters[0] : null

    // Get the full book summary card (has no chapter ID)
    const fullSummaryCard = await prisma.card.findFirst({
      where: { 
        contentId,
        type: 'SUMMARY',
        chapterId: null // Full book summary has no chapter
      }
    })

    // Check if user has completed the full summary
    let fullSummaryCompleted = false
    if (fullSummaryCard) {
      const fullSummaryProgress = await prisma.userProgress.findFirst({
        where: {
          userId,
          cardId: fullSummaryCard.id,
          isKnown: true
        }
      })
      fullSummaryCompleted = !!fullSummaryProgress
    }

    // Calculate overall content progress
    const overallCompletion = Math.round(
      learningPath.reduce((acc, ch) => acc + ch.completionPercentage, 0) / learningPath.length
    )

    // Determine if full summary should be shown
    const allChaptersComplete = learningPath.every(ch => ch.completionPercentage === 100)
    const showFullSummary = fullSummaryCard && allChaptersComplete && !fullSummaryCompleted

    res.json({
      success: true,
      data: {
        chapters: learningPath,
        nextChapter,
        overallCompletion,
        totalChapters: learningPath.length,
        completedChapters: learningPath.filter(ch => ch.completionPercentage === 100).length,
        fullSummary: fullSummaryCard ? {
          id: fullSummaryCard.id,
          title: fullSummaryCard.title,
          completed: fullSummaryCompleted,
          ready: allChaptersComplete,
          showNext: showFullSummary
        } : null
      }
    })

  } catch (error) {
    console.error('Learning path error:', error)
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