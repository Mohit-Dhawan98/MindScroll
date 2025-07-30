'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { 
  BookOpen, 
  Brain, 
  Code, 
  Briefcase, 
  Gamepad2, 
  Palette,
  Music,
  Utensils,
  Plane,
  Heart,
  Target,
  CheckCircle,
  ArrowRight
} from 'lucide-react'

const interests = [
  { id: 'technology', name: 'Technology', icon: Code },
  { id: 'business', name: 'Business', icon: Briefcase },
  { id: 'science', name: 'Science', icon: Brain },
  { id: 'arts', name: 'Arts & Design', icon: Palette },
  { id: 'music', name: 'Music', icon: Music },
  { id: 'cooking', name: 'Cooking', icon: Utensils },
  { id: 'travel', name: 'Travel', icon: Plane },
  { id: 'health', name: 'Health & Fitness', icon: Heart },
  { id: 'gaming', name: 'Gaming', icon: Gamepad2 },
  { id: 'literature', name: 'Literature', icon: BookOpen },
]

const dailyGoals = [
  { value: 5, label: '5 cards', description: 'Light learning' },
  { value: 10, label: '10 cards', description: 'Steady progress' },
  { value: 15, label: '15 cards', description: 'Focused growth' },
  { value: 20, label: '20 cards', description: 'Intensive learning' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [step, setStep] = useState(1)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [dailyGoal, setDailyGoal] = useState(10)
  const [loading, setLoading] = useState(false)

  const toggleInterest = (interestId: string) => {
    setSelectedInterests(prev => 
      prev.includes(interestId) 
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    )
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      // Here you would typically save the onboarding data to your backend
      // For now, we'll just simulate a delay and redirect to dashboard
      await new Promise(resolve => setTimeout(resolve, 1000))
      router.push('/dashboard')
    } catch (error) {
      console.error('Onboarding failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto pt-12 pb-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">M</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to MindScroll, {user.name}!
          </h1>
          <p className="text-gray-600">
            Let's personalize your learning experience
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
            </div>
            <div className={`w-12 h-1 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
            </div>
            <div className={`w-12 h-1 rounded-full ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 3 ? <CheckCircle className="w-5 h-5" /> : '3'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Step 1: Interests */}
          {step === 1 && (
            <div>
              <div className="text-center mb-6">
                <Target className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  What interests you?
                </h2>
                <p className="text-gray-600">
                  Select topics you'd like to learn about. You can change these later.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {interests.map((interest) => (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedInterests.includes(interest.id)
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <interest.icon className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm font-medium">{interest.name}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={selectedInterests.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center"
              >
                Next Step
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Daily Goal */}
          {step === 2 && (
            <div>
              <div className="text-center mb-6">
                <Target className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Set your daily goal
                </h2>
                <p className="text-gray-600">
                  How many learning cards would you like to review each day?
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {dailyGoals.map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => setDailyGoal(goal.value)}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      dailyGoal === goal.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{goal.label}</div>
                        <div className="text-sm text-gray-600">{goal.description}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 ${
                        dailyGoal === goal.value
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {dailyGoal === goal.value && (
                          <CheckCircle className="w-5 h-5 text-white -ml-0.5 -mt-0.5" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center"
                >
                  Next Step
                  <ArrowRight className="ml-2 w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  You're all set!
                </h2>
                <p className="text-gray-600">
                  Your personalized learning experience is ready. Let's start learning!
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 mb-8">
                <h3 className="font-semibold text-gray-900 mb-4">Your Learning Profile</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Interests:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedInterests.map(interestId => {
                        const interest = interests.find(i => i.id === interestId)
                        return (
                          <span key={interestId} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {interest?.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Daily Goal:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">
                      {dailyGoals.find(g => g.value === dailyGoal)?.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-xl transition-colors inline-flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Start Learning
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}