import express from 'express'
import { protect } from '../middleware/auth.js'
import { getProcessorStats } from '../processors/index.js'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// @desc    Get library statistics  
// @route   GET /api/library/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = await getProcessorStats()
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get global content library (curated content + approved user content)
// @route   GET /api/library/content
// @access  Private
router.get('/content', protect, async (req, res) => {
  try {
    console.log('🔍 Global library content request:', req.query)
    console.log('🔑 User:', req.user?.id)
    
    const { category, difficulty, limit = 20, offset = 0, excludeEnrolled = 'false' } = req.query
    
    const whereClause = {
      isActive: true,
      ...(category && { category }),
      ...(difficulty && { difficulty }),
      // Only include curated content or approved user content
      OR: [
        {
          source: { not: 'USER_UPLOADED' } // Include all curated/AI-generated content
        },
        {
          AND: [
            { source: 'USER_UPLOADED' },
            { approvedForGlobal: true }, // Only approved user content
            { totalCards: { gt: 0 } }, // Only include user uploads that have cards
            { chapters: { some: {} } }, // And have at least one chapter
            { 
              uploads: {
                some: {
                  status: 'COMPLETED' // Only show books from completed uploads
                }
              }
            }
          ]
        }
      ]
    }
    
    console.log('📋 Global library where clause:', whereClause)
    
    const content = await prisma.content.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { cards: true }
        },
        owner: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    })
    
    console.log('📚 Found global content count:', content.length)
    if (content.length > 0) {
      console.log('📖 First book:', {
        id: content[0].id,
        title: content[0].title,
        author: content[0].author,
        isActive: content[0].isActive,
        cards: content[0]._count.cards,
        source: content[0].source,
        approved: content[0].approvedForGlobal
      })
    }
    
    const total = await prisma.content.count({ where: whereClause })
    
    // Add cache-busting headers to prevent stale cached responses
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })
    
    const response = {
      success: true,
      data: {
        content,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + parseInt(limit)
        }
      }
    }
    
    // Check enrollment status efficiently with single query
    const userId = req.user?.id
    if (userId && content.length > 0) {
      const contentIds = content.map(c => c.id)
      
      // Get all cards for these content items
      const allCards = await prisma.card.findMany({
        where: { contentId: { in: contentIds } },
        select: { id: true, contentId: true }
      })
      
      // Get user's enrollment status for any of these cards
      const userEnrollments = await prisma.userProgress.findMany({
        where: {
          userId,
          cardId: { in: allCards.map(c => c.id) }
        },
        select: { cardId: true }
      })
      
      // Map enrolled card IDs to content IDs
      const enrolledCardIds = new Set(userEnrollments.map(e => e.cardId))
      const enrolledContentIds = new Set()
      
      allCards.forEach(card => {
        if (enrolledCardIds.has(card.id)) {
          enrolledContentIds.add(card.contentId)
        }
      })
      
      // Add enrollment status to content
      content.forEach(book => {
        book.isEnrolled = enrolledContentIds.has(book.id)
      })
      
      console.log('📊 Enrollment status check:', {
        userId,
        contentIds,
        allCardsCount: allCards.length,
        userEnrollmentsCount: userEnrollments.length,
        enrolledContentIds: Array.from(enrolledContentIds),
        contentWithStatus: content.map(c => ({ id: c.id, title: c.title, isEnrolled: c.isEnrolled }))
      })
    }
    
    // Filter out enrolled books if requested
    if (excludeEnrolled === 'true') {
      response.data.content = content.filter(book => !book.isEnrolled)
      console.log('🚫 Filtered out enrolled books:', {
        originalCount: content.length,
        filteredCount: response.data.content.length,
        excludedCount: content.length - response.data.content.length
      })
    }
    
    console.log('📤 Response summary:', {
      success: response.success,
      contentCount: response.data.content.length,
      total: response.data.pagination.total,
      enrolledCount: content.filter(c => c.isEnrolled).length
    })
    
    res.json(response)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get user's uploaded content (My Uploads)
