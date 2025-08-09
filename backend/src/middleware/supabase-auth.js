import { supabaseAdmin } from '../lib/supabase.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Supabase authentication middleware
 * Verifies JWT tokens issued by Supabase Auth
 */
export const protect = async (req, res, next) => {
  try {
    let token

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      })
    }

    try {
      // Verify token with Supabase
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token or user not found'
        })
      }

      // Get additional user data from our database
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id }
      })

      if (!dbUser) {
        // User exists in Supabase Auth but not in our database
        // This might happen during migration or if user was created directly in Supabase
        return res.status(401).json({
          success: false,
          error: 'User profile not found. Please complete your profile setup.'
        })
      }

      // Attach user data to request
      req.user = {
        ...dbUser,
        supabaseUser: user // Include Supabase user data if needed
      }
      
      next()
    } catch (err) {
      console.error('Token verification error:', err)
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      })
    }
  } catch (error) {
    console.error('Auth middleware error:', error)
    next(error)
  }
}

/**
 * Role-based authorization middleware
 * Use after protect middleware
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      })
    }
    next()
  }
}

/**
 * Optional auth middleware - doesn't require authentication but adds user if present
 * Useful for endpoints that work for both authenticated and anonymous users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      // No token, continue without user
      req.user = null
      return next()
    }

    try {
      // Verify token with Supabase
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

      if (error || !user) {
        // Invalid token, continue without user
        req.user = null
        return next()
      }

      // Get additional user data from our database
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id }
      })

      if (dbUser) {
        req.user = {
          ...dbUser,
          supabaseUser: user
        }
      } else {
        req.user = null
      }
      
      next()
    } catch (err) {
      console.error('Optional auth error:', err)
      // Continue without user on error
      req.user = null
      next()
    }
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    req.user = null
    next()
  }
}

/**
 * Middleware to sync user data between Supabase Auth and our database
 * Use this when creating or updating user profiles
 */
export const syncUserProfile = async (supabaseUser, additionalData = {}) => {
  try {
    const userData = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
      avatar: supabaseUser.user_metadata?.avatar_url,
      ...additionalData
    }

    const user = await prisma.user.upsert({
      where: { id: supabaseUser.id },
      update: userData,
      create: userData
    })

    return user
  } catch (error) {
    console.error('Error syncing user profile:', error)
    throw error
  }
}