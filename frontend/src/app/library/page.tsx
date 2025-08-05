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
  Search,
  Filter,
  Clock,
  Star,
  Users,
  ArrowLeft,
  ChevronRight,
  Plus
} from 'lucide-react'

export default function LibraryPage() {
  const { user, hasHydrated } = useAuthStore()
  const router = useRouter()
  const [content, setContent] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
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
    
    loadLibraryData()
    loadCategories()
  }, [user, router, selectedCategory, selectedDifficulty, hasHydrated])

  const loadLibraryData = async (offset = 0) => {
    try {
      setLoading(true)
      
      const params: any = {
        limit: pagination.limit,
        offset,
        excludeEnrolled: 'true' // Global Library should exclude enrolled books
      }
      
      if (selectedCategory) params.category = selectedCategory
      if (selectedDifficulty) params.difficulty = selectedDifficulty
      
      const response = await libraryAPI.getContent(params)
      
      console.log('📚 Frontend: Library API Response:', response)
      console.log('📚 Frontend: Response success:', response.data.success)
      console.log('📚 Frontend: Response data:', response.data)
      console.log('📚 Frontend: Content array:', response.data?.data?.content)
      
      if (response.data.success) {
        console.log('📚 Frontend: Setting content with', response.data.data.content.length, 'items')
        setContent(response.data.data.content)
        setPagination(response.data.data.pagination)
      } else {
        console.error('📚 Frontend: API returned success=false')
      }
      
    } catch (error) {
      console.error('Failed to load library content:', error)
      toast.error('Failed to load library content')
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
      
      const response = await libraryAPI.enrollInBook(contentId)
      
      if (response.data.success) {
        toast.success(`Successfully enrolled in "${title}"!`)
        // Reload the content to update enrollment status
        loadLibraryData()
      }
      
    } catch (error: any) {
      console.error('Failed to enroll:', error)
      if (error.response?.data?.error === 'Already enrolled in this content') {
        toast.success('You are already enrolled in this content!')
        // Reload content to show correct enrollment status
        loadLibraryData()
      } else {
        toast.error('Failed to enroll in this content')
      }
    } finally {
      setEnrolling(null)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
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
    switch (category.toLowerCase()) {
      case 'technology':
        return <Brain className="w-5 h-5 text-blue-600" />
      case 'business':
        return <Briefcase className="w-5 h-5 text-green-600" />
      default:
        return <BookOpen className="w-5 h-5 text-purple-600" />
    }
  }

  const filteredContent = content.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.author?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </button>
              <div className="w-px h-6 bg-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900">Global Library</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/library/my-library')}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>My Library</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search books, authors, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex space-x-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </select>
              
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Levels</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredContent.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredContent.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(item.category)}
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {item.category}
                      </span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(item.difficulty)}`}>
                      {item.difficulty}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {item.title}
                  </h3>
                  
                  {item.author && (
                    <p className="text-sm text-gray-600 mb-2">by {item.author}</p>
                  )}
                  
                  {item.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {item.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center space-x-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{item._count?.cards || item.totalCards || 0} cards</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{item.estimatedTime || 0} min</span>
                    </div>
                  </div>
                  
                  {item.isEnrolled ? (
                    <button
                      onClick={() => router.push('/library/my-library')}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Enrolled</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnroll(item.id, item.title)}
                      disabled={enrolling === item.id}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {enrolling === item.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Enroll</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
            <p className="text-gray-600">
              {searchQuery || selectedCategory || selectedDifficulty
                ? 'Try adjusting your search or filters'
                : 'The library is empty. Add some books to get started!'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.hasMore && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => loadLibraryData(pagination.offset + pagination.limit)}
              className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span>Load More</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}