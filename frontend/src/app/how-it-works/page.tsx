'use client'

import Link from 'next/link'
import { 
  Upload, 
  Sparkles, 
  Move, 
  Brain, 
  Target, 
  TrendingUp,
  ArrowRight,
  FileText,
  Zap,
  MessageCircle,
  BarChart3,
  CheckCircle
} from 'lucide-react'

export default function HowItWorksPage() {
  const steps = [
    {
      step: 1,
      title: "Upload Your Content",
      description: "Upload PDFs, articles, or paste URLs. Our AI instantly processes any learning material.",
      icon: Upload,
      visual: (
        <div className="bg-blue-50 rounded-2xl p-6 border-2 border-dashed border-blue-200">
          <div className="flex items-center justify-center space-x-4">
            <FileText className="w-12 h-12 text-blue-600" />
            <ArrowRight className="w-6 h-6 text-blue-400" />
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-center text-blue-700 text-sm mt-4 font-medium">AI Processing Magic</p>
        </div>
      )
    },
    {
      step: 2,
      title: "AI Creates Learning Cards",
      description: "Our advanced AI breaks down complex content into bite-sized, digestible learning cards.",
      icon: Sparkles,
      visual: (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
              <div className="w-8 h-8 bg-purple-100 rounded-lg mb-2 flex items-center justify-center">
                <Brain className="w-4 h-4 text-purple-600" />
              </div>
              <div className="h-2 bg-gray-200 rounded mb-2"></div>
              <div className="h-2 bg-gray-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      )
    },
    {
      step: 3,
      title: "Swipe to Learn",
      description: "Review cards with TikTok-style swiping. Right for 'I know this', left for 'Need review'.",
      icon: Move,
      visual: (
        <div className="relative">
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-200 transform rotate-2">
            <div className="w-10 h-10 bg-green-100 rounded-xl mb-4 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">What is Machine Learning?</h4>
            <p className="text-sm text-gray-600">AI that learns from data without explicit programming...</p>
          </div>
          <div className="absolute inset-0 bg-white rounded-2xl p-6 shadow-lg border border-gray-200 transform -rotate-1 -z-10 opacity-70">
            <div className="w-10 h-10 bg-blue-100 rounded-xl mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-100 rounded"></div>
          </div>
        </div>
      )
    },
    {
      step: 4,
      title: "AI Tutor Support",
      description: "Get instant help from your personal AI tutor. Ask questions and get explanations anytime.",
      icon: MessageCircle,
      visual: (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200">
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm max-w-xs">
                Can you explain neural networks?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-white px-3 py-2 rounded-xl text-sm shadow-sm max-w-xs border">
                <div className="flex items-center space-x-2 mb-1">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-gray-900">AI Tutor</span>
                </div>
                Neural networks mimic how the brain works...
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 5,
      title: "Smart Repetition",
      description: "Our spaced repetition algorithm ensures you review cards at the perfect time for retention.",
      icon: Zap,
      visual: (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Today</span>
            <div className="flex space-x-1">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-6 h-6 bg-green-500 rounded"></div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Tomorrow</span>
            <div className="flex space-x-1">
              {[1,2,3].map(i => (
                <div key={i} className="w-6 h-6 bg-yellow-500 rounded"></div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Next Week</span>
            <div className="flex space-x-1">
              <div className="w-6 h-6 bg-blue-500 rounded"></div>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 6,
      title: "Track Progress",
      description: "Monitor your learning journey with detailed analytics, streaks, and achievement milestones.",
      icon: BarChart3,
      visual: (
        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">87</div>
              <div className="text-xs text-gray-600">Cards Done</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">12</div>
              <div className="text-xs text-gray-600">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">4</div>
              <div className="text-xs text-gray-600">Level</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>Weekly Goal</span>
              <span>68%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full" style={{width: '68%'}}></div>
            </div>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold text-white">M</span>
              </div>
              <span className="text-2xl font-bold gradient-text">MindScroll</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link href="/auth/login" className="text-gray-600 hover:text-gray-900 font-medium">
                Sign in
              </Link>
              <Link href="/auth/register" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            How MindScroll
            <span className="block gradient-text">Transforms Learning</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            See how our AI-powered platform turns any content into an engaging, 
            personalized learning experience in just 6 simple steps.
          </p>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-20">
            {steps.map((step, index) => (
              <div key={step.step} className={`flex flex-col lg:flex-row items-center gap-12 ${
                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}>
                {/* Content */}
                <div className="flex-1 max-w-lg">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
                      {step.step}
                    </div>
                    <step.icon className="w-8 h-8 text-blue-600" />
                  </div>
                  
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    {step.title}
                  </h2>
                  
                  <p className="text-lg text-gray-600 mb-6">
                    {step.description}
                  </p>

                  {step.step === 1 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">PDF</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">Articles</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">URLs</span>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full">EPUB</span>
                    </div>
                  )}
                </div>

                {/* Visual */}
                <div className="flex-1 max-w-lg">
                  <div className="relative">
                    {step.visual}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why Choose MindScroll?
          </h2>
          <p className="text-lg text-gray-600 mb-12">
            The smartest way to learn anything, backed by science and powered by AI
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <TrendingUp className="w-10 h-10 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">10x Faster Learning</h3>
              <p className="text-gray-600 text-sm">Micro-learning techniques proven to increase retention and speed</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <Brain className="w-10 h-10 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">AI-Personalized</h3>
              <p className="text-gray-600 text-sm">Content adapted to your learning style and progress</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <Target className="w-10 h-10 text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Science-Based</h3>
              <p className="text-gray-600 text-sm">Spaced repetition and active recall for maximum retention</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of learners already mastering new skills with MindScroll
          </p>
          <Link href="/auth/register" className="inline-flex items-center bg-white text-blue-600 hover:bg-gray-100 font-medium text-lg px-8 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl">
            Start Learning Free
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-white">M</span>
              </div>
              <span className="text-xl font-bold">MindScroll</span>
            </div>
          </div>
          <div className="text-center text-gray-400 text-sm mt-4">
            © 2024 MindScroll. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}