// @route   GET /api/library/my-uploads
// @access  Private
router.get('/my-uploads', protect, async (req, res) => {
  try {
    console.log('📤 User uploads request:', req.query)
    console.log('🔑 User:', req.user?.id)
    
    const userId = req.user.id
    const { category, difficulty, limit = 20, offset = 0, includeUnapproved = 'true' } = req.query
    
    const whereClause = {
      isActive: true,
      source: 'USER_UPLOADED',
      userId: userId, // Critical: Only show content owned by the current user
      ...(category && { category }),
      ...(difficulty && { difficulty }),
      // Include content that has been processed
      AND: [
        { totalCards: { gt: 0 } }, // Only include uploads that have cards
        { chapters: { some: {} } }, // And have at least one chapter
        { 
          uploads: {
            some: {
              status: 'COMPLETED' // Only show books from completed uploads
            }
          }
        }
      ]
    }
    
    console.log('📋 User uploads where clause:', whereClause)
    
    const content = await prisma.content.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { cards: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    })
    
    console.log('📚 Found user uploads count:', content.length)
    if (content.length > 0) {
      console.log('📖 First upload:', {
        id: content[0].id,
        title: content[0].title,
        author: content[0].author,
        isActive: content[0].isActive,
        cards: content[0]._count.cards,
        approved: content[0].approvedForGlobal,
        userId: content[0].userId
      })
    }
    
    const total = await prisma.content.count({ where: whereClause })
    
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })
    
    const response = {
      success: true,
      data: {
        content: content.map(item => ({
          ...item,
          isOwnContent: true, // Flag to indicate this is user's own content
          canRequestApproval: !item.approvedForGlobal // User can request approval if not approved
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + parseInt(limit)
        }
      }
    }
    
    console.log('📤 User uploads response summary:', {
      success: response.success,
      contentCount: response.data.content.length,
      total: response.data.pagination.total,
      approvedCount: content.filter(c => c.approvedForGlobal).length
    })
    
    res.json(response)
  } catch (error) {
    console.error('❌ User uploads error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get content by ID with cards
// @route   GET /api/library/content/:id
// @access  Private
router.get('/content/:id', protect, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    
    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        cards: {
          orderBy: { order: 'asc' }
        },
        owner: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      })
    }
    
    // Security check: Ensure user can access this content
    const isUserContent = content.source === 'USER_UPLOADED'
    const isContentOwner = content.userId === userId
    const isApprovedContent = content.approvedForGlobal
    const isCuratedContent = content.source !== 'USER_UPLOADED'
    
    // Allow access if:
    // 1. It's curated content (not user uploaded), OR
    // 2. It's user's own content, OR  
    // 3. It's approved user content
    if (!isCuratedContent && !isContentOwner && !isApprovedContent) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. This content is private.'
      })
    }
    
    res.json({
      success: true,
      data: {
        ...content,
        isOwnContent: isContentOwner
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get categories with counts
// @route   GET /api/library/categories
// @access  Private
router.get('/categories', protect, async (req, res) => {
  try {
    const categories = await prisma.content.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: {
        id: true
      },
      orderBy: {
        category: 'asc'
      }
    })
    
    res.json({
      success: true,
      data: categories.map(cat => ({
        name: cat.category,
        count: cat._count.id
      }))
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Enroll user in a book/content
// @route   POST /api/library/enroll/:id
// @access  Private
router.post('/enroll/:id', protect, async (req, res) => {
  const contentId = req.params.id
  const userId = req.user.id
  
  try {
    
    console.log('📝 Enrollment request:', { contentId, userId })
    
    // Check if content exists and is active
    const content = await prisma.content.findFirst({
      where: { 
        id: contentId, 
        isActive: true 
      },
      include: {
        cards: {
          select: { id: true }
        }
      }
    })
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found or not available'
      })
    }
    
    // Check if user is already enrolled
    const existingEnrollment = await prisma.userProgress.findFirst({
      where: {
        userId,
        cardId: { in: content.cards.map(c => c.id) }
      }
    })
    
    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        error: 'Already enrolled in this content'
      })
    }
    
    // Create UserProgress entries for all cards in the content
    const progressData = content.cards.map(card => ({
      userId,
      cardId: card.id,
      status: 'NOT_STARTED'
    }))
    
    await prisma.userProgress.createMany({
      data: progressData
    })
    
    res.json({
      success: true,
      message: `Successfully enrolled in "${content.title}"`,
      data: {
        contentId: content.id,
        cardsCount: content.cards.length
      }
    })
    
  } catch (error) {
    console.error('❌ Enrollment error:', {
      error: error.message,
      stack: error.stack,
      contentId,
      userId
    })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get user's enrolled library
// @route   GET /api/library/my-library
// @access  Private
router.get('/my-library', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const { limit = 20, offset = 0 } = req.query
    
    // Get unique content IDs from user's progress
    const userProgress = await prisma.userProgress.findMany({
      where: { userId },
      select: {
        card: {
          select: {
            contentId: true,
            content: {
              select: {
                id: true,
                title: true,
                author: true,
                description: true,
                category: true,
                difficulty: true,
                estimatedTime: true,
                createdAt: true,
                _count: {
                  select: { cards: true }
                }
              }
            }
          }
        },
        isKnown: true,
        reviewCount: true
      }
    })
    
    // Group by content and calculate progress stats
    const contentMap = new Map()
    
    userProgress.forEach(progress => {
      const content = progress.card.content
      const contentId = content.id
      
      if (!contentMap.has(contentId)) {
        contentMap.set(contentId, {
          ...content,
          totalCards: content._count.cards,
          completedCards: 0,
          inProgressCards: 0,
          notStartedCards: 0
        })
      }
      
      const contentStats = contentMap.get(contentId)
      if (progress.isKnown) {
        contentStats.completedCards++
      } else if (progress.reviewCount > 0) {
        contentStats.inProgressCards++
      } else {
        contentStats.notStartedCards++
      }
    })
    
    const enrolledContent = Array.from(contentMap.values())
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    
    res.json({
      success: true,
      data: {
        content: enrolledContent,
        pagination: {
          total: contentMap.size,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: contentMap.size > parseInt(offset) + parseInt(limit)
        }
      }
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Unenroll user from a book/content
// @route   DELETE /api/library/enroll/:id
// @access  Private
router.delete('/enroll/:id', protect, async (req, res) => {
  try {
    const { id: contentId } = req.params
    const userId = req.user.id
    
    // Get all card IDs for this content
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        cards: {
          select: { id: true }
        }
      }
    })
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      })
    }
    
    // Delete all UserProgress entries for this content
    const deleteResult = await prisma.userProgress.deleteMany({
      where: {
        userId,
        cardId: { in: content.cards.map(c => c.id) }
      }
    })
    
    if (deleteResult.count === 0) {
      return res.status(400).json({
        success: false,
        error: 'Not enrolled in this content'
      })
    }
    
    res.json({
      success: true,
      message: `Successfully unenrolled from "${content.title}"`,
      data: {
        contentId: content.id,
        removedProgress: deleteResult.count
      }
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Approve user content for global library (Admin only)
// @route   PUT /api/library/approve/:id
// @access  Private (Admin)
router.put('/approve/:id', protect, async (req, res) => {
  try {
    const { id } = req.params
    const { approved } = req.body
    
    // Check if user is admin (you might want to add admin middleware)
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      })
    }
    
    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      })
    }
    
    if (content.source !== 'USER_UPLOADED') {
      return res.status(400).json({
        success: false,
        error: 'Only user-uploaded content can be approved'
      })
    }
    
    const updatedContent = await prisma.content.update({
      where: { id },
      data: {
        approvedForGlobal: approved === true
      }
    })
    
    res.json({
      success: true,
      message: `Content ${approved ? 'approved for' : 'removed from'} global library`,
      data: {
        id: updatedContent.id,
        title: updatedContent.title,
        approvedForGlobal: updatedContent.approvedForGlobal,
        owner: content.owner
      }
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// @desc    Get pending approval content (Admin only)
// @route   GET /api/library/pending-approval
// @access  Private (Admin)
router.get('/pending-approval', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      })
    }
    
    const { limit = 20, offset = 0 } = req.query
    
    const pendingContent = await prisma.content.findMany({
      where: {
        source: 'USER_UPLOADED',
        approvedForGlobal: false,
        isActive: true,
        totalCards: { gt: 0 }
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: { cards: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    })
    
    const total = await prisma.content.count({
      where: {
        source: 'USER_UPLOADED',
        approvedForGlobal: false,
        isActive: true,
        totalCards: { gt: 0 }
      }
    })
    
    res.json({
      success: true,
      data: {
        content: pendingContent,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + parseInt(limit)
        }
      }
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router