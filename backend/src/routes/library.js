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

// @desc    Get available content library
// @route   GET /api/library/content
// @access  Private
router.get('/content', protect, async (req, res) => {
  try {
    const { category, difficulty, limit = 20, offset = 0 } = req.query
    
    const whereClause = {
      isActive: true,
      ...(category && { category }),
      ...(difficulty && { difficulty })
    }
    
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
    
    const total = await prisma.content.count({ where: whereClause })
    
    res.json({
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
    })
  } catch (error) {
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
    
    res.json({
      success: true,
      data: content
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

export default router