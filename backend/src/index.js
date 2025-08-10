import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'

// Import routes
import authRoutes from './routes/auth.js'
import contentRoutes from './routes/content.js'
import userRoutes from './routes/user.js'
import uploadRoutes from './routes/upload.js'
import aiRoutes from './routes/ai.js'
import libraryRoutes from './routes/library.js'
import progressRoutes from './routes/progress.js'

// Import middleware
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'

// Import queue service and worker
import './services/queueService.js'
import './services/worker.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
})

// CORS configuration - MUST come before other middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || ['http://localhost:3000'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}))

// Security middleware - after CORS to avoid conflicts
app.use(helmet({
  crossOriginResourcePolicy: false,
}))
app.use(compression())
app.use(limiter)

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'MindScroll API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/content', contentRoutes)
app.use('/api/users', userRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/library', libraryRoutes)
app.use('/api/progress', progressRoutes)

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'MindScroll API',
    version: '1.0.0',
    description: 'AI-powered microlearning platform API',
    endpoints: {
      auth: '/api/auth',
      content: '/api/content',
      users: '/api/users',
      upload: '/api/upload',
      ai: '/api/ai'
    }
  })
})

// Error handling middleware
app.use(notFound)
app.use(errorHandler)

// Global error handlers to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't crash the server, just log the error
})

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error)
  console.error('🚨 Stack trace:', error.stack)
  // Don't crash the server, just log the error
})

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received. Shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('📴 SIGINT received. Shutting down gracefully...')
  process.exit(0)
})

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 MindScroll API server running on port ${PORT}`)
  console.log(`📚 Environment: ${process.env.NODE_ENV}`)
  console.log(`🔗 Health check: http://localhost:${PORT}/health`)
  
  // Queue-based processing system initialized
  console.log(`📖 Library content managed manually via scripts`)
  console.log(`📤 User upload processing with queue system available via /api/upload/*`)
  console.log(`🔄 Content processing worker started`)
})

export default app