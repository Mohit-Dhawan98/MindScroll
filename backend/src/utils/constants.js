// Constants for SQLite-compatible enums and validation

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
}

export const ContentType = {
  SUMMARY: 'SUMMARY',
  ARTICLE: 'ARTICLE',
  COURSE: 'COURSE',
  UPLOADED: 'UPLOADED'
}

export const ContentSource = {
  CURATED: 'CURATED',
  AI_GENERATED: 'AI_GENERATED',
  USER_UPLOADED: 'USER_UPLOADED'
}

export const DifficultyLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED'
}

export const CardType = {
  SUMMARY: 'SUMMARY',
  FLASHCARD: 'FLASHCARD',
  QUIZ: 'QUIZ',
  VISUAL: 'VISUAL',
  AUDIO: 'AUDIO'
}

export const ProgressStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  NEEDS_REVIEW: 'NEEDS_REVIEW'
}

export const UploadStatus = {
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
}

export const MessageRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM'
}

// Helper functions for JSON fields in SQLite
export const parseJsonField = (field) => {
  if (!field) return []
  try {
    return JSON.parse(field)
  } catch (error) {
    console.error('Error parsing JSON field:', error)
    return []
  }
}

export const stringifyJsonField = (data) => {
  if (!data) return '[]'
  if (typeof data === 'string') return data
  try {
    return JSON.stringify(data)
  } catch (error) {
    console.error('Error stringifying JSON field:', error)
    return '[]'
  }
}

// Validation arrays
export const VALID_USER_ROLES = Object.values(UserRole)
export const VALID_CONTENT_TYPES = Object.values(ContentType)
export const VALID_CONTENT_SOURCES = Object.values(ContentSource)
export const VALID_DIFFICULTY_LEVELS = Object.values(DifficultyLevel)
export const VALID_CARD_TYPES = Object.values(CardType)
export const VALID_PROGRESS_STATUSES = Object.values(ProgressStatus)
export const VALID_UPLOAD_STATUSES = Object.values(UploadStatus)
export const VALID_MESSAGE_ROLES = Object.values(MessageRole)