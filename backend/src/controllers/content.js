import { validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { 
  ContentType, 
  ContentSource, 
  DifficultyLevel, 
  ProgressStatus,
  parseJsonField, 
  stringifyJsonField 
} from '../utils/constants.js'

const prisma = new PrismaClient()

// @desc    Get all content with filtering and pagination
// @route   GET /api/content
// @access  Private
export const getContent = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      difficulty, 
      topics 
    } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const where = {}
    if (type) where.type = type
    if (difficulty) where.difficulty = difficulty

    const content = await prisma.content.findMany({
      where,
      include: {
        cards: {
          select: {
            id: true,
            type: true,
            title: true,
            order: true
          },
          orderBy: { order: 'asc' }
        }
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    })

    // Parse JSON fields
    const formattedContent = content.map(item => ({
      ...item,
      topics: parseJsonField(item.topics),
      tags: parseJsonField(item.tags)
    }))

    const total = await prisma.content.count({ where })

    res.json({
      success: true,
      data: formattedContent,
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

// @desc    Search content
// @route   GET /api/content/search
// @access  Private
export const searchContent = async (req, res, next) => {
  try {
    const { q } = req.query

    const content = await prisma.content.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } }
        ]
      },
      include: {
        cards: {
          select: {
            id: true,
            type: true,
            title: true,
            order: true
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const formattedContent = content.map(item => ({
      ...item,
      topics: parseJsonField(item.topics),
      tags: parseJsonField(item.tags)
    }))

    res.json({
      success: true,
      data: formattedContent
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get daily feed for user
// @route   GET /api/content/feed
// @access  Private
export const getDailyFeed = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { limit = 10 } = req.query

    // Get user's progress to find cards they haven't completed
    const userProgress = await prisma.userProgress.findMany({
      where: { 
        userId,
        status: { not: ProgressStatus.COMPLETED }
      },
      include: {
        card: {
          include: {
            content: true
          }
        }
      }
    })

    // If user has no progress, get some random cards
    if (userProgress.length === 0) {
      const cards = await prisma.card.findMany({
        include: {
          content: true
        },
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      })

      return res.json({
        success: true,
        data: cards.map(card => ({
          ...card,
          quiz: card.quiz ? JSON.parse(card.quiz) : null,
          content: {
            ...card.content,
            topics: parseJsonField(card.content.topics),
            tags: parseJsonField(card.content.tags)
          }
        }))
      })
    }

    // Return cards from user's progress
    const cards = userProgress.slice(0, parseInt(limit)).map(progress => ({
      ...progress.card,
      quiz: progress.card.quiz ? JSON.parse(progress.card.quiz) : null,
      content: {
        ...progress.card.content,
        topics: parseJsonField(progress.card.content.topics),
        tags: parseJsonField(progress.card.content.tags)
      }
    }))

    res.json({
      success: true,
      data: cards
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get content by ID
// @route   GET /api/content/:id
// @access  Private
export const getContentById = async (req, res, next) => {
  try {
    const { id } = req.params

    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        cards: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      })
    }

    // Format the response
    const formattedContent = {
      ...content,
      topics: parseJsonField(content.topics),
      tags: parseJsonField(content.tags),
      cards: content.cards.map(card => ({
        ...card,
        quiz: card.quiz ? JSON.parse(card.quiz) : null
      }))
    }

    res.json({
      success: true,
      data: formattedContent
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get cards for specific content
// @route   GET /api/content/:id/cards
// @access  Private
export const getCardsByContent = async (req, res, next) => {
  try {
    const { id } = req.params

    const cards = await prisma.card.findMany({
      where: { contentId: id },
      orderBy: { order: 'asc' }
    })

    const formattedCards = cards.map(card => ({
      ...card,
      quiz: card.quiz ? JSON.parse(card.quiz) : null
    }))

    res.json({
      success: true,
      data: formattedCards
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Create new content
// @route   POST /api/content
// @access  Private (Admin only)
export const createContent = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { 
      title, 
      description, 
      type, 
      source, 
      sourceUrl,
      difficulty = DifficultyLevel.INTERMEDIATE,
      topics = [],
      tags = [],
      estimatedTime = 5
    } = req.body

    const content = await prisma.content.create({
      data: {
        title,
        description,
        type,
        source,
        sourceUrl,
        difficulty,
        topics: stringifyJsonField(topics),
        tags: stringifyJsonField(tags),
        estimatedTime
      }
    })

    res.status(201).json({
      success: true,
      data: {
        ...content,
        topics: parseJsonField(content.topics),
        tags: parseJsonField(content.tags)
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update content
// @route   PUT /api/content/:id
// @access  Private (Admin only)
export const updateContent = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { id } = req.params
    const updateData = {}
    
    const allowedFields = ['title', 'description', 'difficulty', 'topics', 'tags', 'estimatedTime']
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'topics' || field === 'tags') {
          updateData[field] = stringifyJsonField(req.body[field])
        } else {
          updateData[field] = req.body[field]
        }
      }
    })

    const content = await prisma.content.update({
      where: { id },
      data: updateData
    })

    res.json({
      success: true,
      data: {
        ...content,
        topics: parseJsonField(content.topics),
        tags: parseJsonField(content.tags)
      }
    })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      })
    }
    next(error)
  }
}

// @desc    Delete content
// @route   DELETE /api/content/:id
// @access  Private (Admin only)
export const deleteContent = async (req, res, next) => {
  try {
    const { id } = req.params

    await prisma.content.delete({
      where: { id }
    })

    res.json({
      success: true,
      message: 'Content deleted successfully'
    })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      })
    }
    next(error)
  }
}

// @desc    Update user progress on a card
// @route   POST /api/content/progress
// @access  Private
export const updateProgress = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { cardId, status, score } = req.body
    const userId = req.user.id

    // Check if progress exists
    const existingProgress = await prisma.userProgress.findUnique({
      where: {
        userId_cardId: {
          userId,
          cardId
        }
      }
    })

    let progress
    if (existingProgress) {
      progress = await prisma.userProgress.update({
        where: {
          userId_cardId: {
            userId,
            cardId
          }
        },
        data: {
          status,
          score,
          attempts: { increment: 1 },
          lastReviewed: new Date()
        }
      })
    } else {
      progress = await prisma.userProgress.create({
        data: {
          userId,
          cardId,
          status,
          score,
          attempts: 1
        }
      })
    }

    res.json({
      success: true,
      data: progress
    })
  } catch (error) {
    next(error)
  }
}