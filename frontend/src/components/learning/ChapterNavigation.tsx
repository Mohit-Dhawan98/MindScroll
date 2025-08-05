'use client'

import { useState, useEffect } from 'react'
import { progressAPI } from '@/lib/api'
import { 
  ChevronRight, 
  BookOpen, 
  CheckCircle, 
  Circle,
  Zap,
  HelpCircle,
  Lightbulb,
  ArrowLeft
} from 'lucide-react'

interface Chapter {
  id: string
  chapterNumber: number
  chapterTitle: string
  completionPercentage: number
  nextAction: string
  nextCardType: string | null
  isReady: boolean
  cardBreakdown: {
    flashcards: {
      total: number
      completed: number
      completion: number
    }
    quizzes: {
      total: number
      completed: number
      completion: number
    }
    summaries: {
      total: number
      completed: number
      completion: number
    }
  }
  lastAccessed?: string
}

interface ChapterNavigationProps {
  contentId: string
  onChapterSelect: (chapterId: string) => void
  onBack?: () => void
  currentChapterId?: string
}

export default function ChapterNavigation({ 
  contentId, 
  onChapterSelect, 
  onBack,
  currentChapterId 
}: ChapterNavigationProps) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChapterProgress()
  }, [contentId])

  const loadChapterProgress = async () => {
    try {
      setLoading(true)
      const response = await progressAPI.getLearningPath(contentId)
      
      if (response.data?.success) {
        setChapters(response.data.data.chapters)
      }
    } catch (error) {
      console.error('Failed to load chapter progress:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCardTypeIcon = (type: string) => {
    switch (type) {
      case 'flashcards':
        return <BookOpen className="w-4 h-4" />
      case 'quizzes':
        return <HelpCircle className="w-4 h-4" />
      case 'summaries':
        return <Lightbulb className="w-4 h-4" />
      default:
        return <Circle className="w-4 h-4" />
    }
  }

  const getCardTypeColor = (type: string) => {
    switch (type) {
      case 'flashcards':
        return 'text-blue-600 bg-blue-100'
      case 'quizzes':
        return 'text-green-600 bg-green-100'
      case 'summaries':
        return 'text-amber-600 bg-amber-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-900">Learning Progress</h2>
        </div>
      </div>

      {/* Chapters List */}
      <div className="space-y-3">
        {chapters.map((chapter) => (
          <div
            key={chapter.id}
            className={`border-2 rounded-xl p-4 transition-all cursor-pointer hover:shadow-md ${
              currentChapterId === chapter.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => onChapterSelect(chapter.id)}
          >
            {/* Chapter Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  chapter.completionPercentage === 100 
                    ? 'bg-green-500 text-white' 
                    : chapter.isReady
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {chapter.completionPercentage === 100 ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{chapter.chapterNumber}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{chapter.chapterTitle}</h3>
                    {chapter.nextAction !== 'complete' && chapter.nextAction !== 'start' && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        chapter.isReady 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {chapter.isReady ? `Next: ${chapter.nextCardType}` : 'Not Ready'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {chapter.completionPercentage}% complete
                    {chapter.nextAction === 'start' && ' • Ready to start!'}
                    {chapter.nextAction === 'complete' && ' • Complete ✓'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${chapter.completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Card Type Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'flashcards', label: 'Flashcards', data: chapter.cardBreakdown.flashcards },
                { key: 'quizzes', label: 'Quizzes', data: chapter.cardBreakdown.quizzes },
                { key: 'summaries', label: 'Summaries', data: chapter.cardBreakdown.summaries }
              ].map(({ key, label, data }) => (
                <div key={key} className="text-center">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1 relative ${getCardTypeColor(key)}`}>
                    {getCardTypeIcon(key)}
                    {/* Progress indicator */}
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white bg-gray-200">
                      <div 
                        className={`w-full h-full rounded-full ${
                          data.completion === 1 ? 'bg-green-500' :
                          data.completion > 0.5 ? 'bg-yellow-500' :
                          data.completion > 0 ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                        style={{ 
                          transform: `scale(${Math.max(0.3, data.completion)})`,
                          transition: 'transform 0.2s ease'
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {data.completed}/{data.total}
                  </div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Last Accessed */}
            {chapter.lastAccessed && (
              <div className="mt-2 text-xs text-gray-500">
                Last accessed: {new Date(chapter.lastAccessed).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overall Progress Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Overall Progress</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(chapters.reduce((acc, ch) => acc + ch.completionPercentage, 0) / chapters.length)}%
            </div>
            <div className="text-sm text-gray-600">Average Completion</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {chapters.filter(ch => ch.completionPercentage === 100).length}/{chapters.length}
            </div>
            <div className="text-sm text-gray-600">Chapters Complete</div>
          </div>
        </div>
      </div>
    </div>
  )
}