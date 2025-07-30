'use client'

import { useState, useRef, useEffect } from 'react'
import { aiAPI } from '@/lib/api'
import toast from 'react-hot-toast'
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  BookOpen,
  Brain,
  Lightbulb,
  X,
  Minimize2
} from 'lucide-react'

interface Message {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
  type?: 'text' | 'card_suggestion' | 'quiz'
}

interface AITutorProps {
  isMinimized?: boolean
  onToggleMinimize?: () => void
  onClose?: () => void
  className?: string
}

export default function AITutor({ 
  isMinimized = false, 
  onToggleMinimize, 
  onClose,
  className = ""
}: AITutorProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hi! I'm your AI tutor. I can help you understand concepts, create learning cards, quiz you on topics, or answer any questions you have. What would you like to learn about today?",
      sender: 'ai',
      timestamp: new Date(),
      type: 'text'
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue('')
    setIsTyping(true)

    try {
      // Call the actual AI API
      const response = await aiAPI.chat({
        message: currentInput
      })

      if (response.data.success) {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: response.data.data.response,
          sender: 'ai',
          timestamp: new Date(),
          type: 'text'
        }
        setMessages(prev => [...prev, aiResponse])
      } else {
        throw new Error('AI response failed')
      }
    } catch (error) {
      console.error('AI chat error:', error)
      
      // Fallback to mock response if API fails
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment!",
        sender: 'ai',
        timestamp: new Date(),
        type: 'text'
      }
      setMessages(prev => [...prev, aiResponse])
      
      toast.error('Failed to connect to AI tutor')
    } finally {
      setIsTyping(false)
    }
  }

  const generateAIResponse = (userInput: string): string => {
    // This is a mock response generator. Replace with actual AI API call
    const input = userInput.toLowerCase()
    
    if (input.includes('machine learning') || input.includes('ml')) {
      return "Machine Learning is fascinating! It's essentially teaching computers to learn patterns from data without being explicitly programmed for every scenario. Would you like me to create some learning cards about ML fundamentals, or do you have specific questions about algorithms, neural networks, or applications?"
    }
    
    if (input.includes('javascript') || input.includes('js')) {
      return "JavaScript is a versatile programming language! It's the backbone of web development. Are you interested in learning about variables, functions, promises, or perhaps more advanced concepts like closures and async programming? I can create targeted learning cards for any of these topics."
    }
    
    if (input.includes('explain') || input.includes('what is')) {
      return "Great question! I'd be happy to break that down for you. Let me provide a clear explanation and then I can create some learning cards to help you remember the key concepts. Would you also like me to quiz you on this topic later?"
    }
    
    return "That's an interesting topic! I can help you understand it better. Would you like me to:\n\n1. Provide a detailed explanation\n2. Create learning cards about this topic\n3. Give you a quick quiz to test your understanding\n4. Suggest related concepts to explore\n\nWhat would be most helpful?"
  }

  const quickActions = [
    { icon: BookOpen, label: 'Create Cards', action: () => setInputValue('Create learning cards about ') },
    { icon: Brain, label: 'Quiz Me', action: () => setInputValue('Quiz me on ') },
    { icon: Lightbulb, label: 'Explain', action: () => setInputValue('Explain ') },
  ]

  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={onToggleMinimize}
          className="w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all duration-300 group"
        >
          <Bot className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className={`fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Tutor</h3>
            <p className="text-xs text-blue-100">Always here to help</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <Minimize2 className="w-4 h-4 text-white" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-2 max-w-[80%] ${
              message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.sender === 'user' 
                  ? 'bg-blue-600' 
                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
              }`}>
                {message.sender === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              
              <div className={`rounded-2xl px-4 py-2 ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <div className="flex space-x-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
              >
                <action.icon className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>
    </div>
  )
}