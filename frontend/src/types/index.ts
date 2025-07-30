// User types
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  interests: string[]
  dailyGoal: number
  timezone: string
  notifications: boolean
  xp: number
  level: number
  streak: number
  lastActive?: string
  createdAt: string
  updatedAt: string
}

// Content types
export interface Content {
  id: string
  title: string
  description?: string
  type: 'SUMMARY' | 'ARTICLE' | 'COURSE' | 'UPLOADED'
  source: 'CURATED' | 'AI_GENERATED' | 'USER_UPLOADED'
  sourceUrl?: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  topics: string[]
  tags: string[]
  estimatedTime: number
  isAiGenerated: boolean
  sourceType?: string
  cards: Card[]
  createdAt: string
  updatedAt: string
}

// Card types
export interface Card {
  id: string
  contentId: string
  type: 'SUMMARY' | 'FLASHCARD' | 'QUIZ' | 'VISUAL' | 'AUDIO'
  title: string
  text?: string
  imageUrl?: string
  audioUrl?: string
  order: number
  quiz?: QuizData
  front?: string
  back?: string
  createdAt: string
  updatedAt: string
}

export interface QuizData {
  question: string
  choices: string[]
  answer: string
  explanation?: string
}

// Progress types
export interface UserProgress {
  id: string
  userId: string
  cardId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW'
  score?: number
  attempts: number
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: string
  lastReviewed?: string
  createdAt: string
  updatedAt: string
  card?: Card
}

// Chat types
export interface ChatConversation {
  id: string
  userId: string
  title?: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  metadata?: any
  createdAt: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  errors?: any[]
  message?: string
}

export interface PaginatedResponse<T = any> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Upload types
export interface ContentUpload {
  id: string
  userId: string
  contentId?: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
  error?: string
  content?: Content
  createdAt: string
  updatedAt: string
}

// Learning Session types
export interface LearningSession {
  id: string
  userId: string
  cardsCompleted: number
  duration: number
  xpEarned: number
  startedAt: string
  completedAt?: string
}

// Stats types
export interface UserStats {
  user: {
    xp: number
    level: number
    streak: number
  }
  progress: {
    notStarted: number
    inProgress: number
    completed: number
    needsReview: number
  }
  sessions: {
    total: number
    cardsCompleted: number
    timeSpent: number
  }
}