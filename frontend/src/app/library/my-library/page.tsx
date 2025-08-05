'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { libraryAPI } from '@/lib/api'
import toast from 'react-hot-toast'
import { 
  BookOpen, 
  Brain, 
  Briefcase,
  ArrowLeft,
  Play,
  CheckCircle,
  Clock,
  TrendingUp,
  MoreVertical,
  Trash2,
  ChevronRight
} from 'lucide-react'

export default function MyLibraryPage() {
  const { user, hasHydrated } = useAuthStore()
  const router = useRouter()
  const [enrolledContent, setEnrolledContent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unenrolling, setUnenrolling] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 12,
    offset: 0,
    hasMore: false
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
    
    loadMyLibrary()
  }, [user, router, hasHydrated])

  const loadMyLibrary = async (offset = 0) => {
    try {
      setLoading(true)
      
      const response = await libraryAPI.getMyLibrary({
        limit: pagination.limit,
        offset
      })
      
      if (response.data.success) {
        setEnrolledContent(response.data.data.content)
        setPagination(response.data.data.pagination)
      }
      
    } catch (error) {
      console.error('Failed to load my library:', error)
      toast.error('Failed to load your library')
    } finally {
      setLoading(false)
    }
  }

  const handleUnenroll = async (contentId: string, title: string) => {
    if (!confirm(`Are you sure you want to unenroll from "${title}"? This will remove all your progress.`)) {
      return
    }

    try {
      setUnenrolling(contentId)
      
      const response = await libraryAPI.unenrollFromBook(contentId)
      
      if (response.data.success) {
        toast.success(`Unenrolled from "${title}"`)
        // Remove from local state
        setEnrolledContent(prev => prev.filter(content => content.id !== contentId))
      }
      
    } catch (error) {
      console.error('Failed to unenroll:', error)
      toast.error('Failed to unenroll from this content')
    } finally {
      setUnenrolling(null)
    }
  }

  const startLearning = (contentId: string) => {
    // Navigate to the new chapter-based learning page
    router.push(`/library/learn/${contentId}`)
  }

  const getProgressColor = (completedCards: number, totalCards: number) => {
    const percentage = totalCards > 0 ? (completedCards / totalCards) * 100 : 0
    if (percentage >= 80) return 'text-green-600 bg-green-100'
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-100'
    if (percentage >= 20) return 'text-blue-600 bg-blue-100'
    return 'text-gray-600 bg-gray-100'
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800'
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800'
      case 'advanced':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'technology':
        return <Brain className="w-5 h-5 text-blue-600" />
      case 'business':
        return <Briefcase className="w-5 h-5 text-green-600" />
      default:
        return <BookOpen className="w-5 h-5 text-purple-600" />
    }
  }

  if (!hasHydrated || (!user && hasHydrated)) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/library')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Library</span>
              </button>
              <div className="w-px h-6 bg-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900">My Enrolled Library</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : enrolledContent.length > 0 ? (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Enrolled Books</p>
                    <p className="text-2xl font-bold text-gray-900">{enrolledContent.length}</p>
                  </div>
                  <BookOpen className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Cards</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {enrolledContent.reduce((sum, content) => sum + (content.totalCards || 0), 0)}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed Cards</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {enrolledContent.reduce((sum, content) => sum + (content.completedCards || 0), 0)}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-purple-500" />
                </div>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledContent.map((content) => {
                const progressPercentage = content.totalCards > 0 
                  ? Math.round((content.completedCards / content.totalCards) * 100) 
                  : 0

                return (
                  <div
                    key={content.id}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          {getCategoryIcon(content.category)}
                          <span className="text-sm font-medium text-gray-600 capitalize">
                            {content.category}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(content.difficulty)}`}>
                            {content.difficulty}
                          </span>
                          
                          <div className="relative">
                            <button className="p-1 text-gray-400 hover:text-gray-600">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {/* Dropdown menu could be added here */}
                          </div>
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {content.title}
                      </h3>
                      
                      {content.author && (
                        <p className="text-sm text-gray-600 mb-3">by {content.author}</p>
                      )}
                      
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">{progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{content.completedCards} completed</span>
                          <span>{content.totalCards} total</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{content.estimatedTime || 0} min</span>
                        </div>
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getProgressColor(content.completedCards, content.totalCards)}`}>
                          <TrendingUp className="w-3 h-3" />
                          <span>{content.inProgressCards} in progress</span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startLearning(content.id)}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          <span>Continue</span>
                        </button>
                        
                        <button
                          onClick={() => handleUnenroll(content.id, content.title)}
                          disabled={unenrolling === content.id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Unenroll"
                        >
                          {unenrolling === content.id ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {pagination.hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => loadMyLibrary(pagination.offset + pagination.limit)}
                  className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span>Load More</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center p-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No enrolled books yet</h3>
            <p className="text-gray-600 mb-6">
              Browse the global library and enroll in books to start learning!
            </p>
            <button
              onClick={() => router.push('/library')}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <BookOpen className="w-4 h-4" />
              <span>Browse Library</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}