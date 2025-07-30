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
  X
} from 'lucide-react'

interface Card {
  id: string
  title: string
  content: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  isKnown: boolean
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
  const controls = useAnimation()
  const cardRef = useRef<HTMLDivElement>(null)

  const currentCard = cards[currentIndex]

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

  const handleCardAction = (action: 'known' | 'unknown' | 'skip') => {
    if (!currentCard) return

    onCardAction(currentCard.id, action)
    
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setIsFlipped(false)
      controls.set({ x: 0, opacity: 1, rotate: 0 })
    } else {
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
    }).then(() => {
      handleCardAction(action)
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
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
    <div className="relative w-full max-w-md mx-auto">
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
      <div className="relative h-96">
        {/* Next Card (Background) */}
        {currentIndex < cards.length - 1 && (
          <div className="absolute inset-0 bg-white rounded-3xl shadow-lg transform scale-95 opacity-50" />
        )}

        {/* Current Card */}
        <motion.div
          ref={cardRef}
          className="absolute inset-0 bg-white rounded-3xl shadow-xl cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          animate={controls}
          whileDrag={{ scale: 1.05 }}
          style={{ zIndex: 10 }}
        >
          <div 
            className="h-full rounded-3xl overflow-hidden relative"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Card Content */}
            <div className={`h-full p-6 flex flex-col justify-between transition-all duration-300 ${
              isFlipped ? 'opacity-0' : 'opacity-100'
            }`}>
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentCard.difficulty)}`}>
                    {currentCard.difficulty}
                  </span>
                  <span className="text-sm text-gray-500">{currentCard.category}</span>
                </div>
                
                <h2 className="text-xl font-bold text-gray-900 mb-4 leading-tight">
                  {currentCard.title}
                </h2>
              </div>

              {/* Content */}
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">Tap to reveal content</p>
                </div>
              </div>
            </div>

            {/* Flipped Content */}
            <div className={`absolute inset-0 h-full p-6 flex flex-col justify-between transition-all duration-300 ${
              isFlipped ? 'opacity-100' : 'opacity-0'
            }`}>
              <div>
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
                
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-800 leading-relaxed">
                    {currentCard.content}
                  </p>
                </div>
              </div>

              <div className="text-center text-sm text-gray-500 mt-4">
                Swipe or use buttons below
              </div>
            </div>

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

      {/* Action Buttons */}
      <div className="flex justify-center items-center space-x-4 mt-6">
        <button
          onClick={() => handleButtonAction('unknown')}
          className="w-14 h-14 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors"
        >
          <ThumbsDown className="w-6 h-6 text-red-600" />
        </button>
        
        <button
          onClick={() => handleButtonAction('skip')}
          className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
        >
          <RotateCcw className="w-5 h-5 text-gray-600" />
        </button>
        
        <button
          onClick={() => handleButtonAction('known')}
          className="w-14 h-14 bg-green-100 hover:bg-green-200 rounded-full flex items-center justify-center transition-colors"
        >
          <ThumbsUp className="w-6 h-6 text-green-600" />
        </button>
      </div>

      {/* Instructions */}
      <div className="text-center mt-4 text-sm text-gray-500">
        Swipe right if you know it, left if you need to review it
      </div>
    </div>
  )
}