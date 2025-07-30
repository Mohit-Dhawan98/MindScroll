'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import CardViewer from '@/components/cards/CardViewer'
import AITutor from '@/components/chat/AITutor'
import { progressAPI, libraryAPI } from '@/lib/api'
import toast from 'react-hot-toast'
import { 
  BookOpen, 
  Brain, 
  Trophy, 
  Calendar,
  Target,
  TrendingUp,
  MessageCircle,
  Upload,
  Plus,
  Briefcase
} from 'lucide-react'

// Mock data - replace with API calls
const mockCards = [
  {
    id: '1',
    title: 'What is Machine Learning?',
    content: 'Machine Learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms to find patterns in data and make predictions or decisions.',
    difficulty: 'easy' as const,
    category: 'AI/ML',
    isKnown: false
  },
  {
    id: '2',
    title: 'Explain Neural Networks',
    content: 'Neural networks are computing systems inspired by biological neural networks. They consist of layers of interconnected nodes (neurons) that process information using connectionist approaches to computation.',
    difficulty: 'medium' as const,
    category: 'AI/ML',
    isKnown: false
  },
  {
    id: '3',
    title: 'What is Deep Learning?',
    content: 'Deep Learning is a subset of machine learning that uses neural networks with multiple layers (hence "deep") to model and understand complex patterns in data. It\'s particularly effective for tasks like image recognition, natural language processing, and speech recognition.',
    difficulty: 'hard' as const,
    category: 'AI/ML',
    isKnown: false
  }
]

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [showCards, setShowCards] = useState(false)
  const [cards, setCards] = useState<any[]>([])
  const [currentSession, setCurrentSession] = useState<any>(null)
  const [availableContent, setAvailableContent] = useState<any[]>([])
  const [showAITutor, setShowAITutor] = useState(false)
  const [isAITutorMinimized, setIsAITutorMinimized] = useState(true)
  const [loading, setLoading] = useState(true)
  const [userStats, setUserStats] = useState({
    streak: 0,
    level: 1,
    xp: 0,
    completedCards: 0,
    totalCards: 0,
    cardsDueToday: 0,
    accuracy: 0,
    progressPercentage: 0
  })

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    loadDashboardData()
  }, [user, router])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load user progress stats
      const statsResponse = await progressAPI.getStats()
      if (statsResponse.success) {
        setUserStats(statsResponse.data)
      }
      
      // Load available content
      const contentResponse = await libraryAPI.getContent({ limit: 10 })
      if (contentResponse.success) {
        setAvailableContent(contentResponse.data.content)
      }
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleCardAction = async (cardId: string, action: 'known' | 'unknown' | 'skip') => {
    try {
      // Record the card action
      const response = await progressAPI.recordCardAction({
        cardId,
        action,
        sessionId: currentSession?.sessionId
      })
      
      if (response.success) {
        // Update user stats with new XP
        setUserStats(prev => ({
          ...prev,
          xp: prev.xp + (response.data.xpGained || 0),
          completedCards: action === 'known' ? prev.completedCards + 1 : prev.completedCards
        }))
        
        // Show XP gain feedback
        if (response.data.xpGained > 0) {
          toast.success(`+${response.data.xpGained} XP!`)
        }
      }
      
    } catch (error) {
      console.error('Failed to record card action:', error)
      toast.error('Failed to save progress')
    }
  }

  const startLearningSession = async (contentId?: string) => {
    try {
      setLoading(true)
      
      // Get learning session (cards due for review)
      const sessionResponse = await progressAPI.getSession({ 
        contentId, 
        limit: 10 
      })
      
      if (sessionResponse.success && sessionResponse.data.cards.length > 0) {
        setCards(sessionResponse.data.cards)
        setCurrentSession(sessionResponse.data)
        setShowCards(true)
      } else {
        toast.info('No cards available for review right now!')
      }
      
    } catch (error) {
      console.error('Failed to start learning session:', error)
      toast.error('Failed to start learning session')
    } finally {
      setLoading(false)
    }
  }

  const handleCardsComplete = async () => {
    setShowCards(false)
    setCurrentSession(null)
    
    // Reload dashboard stats to reflect completion
    await loadDashboardData()
    
    // Show completion celebration
    toast.success(`🎉 Session completed! Great job!`)
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (showCards) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <div className="mb-6">
            <button
              onClick={() => setShowCards(false)}
              className="text-gray-600 hover:text-gray-900 mb-4"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">AI/ML Fundamentals</h1>
            <p className="text-gray-600">Learn the basics of artificial intelligence and machine learning</p>
          </div>
          
          <CardViewer
            cards={cards}
            onCardAction={handleCardAction}
            onComplete={handleCardsComplete}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-white">M</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">MindScroll</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome back, <span className="font-medium">{user.name || user.email}</span>
              </div>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Streak</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.streak}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Level</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.level}</p>
              </div>
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total XP</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.xp.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cards Completed</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.completedCards}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center space-x-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors text-left">
                  <Upload className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">Upload Content</p>
                    <p className="text-sm text-gray-600">PDF, article, or URL</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => {
                    setShowAITutor(true)
                    setIsAITutorMinimized(false)
                  }}
                  className="flex items-center space-x-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors text-left"
                >
                  <MessageCircle className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="font-medium text-gray-900">AI Tutor</p>
                    <p className="text-sm text-gray-600">Ask questions</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Learning Sets */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Your Learning Sets</h2>
                <button className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Create New</span>
                </button>
              </div>
              
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : availableContent.length > 0 ? (
                  availableContent.map((content) => (
                    <div 
                      key={content.id}
                      className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
                      onClick={() => startLearningSession(content.id)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          content.category === 'technology' ? 'bg-blue-100' :
                          content.category === 'business' ? 'bg-green-100' :
                          content.category === 'science' ? 'bg-purple-100' :
                          content.category === 'personal-development' ? 'bg-orange-100' :
                          'bg-gray-100'
                        }`}>
                          {content.category === 'technology' ? <Brain className="w-6 h-6 text-blue-600" /> :
                           content.category === 'business' ? <Briefcase className="w-6 h-6 text-green-600" /> :
                           content.category === 'science' ? <BookOpen className="w-6 h-6 text-purple-600" /> :
                           <BookOpen className="w-6 h-6 text-gray-600" />}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{content.title}</h3>
                          <p className="text-sm text-gray-600">
                            {content.totalCards} cards • {content.difficulty}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">Start Learning</p>
                        <p className="text-xs text-gray-500">by {content.author}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">No content available</p>
                    <p className="text-sm">Add some books to the library to get started!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Today's Progress</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Cards Due Today</span>
                    <span className="font-medium">{userStats.cardsDueToday} cards</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Overall Progress</span>
                    <span className="font-medium">{userStats.completedCards}/{userStats.totalCards}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${userStats.progressPercentage || 0}%` }}
                    />
                  </div>
                  <div className="text-center text-xs text-gray-500 mt-1">
                    {userStats.progressPercentage || 0}% Complete
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div className="text-sm">
                    <p className="text-gray-900">Completed "React Hooks"</p>
                    <p className="text-gray-500">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="text-sm">
                    <p className="text-gray-900">Started "Python Basics"</p>
                    <p className="text-gray-500">5 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <div className="text-sm">
                    <p className="text-gray-900">Asked AI Tutor about closures</p>
                    <p className="text-gray-500">1 day ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Tutor */}
      {showAITutor && (
        <AITutor
          isMinimized={isAITutorMinimized}
          onToggleMinimize={() => setIsAITutorMinimized(!isAITutorMinimized)}
          onClose={() => setShowAITutor(false)}
        />
      )}
    </div>
  )
}