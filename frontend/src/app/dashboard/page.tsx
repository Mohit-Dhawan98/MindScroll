'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import CardViewer from '@/components/cards/CardViewer'
import AITutor from '@/components/chat/AITutor'
import UploadModal from '@/components/upload/UploadModal'
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
  Briefcase,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2
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
  const { user, logout, hasHydrated, token } = useAuthStore()
  const router = useRouter()
  const [showCards, setShowCards] = useState(false)
  const [cards, setCards] = useState<any[]>([])
  const [currentSession, setCurrentSession] = useState<any>(null)
  const [availableContent, setAvailableContent] = useState<any[]>([])
  const [enrolledContent, setEnrolledContent] = useState<any[]>([])
  const [showAITutor, setShowAITutor] = useState(false)
  const [isAITutorMinimized, setIsAITutorMinimized] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
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
    // Don't redirect until Zustand has hydrated from localStorage
    if (!hasHydrated) {
      return
    }
    
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    loadDashboardData()
  }, [user, router, hasHydrated])


  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // 🚀 Parallel API calls for faster loading
      const [statsResponse, enrolledResponse, contentResponse] = await Promise.allSettled([
        progressAPI.getStats(),
        libraryAPI.getMyLibrary({ limit: 5 }),
        libraryAPI.getContent({ limit: 5, excludeEnrolled: 'true' })
      ])
      
      // Handle each response independently
      if (statsResponse.status === 'fulfilled' && statsResponse.value.data?.success) {
        setUserStats(statsResponse.value.data.data)
      }
      
      if (enrolledResponse.status === 'fulfilled' && enrolledResponse.value.data?.success) {
        console.log('📚 Dashboard: Setting enrolled content:', enrolledResponse.value.data.data.content)
        setEnrolledContent(enrolledResponse.value.data.data.content)
      }
      
      if (contentResponse.status === 'fulfilled' && contentResponse.value.data?.success) {
        setAvailableContent(contentResponse.value.data.data.content)
      }
      
      // Log any failures without blocking the UI
      if (statsResponse.status === 'rejected') {
        console.warn('Stats API failed:', statsResponse.reason)
      }
      if (enrolledResponse.status === 'rejected') {
        console.warn('Enrolled content API failed:', enrolledResponse.reason)
      }
      if (contentResponse.status === 'rejected') {
        console.warn('Available content API failed:', contentResponse.reason)
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
      
      if (response.data?.success) {
        // Update user stats with new XP
        setUserStats(prev => ({
          ...prev,
          xp: prev.xp + (response.data.data.xpGained || 0),
          completedCards: action === 'known' ? prev.completedCards + 1 : prev.completedCards
        }))
        
        // Show XP gain feedback
        if (response.data.data.xpGained > 0) {
          toast.success(`+${response.data.data.xpGained} XP!`)
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
      
      if (sessionResponse.data?.success && sessionResponse.data.data.cards.length > 0) {
        setCards(sessionResponse.data.data.cards)
        setCurrentSession(sessionResponse.data.data)
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

  // 🚀 Memoize expensive book categorization computations (reduces re-renders)
  const { inProgressBooks, completedBooks } = useMemo(() => {
    const inProgress = enrolledContent.filter(content => {
      const progressPercentage = content.totalCards > 0 
        ? Math.round((content.completedCards / content.totalCards) * 100) 
        : 0
      return progressPercentage < 100
    })
    
    const completed = enrolledContent.filter(content => {
      const progressPercentage = content.totalCards > 0 
        ? Math.round((content.completedCards / content.totalCards) * 100) 
        : 0
      return progressPercentage >= 100
    })
    
    return { inProgressBooks: inProgress, completedBooks: completed }
  }, [enrolledContent])

  const handleUploadComplete = async (uploadId: string) => {
    // Simple success message - no polling, no tracking
    toast.success('📚 Upload received! We\'ll notify you when it\'s ready.')
    
    // Close upload modal
    setShowUploadModal(false)
    
    // That's it! Processing happens in background, user will be notified when done
  }

  if (!hasHydrated || (!user && hasHydrated)) {
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
                <button 
                  onClick={() => router.push('/library')}
                  className="flex items-center space-x-3 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors text-left"
                >
                  <BookOpen className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">Browse Library</p>
                    <p className="text-sm text-gray-600">Find new books to study</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => router.push('/library/my-library')}
                  className="flex items-center space-x-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors text-left"
                >
                  <Brain className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">My Library</p>
                    <p className="text-sm text-gray-600">Continue your studies</p>
                  </div>
                </button>
                
                <button 
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center space-x-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors text-left"
                >
                  <Upload className="w-6 h-6 text-orange-600" />
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
                <h2 className="text-lg font-semibold text-gray-900">Continue Learning</h2>
                <button 
                  onClick={() => router.push('/library')}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Browse Library</span>
                </button>
              </div>
              
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : enrolledContent.length > 0 ? (
                  <>
                    {/* In Progress Books */}
                    {inProgressBooks.length > 0 && (
                            <div className="mb-6">
                              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                                <Brain className="w-4 h-4 mr-2 text-blue-600" />
                                Continue Learning
                              </h3>
                              <div className="space-y-3">
                                {inProgressBooks.map((content) => {
                                  const progressPercentage = content.totalCards > 0 
                                    ? Math.round((content.completedCards / content.totalCards) * 100) 
                                    : 0
                                  
                                  return (
                                    <div 
                                      key={content.id}
                                      className="flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-xl cursor-pointer transition-colors border border-blue-200"
                                      onClick={() => router.push(`/library/learn/${content.id}`)}
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
                                        <div className="flex-1">
                                          <h3 className="font-medium text-gray-900">{content.title}</h3>
                                          <p className="text-sm text-gray-600">
                                            {content.completedCards}/{content.totalCards} cards • {content.difficulty}
                                          </p>
                                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                            <div 
                                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                              style={{ width: `${progressPercentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-medium text-gray-900">Continue</p>
                                        <p className="text-xs text-gray-500">{progressPercentage}% complete</p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Completed Books */}
                          {completedBooks.length > 0 && (
                            <div className="mb-6">
                              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                Completed Books
                              </h3>
                              <div className="space-y-3">
                                {completedBooks.map((content) => {
                                  const progressPercentage = content.totalCards > 0 
                                    ? Math.round((content.completedCards / content.totalCards) * 100) 
                                    : 0
                                  
                                  return (
                                    <div 
                                      key={content.id}
                                      className="flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 rounded-xl cursor-pointer transition-colors border border-green-200"
                                      onClick={() => router.push(`/library/learn/${content.id}`)}
                                    >
                                      <div className="flex items-center space-x-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-green-100`}>
                                          <CheckCircle className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                          <h3 className="font-medium text-gray-900">{content.title}</h3>
                                          <p className="text-sm text-gray-600">
                                            {content.completedCards}/{content.totalCards} cards • {content.difficulty}
                                          </p>
                                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                            <div 
                                              className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                                              style={{ width: `${progressPercentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-medium text-green-900">✓ Complete</p>
                                        <p className="text-xs text-green-600">{progressPercentage}% complete</p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                    
                    {/* Available Content - Secondary */}
                    {availableContent.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                          <BookOpen className="w-4 h-4 mr-2 text-green-600" />
                          Discover New Books
                        </h3>
                        <div className="space-y-3">
                          {availableContent.slice(0, 3).map((content) => (
                            <div 
                              key={content.id}
                              className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
                              onClick={() => router.push('/library')}
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
                                    {content._count?.cards || content.totalCards || 0} cards • {content.difficulty}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">View in Library</p>
                                <p className="text-xs text-gray-500">by {content.author}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : availableContent.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <BookOpen className="w-4 h-4 mr-2 text-green-600" />
                      Available Books
                    </h3>
                    {availableContent.map((content) => (
                      <div 
                        key={content.id}
                        className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
                        onClick={() => router.push('/library')}
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
                              {content._count?.cards || content.totalCards || 0} cards • {content.difficulty}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">Browse Library</p>
                          <p className="text-xs text-gray-500">by {content.author}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">No content available</p>
                    <p className="text-sm mb-4">Browse the library to find books and start learning!</p>
                    <button
                      onClick={() => router.push('/library')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Browse Library
                    </button>
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

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}