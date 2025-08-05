'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import ChapterNavigation from '@/components/learning/ChapterNavigation'
import CardViewer from '@/components/cards/CardViewer'
import { progressAPI, libraryAPI } from '@/lib/api'
import toast from 'react-hot-toast'
import { ArrowLeft, BookOpen } from 'lucide-react'

export default function LearnPage() {
  const { user, hasHydrated } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const contentId = params.contentId as string

  const [showChapters, setShowChapters] = useState(true)
  const [currentChapterId, setCurrentChapterId] = useState<string>('')
  const [cards, setCards] = useState<any[]>([])
  const [currentSession, setCurrentSession] = useState<any>(null)
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Don't redirect until Zustand has hydrated from localStorage
    if (!hasHydrated) {
      return
    }
    
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    loadContentData()
  }, [user, contentId, router, hasHydrated])

  const loadContentData = async () => {
    try {
      setLoading(true)
      
      // Load content details
      const contentResponse = await libraryAPI.getContentById(contentId)
      if (contentResponse.data?.success) {
        setContent(contentResponse.data.data)
      }
      
    } catch (error) {
      console.error('Failed to load content:', error)
      toast.error('Failed to load content')
      router.push('/library')
    } finally {
      setLoading(false)
    }
  }

  const handleChapterSelect = async (chapterId: string) => {
    try {
      setCurrentChapterId(chapterId)
      setLoading(true)
      
      // Get cards for this chapter
      const sessionResponse = await progressAPI.getSession({ 
        contentId, 
        limit: 20 
      })
      
      if (sessionResponse.data?.success) {
        // Filter cards by chapter if we have chapter info
        const sessionCards = sessionResponse.data.data.cards || []
        setCards(sessionCards)
        setCurrentSession(sessionResponse.data.data)
        setShowChapters(false)
      }
      
    } catch (error) {
      console.error('Failed to load chapter cards:', error)
      toast.error('Failed to load chapter content')
    } finally {
      setLoading(false)
    }
  }

  const handleCardAction = async (cardId: string, action: 'known' | 'unknown' | 'skip') => {
    try {
      console.log(`🎯 Recording card action: ${cardId} -> ${action}`)
      
      // Record the card action and wait for it to complete
      const response = await progressAPI.recordCardAction({
        cardId,
        action,
        sessionId: currentSession?.sessionId
      })
      
      if (response.data?.success) {
        // Show XP gain feedback
        if (response.data.data.xpGained > 0) {
          toast.success(`+${response.data.data.xpGained} XP!`)
        }
        console.log(`✅ Card action recorded successfully`)
      }
      
    } catch (error) {
      console.error('Failed to record card action:', error)
      toast.error('Failed to save progress')
    }
  }

  const handleSessionComplete = async () => {
    // Immediately show loading to prevent "completed" message
    setLoading(true)
    
    try {
      // Check if there are more cards in the current chapter progression
      const sessionResponse = await progressAPI.getSession({ 
        contentId, 
        limit: 20 
      })
      
      if (sessionResponse.data?.success) {
        const nextCards = sessionResponse.data.data.cards || []
        
        if (nextCards.length > 0) {
          // More cards available in the progression, continue with next card type
          setCards(nextCards)
          setCurrentSession(sessionResponse.data.data)
          
          // Show progress toast based on current phase
          const phase = sessionResponse.data.data.progression?.currentPhase
          if (phase) {
            toast.success(`Moving to ${phase}! 🎯`)
          }
        } else {
          // No more cards, chapter/content complete
          toast.success('Chapter complete! 🎉')
          setShowChapters(true)
          setCards([])
          setCurrentChapterId('')
        }
      } else {
        // Fallback: go back to chapters
        toast.success('Section complete! 🎉')
        setShowChapters(true)
        setCards([])
        setCurrentChapterId('')
      }
      
    } catch (error) {
      console.error('Failed to load next cards:', error)
      // Fallback: go back to chapters
      toast.success('Section complete! 🎉')
      setShowChapters(true)
      setCards([])
      setCurrentChapterId('')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToChapters = () => {
    setShowChapters(true)
    setCards([])
    setCurrentChapterId('')
  }

  const handleBackToLibrary = () => {
    router.push('/library/my-library')
  }

  if (loading && !content) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={showChapters ? handleBackToLibrary : handleBackToChapters}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {content?.title || 'Learning'}
              </h1>
              {content?.author && (
                <p className="text-gray-600">by {content.author}</p>
              )}
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <BookOpen className="w-4 h-4" />
            <span>My Library</span>
            <span>/</span>
            <span>{content?.title}</span>
            {!showChapters && (
              <>
                <span>/</span>
                <span>Learning Session</span>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        {showChapters ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <ChapterNavigation
              contentId={contentId}
              onChapterSelect={handleChapterSelect}
              currentChapterId={currentChapterId}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : cards.length > 0 ? (
              <CardViewer
                cards={cards}
                onCardAction={handleCardAction}
                onComplete={handleSessionComplete}
              />
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No cards available
                </h3>
                <p className="text-gray-600 mb-6">
                  There are no cards available for this chapter at the moment.
                </p>
                <button
                  onClick={handleBackToChapters}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Chapters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}