import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      })

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'No user found with this ID'
        })
      }

      req.user = user
      next()
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      })
    }
  } catch (error) {
    next(error)
  }
}

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      })
    }
    next()
  }
}