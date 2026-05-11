'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { libraryAPI } from '@/lib/api'
import UploadModal from '@/components/upload/UploadModal'
import toast from 'react-hot-toast'
import { 
  BookOpen, 
  Brain, 
  Briefcase,
  Search,
  Filter,
  Clock,
  Star,
  Users,
  ArrowLeft,
  ChevronRight,
  Plus,
  Upload,
  Globe,
  Lock,
  CheckCircle
} from 'lucide-react'

type TabType = 'discover' | 'my-uploads' | 'my-learning'

export default function LibraryPage() {
  const { user, hasHydrated } = useAuthStore()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('discover')
  const [content, setContent] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 12,
    offset: 0,
    hasMore: false
  })

  useEffect(() => {
    if (!hasHydrated) return
    
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    loadTabData()
    loadCategories()
  }, [user, router, selectedCategory, selectedDifficulty, hasHydrated, activeTab])

  const loadTabData = async (offset = 0) => {
    try {
      setLoading(true)
      
      const params: any = {
        limit: pagination.limit,
        offset,
      }
      
      if (selectedCategory) params.category = selectedCategory
      if (selectedDifficulty) params.difficulty = selectedDifficulty
      
      let response
      
      switch (activeTab) {
        case 'discover':
          params.excludeEnrolled = 'true'
          response = await libraryAPI.getContent(params)
          break
        case 'my-uploads':
          response = await libraryAPI.getMyUploads(params)
          break
        case 'my-learning':
          response = await libraryAPI.getMyLibrary(params)
          break
        default:
          response = await libraryAPI.getContent(params)
      }
      
      console.log(`📚 ${activeTab} tab response:`, response)
      
      if (response.data.success) {
        setContent(response.data.data.content || [])
        setPagination(response.data.data.pagination || {
          total: 0,
          limit: 12,
          offset: 0,
          hasMore: false
        })
      }
      
    } catch (error) {
      console.error(`Failed to load ${activeTab} content:`, error)
      if (activeTab === 'my-uploads') {
        // If my-uploads fails, it might not be implemented yet
        setContent([])
        setPagination({ total: 0, limit: 12, offset: 0, hasMore: false })
      } else {
        toast.error(`Failed to load content`)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await libraryAPI.getCategories()
      if (response.data.success) {
        setCategories(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const handleEnroll = async (contentId: string, title: string) => {
    try {
      setEnrolling(contentId)
      await libraryAPI.enrollInBook(contentId)
      toast.success(`Successfully enrolled in "${title}"`)
      loadTabData(pagination.offset)
    } catch (error) {
      console.error('Failed to enroll:', error)
      toast.error('Failed to enroll in book')
    } finally {
      setEnrolling(null)
    }
  }

  const handleUnenroll = async (contentId: string, title: string) => {
    try {
      setEnrolling(contentId)
      await libraryAPI.unenrollFromBook(contentId)
      toast.success(`Successfully unenrolled from "${title}"`)
      loadTabData(pagination.offset)
    } catch (error) {
      console.error('Failed to unenroll:', error)
      toast.error('Failed to unenroll from book')
    } finally {
      setEnrolling(null)
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-600 bg-green-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'hard': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'technology': return '💻'
      case 'business': return '💼'
      case 'science': return '🔬'
      case 'health': return '🏥'
      case 'personal-development': return '🌟'
      default: return '📚'
    }
  }

  const getStatusBadge = (item: any) => {
    if (activeTab === 'my-uploads') {
      if (item.approvedForGlobal) {
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Public
          </span>
        )
      } else {
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Lock className="w-3 h-3 mr-1" />
            Private
          </span>
        )
      }
    }
    return null
  }

  const getProgressBar = (item: any) => {
    if (activeTab === 'my-learning' && item.totalCards > 0) {
      const progress = Math.round(((item.completedCards || 0) / item.totalCards) * 100)
      return (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>{item.completedCards || 0}/{item.totalCards} cards</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )
    }
    return null
  }

  const handleUploadComplete = async (uploadId: string) => {
    // Simple success message - no polling, no tracking
    toast.success('📚 Upload received! We\'ll notify you when it\'s ready.')
    
    // Close upload modal
    setShowUploadModal(false)
    
    // Reload the My Uploads tab if we're on it
    if (activeTab === 'my-uploads') {
      loadTabData()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold">Content Library</h1>
            </div>

            {activeTab === 'my-uploads' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Content
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 border-t">
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'discover'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Globe className="h-4 w-4 mr-2" />
              Discover
            </button>
            <button
              onClick={() => setActiveTab('my-uploads')}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'my-uploads'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Upload className="h-4 w-4 mr-2" />
              My Uploads
            </button>
            <button
              onClick={() => setActiveTab('my-learning')}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'my-learning'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              My Learning
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.name} value={cat.name}>
                {cat.name} ({cat.count})
              </option>
            ))}
          </select>

          {/* Difficulty Filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>

        {/* Stats for My Uploads */}
        {activeTab === 'my-uploads' && content.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-800">
                You've uploaded <span className="font-semibold">{pagination.total}</span> book{pagination.total !== 1 ? 's' : ''}
              </div>
              <div className="flex space-x-4 text-sm">
                <span className="text-green-700">
                  ✅ {content.filter(c => c.approvedForGlobal).length} Public
                </span>
                <span className="text-yellow-700">
                  🔒 {content.filter(c => !c.approvedForGlobal).length} Private
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Content Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : content.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              {activeTab === 'my-uploads' ? (
                <Upload className="h-8 w-8 text-gray-400" />
              ) : (
                <BookOpen className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'my-uploads' 
                ? "No uploads yet" 
                : activeTab === 'my-learning'
                ? "No books in your learning library"
                : "No content available"}
            </h3>
            <p className="text-gray-500 mb-4">
              {activeTab === 'my-uploads'
                ? "Upload your first PDF to start building your personal library"
                : activeTab === 'my-learning'
                ? "Enroll in books from the Discover tab to start learning"
                : "Check back later for new content"}
            </p>
            {activeTab === 'my-uploads' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Your First Book
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {content.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/learn/${item.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{getCategoryIcon(item.category)}</span>
                    {getStatusBadge(item)}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {item.title}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    by {item.author || 'Unknown Author'}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatTime(item.estimatedTime)}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(item.difficulty)}`}>
                      {item.difficulty}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {item._count?.cards || item.totalCards || 0} cards
                    </span>
                    {activeTab === 'discover' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEnroll(item.id, item.title)
                        }}
                        disabled={enrolling === item.id}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {enrolling === item.id ? 'Enrolling...' : 'Enroll'}
                      </button>
                    )}
                    {activeTab === 'my-learning' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnenroll(item.id, item.title)
                        }}
                        disabled={enrolling === item.id}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        {enrolling === item.id ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>

                  {getProgressBar(item)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.hasMore && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => loadTabData(pagination.offset + pagination.limit)}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Load More
              <ChevronRight className="h-4 w-4 ml-2" />
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}