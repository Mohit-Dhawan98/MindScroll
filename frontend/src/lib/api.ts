import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        console.warn('🚨 401 Unauthorized received from:', error.config?.url, error.response?.data)
        console.warn('🚨 Current token exists:', !!useAuthStore.getState().token)
        console.warn('🚨 Triggering logout and redirect...')
        
        // Clear auth state using Zustand
        useAuthStore.getState().logout()
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth API calls
export const authAPI = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  getMe: () => api.get('/auth/me'),
  
  updateProfile: (data: any) => api.put('/auth/profile', data),
}

// Content API calls
export const contentAPI = {
  getContent: (params?: any) => api.get('/content', { params }),
  
  getFeed: (params?: any) => api.get('/content/feed', { params }),
  
  getContentById: (id: string) => api.get(`/content/${id}`),
  
  getCards: (contentId: string) => api.get(`/content/${contentId}/cards`),
  
  updateProgress: (data: { cardId: string; status: string; score?: number }) =>
    api.post('/content/progress', data),
  
  searchContent: (query: string) => api.get('/content/search', { params: { q: query } }),
}

// AI API calls
export const aiAPI = {
  chat: (data: { message: string; conversationId?: string }) =>
    api.post('/ai/chat', data),
  
  startConversation: (title?: string) =>
    api.post('/ai/conversation', { title }),
  
  getConversations: (params?: any) =>
    api.get('/ai/conversations', { params }),
  
  generateContent: (data: { text: string; type: string; difficulty?: string }) =>
    api.post('/ai/generate-content', data),
  
  generateQuiz: (data: { contentId: string; numQuestions?: number; difficulty?: string }) =>
    api.post('/ai/generate-quiz', data),
}

// Upload API calls
export const uploadAPI = {
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  
  uploadUrl: (data: { url: string; title?: string }) =>
    api.post('/upload/url', data),
  
  getUploadStatus: (id: string) => api.get(`/upload/${id}/status`),
  
  getUserUploads: (params?: any) => api.get('/upload/my-uploads', { params }),
  
  processUpload: (id: string, options: any) =>
    api.post(`/upload/${id}/process`, options),
}

// User API calls
export const userAPI = {
  getStats: () => api.get('/users/stats'),
  
  getProgress: (params?: any) => api.get('/users/progress', { params }),
  
  getLeaderboard: (params?: any) => api.get('/users/leaderboard', { params }),
  
  updateXP: (amount: number) => api.post('/users/xp', { amount }),
}

// Progress API calls (NEW)
export const progressAPI = {
  recordCardAction: (data: { cardId: string; action: 'known' | 'unknown' | 'skip'; sessionId?: string }) =>
    api.post('/progress/card-action', data),
  
  getSession: (params?: { contentId?: string; limit?: number }) =>
    api.get('/progress/session', { params }),
  
  getStats: () => api.get('/progress/stats'),
  
  // Chapter progress endpoints
  getChapterProgress: (contentId: string) =>
    api.get(`/progress/chapters/${contentId}`),
  
  updateChapterProgress: (data: { chapterId: string; cardType: string; action: string }) =>
    api.post('/progress/chapter', data),
  
  // Learning path with smart recommendations
  getLearningPath: (contentId: string) =>
    api.get(`/progress/learning-path/${contentId}`),
}

// Library API calls (NEW)
export const libraryAPI = {
  getContent: (params?: { category?: string; difficulty?: string; limit?: number; offset?: number }) =>
    api.get('/library/content', { params }),
  
  getContentById: (id: string) => api.get(`/library/content/${id}`),
  
  getCategories: () => api.get('/library/categories'),
  
  getStats: () => api.get('/library/stats'),
  
  // Enrollment endpoints
  enrollInBook: (contentId: string) => api.post(`/library/enroll/${contentId}`),
  
  unenrollFromBook: (contentId: string) => api.delete(`/library/enroll/${contentId}`),
  
  getMyLibrary: (params?: { limit?: number; offset?: number }) =>
    api.get('/library/my-library', { params }),
}