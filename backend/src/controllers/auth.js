import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { validationResult } from 'express-validator'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  })
}

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { email, password, name } = req.body

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(12)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create user
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(), // Generate UUID for user ID
        email,
        name,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        xp: true,
        level: true,
        streak: true,
        createdAt: true
      }
    })

    const token = generateToken(user.id)

    res.status(201).json({
      success: true,
      token,
      user
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { email, password } = req.body

    // Check for user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() }
    })

    const token = generateToken(user.id)

    const { password: _, ...userWithoutPassword } = user

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
      user
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const updateData = {}
    const allowedFields = ['name', 'interests', 'dailyGoal', 'timezone', 'notifications']

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field]
      }
    })

    const user = await prisma.user.update({
      where: { id: req.user.id },
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
      user
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    // Implementation would involve sending email with reset token
    // For now, just return success message
    res.json({
      success: true,
      message: 'Password reset email sent (not implemented yet)'
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    // Implementation would involve validating reset token and updating password
    res.json({
      success: true,
      message: 'Password reset successful (not implemented yet)'
    })
  } catch (error) {
    next(error)
  }
}