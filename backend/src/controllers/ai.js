import { validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import { MessageRole } from '../utils/constants.js'
import aiService from '../services/aiService.js'

const prisma = new PrismaClient()

// @desc    Chat with AI tutor
// @route   POST /api/ai/chat
// @access  Private
export const chatWithTutor = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { message, conversationId } = req.body
    const userId = req.user.id

    let conversation
    if (conversationId) {
      // Find existing conversation
      conversation = await prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          userId
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10 // Last 10 messages for context
          }
        }
      })

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        })
      }
    } else {
      // Create new conversation
      conversation = await prisma.chatConversation.create({
        data: {
          userId,
          title: message.substring(0, 50) + '...'
        },
        include: {
          messages: true
        }
      })
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: message
      }
    })

    // Get conversation history for context
    const conversationHistory = conversation.messages.map(msg => ({
      role: msg.role.toLowerCase(),
      content: msg.content
    }))

    // Get AI response
    const aiResponse = await aiService.chatWithTutor(message, '', conversationHistory)

    // Save AI response
    const aiMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: aiResponse
      }
    })

    res.json({
      success: true,
      data: {
        conversationId: conversation.id,
        message: aiMessage,
        response: aiResponse
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Start new conversation
// @route   POST /api/ai/conversation
// @access  Private
export const startNewConversation = async (req, res, next) => {
  try {
    const { title } = req.body
    const userId = req.user.id

    const conversation = await prisma.chatConversation.create({
      data: {
        userId,
        title: title || 'New Conversation'
      }
    })

    res.status(201).json({
      success: true,
      data: conversation
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get chat history
// @route   GET /api/ai/conversations
// @access  Private
export const getChatHistory = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page = 1, limit = 10 } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const conversations = await prisma.chatConversation.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Last message for preview
        }
      },
      skip,
      take,
      orderBy: { updatedAt: 'desc' }
    })

    const total = await prisma.chatConversation.count({
      where: { userId }
    })

    res.json({
      success: true,
      data: conversations,
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

// @desc    Generate content from text
// @route   POST /api/ai/generate-content
// @access  Private
export const generateContent = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { text, type, difficulty = 'INTERMEDIATE', topics = [] } = req.body

    let result
    switch (type) {
      case 'summary':
        result = await aiService.generateSummary(text, {
          difficulty,
          length: 'medium'
        })
        break
      case 'flashcards':
        result = await aiService.generateFlashcards(text, {
          numCards: 10
        })
        break
      case 'quiz':
        result = await aiService.generateQuiz(text, {
          numQuestions: 5,
          difficulty
        })
        break
      case 'visual':
        const visualPrompt = await aiService.generateVisualPrompt(text)
        result = { prompt: visualPrompt }
        break
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid content type'
        })
    }

    res.json({
      success: true,
      data: {
        type,
        content: result
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Generate quiz from content
// @route   POST /api/ai/generate-quiz
// @access  Private
export const generateQuiz = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { contentId, numQuestions = 5, difficulty = 'INTERMEDIATE' } = req.body

    // Get content
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        cards: {
          where: { type: 'SUMMARY' }
        }
      }
    })

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      })
    }

    // Combine text from summary cards
    const text = content.cards.map(card => card.text).join('\n\n')

    const quiz = await aiService.generateQuiz(text, {
      numQuestions,
      difficulty
    })

    res.json({
      success: true,
      data: {
        contentId,
        quiz
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Generate summary from URL or text
// @route   POST /api/ai/generate-summary
// @access  Private
export const generateSummary = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { 
      source, 
      type, 
      length = 'medium', 
      style = 'academic' 
    } = req.body

    let text
    if (type === 'url') {
      // This would require URL processing - simplified for now
      return res.status(400).json({
        success: false,
        error: 'URL processing not implemented yet'
      })
    } else {
      text = source
    }

    const summary = await aiService.generateSummary(text, {
      length,
      style,
      difficulty: 'INTERMEDIATE'
    })

    res.json({
      success: true,
      data: {
        summary,
        length,
        style
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Generate visual content
// @route   POST /api/ai/generate-visual
// @access  Private
export const generateVisual = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { prompt, style = 'diagram', cardId } = req.body

    try {
      // Generate visual prompt
      const visualPrompt = await aiService.generateVisualPrompt(prompt, style)
      
      // For now, just return the prompt. In production, you'd generate the actual image
      // const imageUrl = await aiService.generateImage(visualPrompt)

      const result = {
        prompt: visualPrompt,
        style,
        // imageUrl: imageUrl
        imageUrl: null // Placeholder
      }

      // If cardId provided, optionally update the card
      if (cardId) {
        await prisma.card.update({
          where: { id: cardId },
          data: {
            imageUrl: result.imageUrl
          }
        })
      }

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error generating visual:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to generate visual content'
      })
    }
  } catch (error) {
    next(error)
  }
}

// @desc    Convert text to speech
// @route   POST /api/ai/text-to-speech
// @access  Private
export const textToSpeech = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { text, voice = 'alloy', speed = 1.0 } = req.body

    // For now, return placeholder response
    // In production, you'd use the AI service to generate actual audio
    res.json({
      success: true,
      data: {
        audioUrl: null, // Placeholder
        voice,
        speed,
        message: 'Text-to-speech not implemented yet'
      }
    })
  } catch (error) {
    next(error)
  }
}