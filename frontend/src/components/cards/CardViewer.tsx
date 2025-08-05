'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, PanInfo, useAnimation } from 'framer-motion'
import { 
  ThumbsUp, 
  ThumbsDown, 
  RotateCcw, 
  BookOpen,
  Brain,
  CheckCircle,
  X,
  Zap,
  HelpCircle,
  Lightbulb,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface Card {
  id: string
  title: string
  content?: string
  type: 'FLASHCARD' | 'QUIZ' | 'SUMMARY'
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  category: string
  isKnown: boolean
  // Flashcard and Summary specific
  front?: string
  back?: string
  // Quiz specific
  quiz?: {
    question: string
    choices: string[]
    correctAnswer: number
    explanation: string
  } | string
}

interface CardViewerProps {
  cards: Card[]
  onCardAction: (cardId: string, action: 'known' | 'unknown' | 'skip') => void
  onComplete?: () => void
}

export default function CardViewer({ cards, onCardAction, onComplete }: CardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null)
  const [showQuizResult, setShowQuizResult] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const controls = useAnimation()
  const cardRef = useRef<HTMLDivElement>(null)

  // Content pagination helper
  const paginateContent = (content: string, wordsPerPage: number = 150) => {
    if (!content) return ['']
    
    const words = content.split(' ')
    const pages = []
    
    for (let i = 0; i < words.length; i += wordsPerPage) {
      const pageWords = words.slice(i, i + wordsPerPage)
      pages.push(pageWords.join(' '))
    }
    
    return pages.length > 0 ? pages : ['']
  }

  // Define helper functions before using them
  const getCardTypeInfo = (type: string) => {
    switch (type) {
      case 'FLASHCARD':
        return {
          icon: BookOpen,
          color: 'from-blue-500 to-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: 'Flashcard'
        }
      case 'SUMMARY':
        return {
          icon: Lightbulb,
          color: 'from-amber-500 to-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          label: 'Summary'
        }
      case 'QUIZ':
        return {
          icon: HelpCircle,
          color: 'from-green-500 to-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: 'Quiz'
        }
      default:
        return {
          icon: BookOpen,
          color: 'from-gray-500 to-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Card'
        }
    }
  }

  const currentCard = cards[currentIndex]
  const cardTypeInfo = currentCard ? getCardTypeInfo(currentCard.type) : null

  // Get paginated content for current card
  const getCardContent = (card: Card | undefined) => {
    if (!card) return { pages: [''], totalPages: 0 }
    
    let content = ''
    if (card.type === 'FLASHCARD') {
      content = card.back || card.content || ''
    } else if (card.type === 'SUMMARY') {
      content = card.back || card.content || ''
    } else {
      content = card.content || ''
    }
    
    const pages = paginateContent(content)
    return { pages, totalPages: pages.length }
  }

  const { pages: contentPages, totalPages } = getCardContent(currentCard)
  const currentPageContent = contentPages[currentPage] || ''

  // Navigation functions
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // Parse quiz data if it's a quiz card
  const quizData = currentCard?.type === 'QUIZ' && currentCard.quiz 
    ? (() => {
        try {
          return typeof currentCard.quiz === 'string' 
            ? JSON.parse(currentCard.quiz)
            : currentCard.quiz
        } catch {
          return null
        }
      })()
    : null

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 150
    const { offset, velocity } = info

    if (Math.abs(offset.x) > threshold || Math.abs(velocity.x) > 500) {
      const action = offset.x > 0 ? 'known' : 'unknown'
      setDirection(offset.x > 0 ? 'right' : 'left')
      
      controls.start({
        x: offset.x > 0 ? 1000 : -1000,
        opacity: 0,
        rotate: offset.x > 0 ? 30 : -30,
        transition: { duration: 0.3 }
      }).then(() => {
        handleCardAction(action)
      })
    } else {
      controls.start({ x: 0, rotate: 0 })
    }
  }

  const handleQuizOption = (optionIndex: number) => {
    if (!quizData || selectedQuizOption !== null) return
    
    setSelectedQuizOption(optionIndex)
    setShowQuizResult(true)
    
    // Auto-advance after showing result
    setTimeout(async () => {
      const isCorrect = optionIndex === quizData.correctAnswer
      await handleCardAction(isCorrect ? 'known' : 'unknown')
    }, 1500)
  }

  const handleCardAction = async (action: 'known' | 'unknown' | 'skip') => {
    if (!currentCard) return

    // Wait for the card action to be recorded before proceeding
    await onCardAction(currentCard.id, action)
    
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setIsFlipped(false)
      setSelectedQuizOption(null)
      setShowQuizResult(false)
      setCurrentPage(0) // Reset pagination for new card
      controls.set({ x: 0, opacity: 1, rotate: 0 })
    } else {
      // Only call onComplete after the card action has been fully processed
      onComplete?.()
    }
  }

  const handleButtonAction = (action: 'known' | 'unknown' | 'skip') => {
    const x = action === 'known' ? 1000 : action === 'unknown' ? -1000 : 0
    const rotate = action === 'known' ? 30 : action === 'unknown' ? -30 : 0

    controls.start({
      x,
      opacity: action === 'skip' ? 1 : 0,
      rotate,
      transition: { duration: 0.3 }
    }).then(async () => {
      await handleCardAction(action)
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toUpperCase()) {
      case 'EASY': return 'bg-green-100 text-green-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'HARD': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-3xl">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Great job!</h3>
          <p className="text-gray-600">You've completed all the cards in this set.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">
            Progress
          </span>
          <span className="text-sm font-medium text-gray-600">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card Stack */}
      <div className="relative h-[450px]">
        {/* Next Card (Background) */}
        {currentIndex < cards.length - 1 && (
          <div className="absolute inset-0 bg-white rounded-3xl shadow-lg transform scale-95 opacity-50" />
        )}

        {/* Current Card */}
        <motion.div
          ref={cardRef}
          className={`absolute inset-0 rounded-3xl shadow-xl cursor-grab active:cursor-grabbing border-2 ${
            cardTypeInfo?.bgColor || 'bg-white'
          } ${cardTypeInfo?.borderColor || 'border-gray-200'}`}
          drag={currentCard?.type === 'QUIZ' ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          animate={controls}
          whileDrag={{ scale: 1.05 }}
          style={{ zIndex: 10 }}
        >
          <div className="h-full rounded-3xl overflow-hidden relative">
            {/* Card Header */}
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {cardTypeInfo && (
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${cardTypeInfo.color}`}>
                      <cardTypeInfo.icon className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {cardTypeInfo?.label || 'Card'}
                  </span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentCard.difficulty)}`}>
                  {currentCard.difficulty?.toUpperCase() || 'MEDIUM'}
                </span>
              </div>
            </div>

            {/* Render based on card type */}
            {currentCard.type === 'FLASHCARD' ? (
              <div 
                className="h-full px-6 pb-6 flex flex-col justify-between cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Flashcard Front */}
                <div className={`flex-1 flex flex-col justify-center transition-all duration-300 ${
                  isFlipped ? 'opacity-0' : 'opacity-100'
                }`}>
                  <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
                    {currentCard.front || currentCard.title}
                  </h2>
                  <div className="text-center">
                    <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Tap to reveal answer</p>
                  </div>
                </div>

                {/* Flashcard Back */}
                <div className={`absolute inset-6 flex flex-col justify-center transition-all duration-300 ${
                  isFlipped ? 'opacity-100' : 'opacity-0'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <Brain className="w-6 h-6 text-purple-600" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsFlipped(false)
                      }}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="prose prose-sm max-w-none flex-1 overflow-y-auto">
                    <p className="text-gray-800 leading-relaxed">
                      {currentPageContent}
                    </p>
                  </div>

                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          goToPrevPage()
                        }}
                        disabled={currentPage === 0}
                        className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <span className="text-sm text-gray-500">
                        {currentPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          goToNextPage()
                        }}
                        disabled={currentPage === totalPages - 1}
                        className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  )}

                  <div className="text-center text-sm text-gray-500 mt-2">
                    {totalPages > 1 ? 'Navigate pages above • Swipe or use buttons below' : 'Swipe or use buttons below'}
                  </div>
                </div>
              </div>
            ) : currentCard.type === 'QUIZ' && quizData ? (
              <div className="h-full px-6 pb-6 flex flex-col">
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-gray-900 mb-3">
                    {quizData.question}
                  </h2>

                  <div className="space-y-2">
                    {quizData.choices?.map((choice: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => handleQuizOption(index)}
                        disabled={selectedQuizOption !== null}
                        className={`w-full p-2 text-left rounded border transition-all duration-200 ${
                          selectedQuizOption === null
                            ? 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-gray-900'
                            : selectedQuizOption === index
                            ? index === quizData.correctAnswer
                              ? 'border-green-500 bg-green-100 text-green-800'
                              : 'border-red-500 bg-red-100 text-red-800'
                            : index === quizData.correctAnswer
                            ? 'border-green-500 bg-green-100 text-green-800'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                            selectedQuizOption === null
                              ? 'bg-blue-100 text-blue-600'
                              : selectedQuizOption === index
                              ? index === quizData.correctAnswer
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                              : index === quizData.correctAnswer
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 text-gray-600'
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 text-xs leading-tight">{choice}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {showQuizResult && quizData.explanation && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs max-h-16 overflow-y-auto">
                      <p className="text-blue-800">
                        <strong>Explanation:</strong> {quizData.explanation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : currentCard.type === 'SUMMARY' ? (
              // SUMMARY cards use flashcard-like structure (front/back)
              <div 
                className="h-full px-6 pb-6 flex flex-col justify-between cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Summary Front */}
                <div className={`flex-1 flex flex-col justify-center transition-all duration-300 ${
                  isFlipped ? 'opacity-0' : 'opacity-100'
                }`}>
                  <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
                    {currentCard.front || currentCard.title}
                  </h2>
                  <div className="text-center">
                    <Lightbulb className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                    <p className="text-gray-600">Tap to view chapter summary</p>
                  </div>
                </div>

                {/* Summary Back */}
                <div className={`absolute inset-6 flex flex-col justify-center transition-all duration-300 ${
                  isFlipped ? 'opacity-100' : 'opacity-0'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <Lightbulb className="w-6 h-6 text-amber-600" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsFlipped(false)
                      }}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="prose prose-sm max-w-none flex-1 overflow-y-auto">
                    <p className="text-gray-800 leading-relaxed">
                      {currentPageContent}
                    </p>
                  </div>

                  {/* Pagination controls for summary cards */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          goToPrevPage()
                        }}
                        disabled={currentPage === 0}
                        className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <span className="text-sm text-gray-500">
                        {currentPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          goToNextPage()
                        }}
                        disabled={currentPage === totalPages - 1}
                        className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  )}

                  <div className="text-center text-sm text-gray-500 mt-2">
                    {totalPages > 1 ? 'Navigate pages above • Swipe or use buttons below' : 'Swipe or use buttons below'}
                  </div>
                </div>
              </div>
            ) : (
              // Fallback for unknown card types
              <div className="h-full px-6 pb-6 flex flex-col justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {currentCard.title}
                  </h2>
                  <p className="text-gray-600">
                    {currentCard.content || 'No content available'}
                  </p>
                </div>
              </div>
            )}

            {/* Drag Indicators */}
            <div className="absolute top-6 left-6 opacity-0 transition-opacity duration-200" id="left-indicator">
              <div className="bg-red-500 text-white px-3 py-2 rounded-full flex items-center space-x-2">
                <ThumbsDown className="w-4 h-4" />
                <span className="text-sm font-medium">Need Review</span>
              </div>
            </div>

            <div className="absolute top-6 right-6 opacity-0 transition-opacity duration-200" id="right-indicator">
              <div className="bg-green-500 text-white px-3 py-2 rounded-full flex items-center space-x-2">
                <ThumbsUp className="w-4 h-4" />
                <span className="text-sm font-medium">Got It!</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action Buttons - Hidden for quiz cards during answering */}
      {!(currentCard?.type === 'QUIZ' && selectedQuizOption === null) && (
        <div className="flex justify-center items-center space-x-4 mt-6">
          <button
            onClick={() => handleButtonAction('unknown')}
            disabled={currentCard?.type === 'QUIZ' && selectedQuizOption !== null}
            className="w-14 h-14 bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
          >
            <ThumbsDown className="w-6 h-6 text-red-600" />
          </button>
          
          <button
            onClick={() => handleButtonAction('skip')}
            disabled={currentCard?.type === 'QUIZ' && selectedQuizOption !== null}
            className="w-12 h-12 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
          >
            <RotateCcw className="w-5 h-5 text-gray-600" />
          </button>
          
          <button
            onClick={() => handleButtonAction('known')}
            disabled={currentCard?.type === 'QUIZ' && selectedQuizOption !== null}
            className="w-14 h-14 bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
          >
            <ThumbsUp className="w-6 h-6 text-green-600" />
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="text-center mt-4 text-sm text-gray-500">
        {currentCard?.type === 'QUIZ' 
          ? selectedQuizOption === null 
            ? "Select your answer" 
            : "Auto-advancing..."
          : "Swipe right if you know it, left if you need to review it"
        }
      </div>
    </div>
  )
}