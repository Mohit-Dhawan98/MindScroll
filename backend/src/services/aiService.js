import OpenAI from 'openai'
import { Anthropic } from '@anthropic-ai/sdk'

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }

  async generateSummary(text, options = {}) {
    const {
      length = 'medium',
      style = 'academic',
      difficulty = 'INTERMEDIATE'
    } = options

    const lengthGuide = {
      short: '2-3 sentences',
      medium: '1-2 paragraphs',
      long: '3-4 paragraphs'
    }

    const prompt = `Create a ${lengthGuide[length]} summary of the following text in a ${style} style, suitable for ${difficulty.toLowerCase()} level learners:

${text}

Focus on the key concepts, main ideas, and practical applications. Make it engaging and easy to understand.`

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educator who creates clear, concise, and engaging summaries for microlearning.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })

      return response.choices[0].message.content
    } catch (error) {
      console.error('Error generating summary:', error)
      throw error
    }
  }

  async generateQuiz(content, options = {}) {
    const {
      numQuestions = 5,
      difficulty = 'INTERMEDIATE'
    } = options

    const prompt = `Create ${numQuestions} multiple-choice questions based on the following content. Make them ${difficulty.toLowerCase()} level difficulty.

Content: ${content}

Format each question as JSON with this structure:
{
  "question": "Question text",
  "choices": ["A", "B", "C", "D"],
  "answer": "A",
  "explanation": "Why this is correct and others are wrong"
}

Return as a JSON array of questions.`

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert quiz creator who makes engaging, educational multiple-choice questions. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })

      return JSON.parse(response.choices[0].message.content)
    } catch (error) {
      console.error('Error generating quiz:', error)
      throw error
    }
  }

  async generateFlashcards(content, options = {}) {
    const { numCards = 10 } = options

    const prompt = `Create ${numCards} flashcards from the following content. Each flashcard should have a clear question/prompt on the front and a concise answer on the back.

Content: ${content}

Format as JSON array:
[
  {
    "front": "Question or concept",
    "back": "Answer or explanation"
  }
]`

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating effective flashcards for spaced repetition learning. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.5
      })

      return JSON.parse(response.choices[0].message.content)
    } catch (error) {
      console.error('Error generating flashcards:', error)
      throw error
    }
  }

  async chatWithTutor(message, context = '', conversationHistory = []) {
    const systemPrompt = `You are MindScroll's AI tutor - a knowledgeable, encouraging, and patient learning assistant. You help users understand concepts, answer questions, and guide their learning journey.

Key characteristics:
- Be encouraging and supportive
- Break down complex concepts into digestible parts
- Use analogies and examples when helpful
- Ask follow-up questions to check understanding
- Suggest related topics to explore
- Keep responses concise but thorough

${context ? `Current learning context: ${context}` : ''}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        max_tokens: 800,
        temperature: 0.7
      })

      return response.choices[0].message.content
    } catch (error) {
      console.error('Error in chat with tutor:', error)
      throw error
    }
  }

  async generateVisualPrompt(concept, style = 'diagram') {
    const styleGuides = {
      diagram: 'a clear, educational diagram',
      infographic: 'a colorful, informative infographic',
      illustration: 'a simple, engaging illustration',
      chart: 'a clean, data-focused chart or graph'
    }

    const prompt = `Create a detailed prompt for generating ${styleGuides[style]} about: ${concept}

The image should be:
- Educational and clear
- Suitable for microlearning
- Easy to understand at a glance
- Professional but engaging

Describe the visual elements, colors, layout, and key information to include.`

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating detailed prompts for educational visual content generation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.6
      })

      return response.choices[0].message.content
    } catch (error) {
      console.error('Error generating visual prompt:', error)
      throw error
    }
  }

  async generateImage(prompt) {
    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1
      })

      return response.data[0].url
    } catch (error) {
      console.error('Error generating image:', error)
      throw error
    }
  }

  async textToSpeech(text, options = {}) {
    const {
      voice = 'alloy',
      speed = 1.0
    } = options

    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
        speed
      })

      return response
    } catch (error) {
      console.error('Error generating speech:', error)
      throw error
    }
  }
}

export default new AIService()