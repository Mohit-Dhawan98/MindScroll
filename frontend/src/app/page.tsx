'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { 
  BookOpen, 
  Brain, 
  Zap, 
  Users, 
  Star, 
  ArrowRight,
  Play,
  CheckCircle,
  Sparkles
} from 'lucide-react'

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold text-white">M</span>
              </div>
              <span className="text-2xl font-bold gradient-text">MindScroll</span>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <Link href="/how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">How it Works</Link>
            </nav>

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
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Microlearning Platform</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
              Learn anything in
              <span className="block gradient-text">bite-sized cards</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
              Transform any content into swipeable learning cards. Get personalized lessons, 
              chat with an AI tutor, and master new skills 10x faster.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/auth/register" className="btn-primary text-lg px-8 py-4 inline-flex items-center">
                Start Learning Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 font-medium">
                <Play className="w-5 h-5" />
                <span>Watch Demo</span>
              </button>
            </div>
          </div>

          {/* Hero Image/Demo */}
          <div className="mt-16 relative">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 shadow-2xl">
              <div className="bg-white rounded-2xl p-6 aspect-video flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <BookOpen className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Interactive Learning Cards</h3>
                  <p className="text-gray-600">Swipe through beautifully designed content</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need to learn smarter
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powered by advanced AI to create personalized learning experiences
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: 'AI-Powered Content',
                description: 'Upload any PDF, article, or URL and get instant microlearning cards'
              },
              {
                icon: Zap,
                title: 'Spaced Repetition',
                description: 'Scientific algorithm ensures you remember what you learn'
              },
              {
                icon: Users,
                title: 'AI Tutor Chat',
                description: 'Get instant answers and explanations from your personal AI assistant'
              },
              {
                icon: BookOpen,
                title: 'Swipeable Interface',
                description: 'TikTok-style learning that makes studying addictive and fun'
              },
              {
                icon: Star,
                title: 'Progress Tracking',
                description: 'Monitor your learning journey with detailed analytics and insights'
              },
              {
                icon: CheckCircle,
                title: 'Curated Content',
                description: 'Access professionally created summaries of popular books and topics'
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to revolutionize your learning?
          </h2>
          <p className="text-xl text-blue-100 mb-10">
            Join thousands of learners who are already mastering new skills with MindScroll
          </p>
          <Link href="/auth/register" className="inline-flex items-center bg-white text-blue-600 hover:bg-gray-100 font-medium text-lg px-8 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl">
            Start Your Journey
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-white">M</span>
              </div>
              <span className="text-xl font-bold">MindScroll</span>
            </div>
            
            <div className="text-gray-400 text-sm">
              © 2024 MindScroll. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}