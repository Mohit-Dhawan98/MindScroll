import { Anthropic } from "@anthropic-ai/sdk"
import { cleanAndChunkText } from './textExtractor.js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function generateLearningCards(textContent, bookTitle, author, category) {
  try {
    console.log(`🧠 Generating cards for: ${bookTitle} by ${author}`)
    
    // Clean and chunk the text
    const chunks = cleanAndChunkText(textContent, 3000)
    console.log(`📝 Processing ${chunks.length} text chunks`)
    
    const allCards = []
    
    // Process chunks in batches to avoid rate limits
    for (let i = 0; i < chunks.length; i += 3) {
      const batchChunks = chunks.slice(i, i + 3)
      const batchCards = await processBatch(batchChunks, bookTitle, author, category)
      allCards.push(...batchCards)
      
      // Small delay between batches
      if (i + 3 < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    // Remove duplicates and filter quality
    const uniqueCards = filterAndDeduplicateCards(allCards)
    console.log(`✨ Generated ${uniqueCards.length} unique learning cards`)
    
    return uniqueCards.slice(0, 50) // Limit to 50 cards per book
    
  } catch (error) {
    console.error('Error generating learning cards:', error)
    return []
  }
}

async function processBatch(chunks, bookTitle, author, category) {
  const cards = []
  
  for (const chunk of chunks) {
    try {
      const chunkCards = await generateCardsFromChunk(chunk, bookTitle, author, category)
      cards.push(...chunkCards)
    } catch (error) {
      console.error('Error processing chunk:', error)
      continue
    }
  }
  
  return cards
}

async function generateCardsFromChunk(textChunk, bookTitle, author, category) {
  const prompt = `You are an expert educator creating microlearning cards from the book "${bookTitle}" by ${author} in the ${category} category.

Extract the most important concepts, ideas, and insights from this text chunk and create learning cards.

Text chunk:
${textChunk}

Create 3-5 learning cards in this exact JSON format:
[
  {
    "title": "Clear, concise question or concept title (max 80 chars)",
    "content": "Detailed explanation, key insights, or answer (200-400 words). Use bullet points and examples where helpful.",
    "difficulty": "EASY|MEDIUM|HARD",
    "tags": ["concept1", "concept2", "concept3"]
  }
]

Guidelines:
- Focus on actionable insights and key concepts
- Make cards standalone (don't reference "the text" or "this chapter")  
- Use clear, educational language
- Include examples or applications when relevant
- Vary difficulty based on concept complexity
- Each card should teach something valuable

Return only the JSON array, no other text.`

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
    
    const responseText = response.content[0].text.trim()
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.warn('No JSON found in AI response')
      return []
    }
    
    const cards = JSON.parse(jsonMatch[0])
    
    // Validate and clean cards
    return cards.filter(card => 
      card.title && 
      card.content && 
      card.title.length <= 100 &&
      card.content.length >= 50
    ).map(card => ({
      ...card,
      difficulty: card.difficulty || 'MEDIUM',
      tags: Array.isArray(card.tags) ? card.tags : []
    }))
    
  } catch (error) {
    console.error('Error generating cards from chunk:', error)
    return []
  }
}

function filterAndDeduplicateCards(cards) {
  const seen = new Set()
  const unique = []
  
  for (const card of cards) {
    // Create a simple hash for deduplication
    const hash = card.title.toLowerCase().replace(/[^\w]/g, '')
    
    if (!seen.has(hash) && card.title && card.content) {
      seen.add(hash)
      unique.push(card)
    }
  }
  
  // Sort by perceived quality (longer, more detailed cards first)
  return unique.sort((a, b) => {
    const scoreA = a.content.length + (a.tags?.length || 0) * 10
    const scoreB = b.content.length + (b.tags?.length || 0) * 10
    return scoreB - scoreA
  })
}

// Alternative function using OpenAI (uncomment if preferred)
/*
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateLearningCardsOpenAI(textContent, bookTitle, author, category) {
  // Similar implementation using OpenAI GPT-4
  // Replace anthropic.messages.create with openai.chat.completions.create
}
*/