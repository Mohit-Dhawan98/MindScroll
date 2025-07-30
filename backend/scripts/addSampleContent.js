import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addSampleContent() {
  try {
    console.log('🌱 Adding sample content for testing...')

    // Create sample content
    const sampleContent = await prisma.content.create({
      data: {
        title: 'JavaScript Fundamentals',
        author: 'MindScroll Team',
        category: 'technology',
        description: 'Learn the core concepts of JavaScript programming',
        difficulty: 'EASY',
        estimatedTime: 20,
        tags: '["javascript", "programming", "web-development"]',
        totalCards: 4,
        isActive: true
      }
    })

    console.log(`✅ Created content: ${sampleContent.title}`)

    // Create sample cards
    const sampleCards = [
      {
        contentId: sampleContent.id,
        title: 'What are Variables in JavaScript?',
        content: 'Variables in JavaScript are containers that store data values. You can declare variables using var, let, or const keywords. For example:\n\nlet name = "John";\nconst age = 25;\nvar city = "New York";\n\nVariables allow you to store and manipulate data throughout your program.',
        difficulty: 'EASY',
        cardType: 'CONCEPT',
        order: 1,
        tags: '["variables", "basics"]'
      },
      {
        contentId: sampleContent.id,
        title: 'JavaScript Functions Explained',
        content: 'Functions are reusable blocks of code that perform specific tasks. You can declare functions in several ways:\n\n// Function declaration\nfunction greet(name) {\n  return "Hello, " + name + "!";\n}\n\n// Arrow function\nconst greet = (name) => {\n  return `Hello, ${name}!`;\n}\n\nFunctions help organize code and avoid repetition.',
        difficulty: 'EASY',
        cardType: 'CONCEPT',
        order: 2,
        tags: '["functions", "syntax"]'
      },
      {
        contentId: sampleContent.id,
        title: 'Understanding JavaScript Objects',
        content: 'Objects are collections of key-value pairs that represent real-world entities:\n\nconst person = {\n  name: "Alice",\n  age: 30,\n  city: "Boston",\n  greet: function() {\n    return "Hi, I\'m " + this.name;\n  }\n};\n\nYou can access object properties using dot notation (person.name) or bracket notation (person["name"]).',
        difficulty: 'MEDIUM',
        cardType: 'CONCEPT',
        order: 3,
        tags: '["objects", "data-structures"]'
      },
      {
        contentId: sampleContent.id,
        title: 'JavaScript Arrays and Methods',
        content: 'Arrays store multiple values in a single variable and provide useful methods:\n\nconst fruits = ["apple", "banana", "orange"];\n\n// Common array methods:\nfruits.push("grape");     // Add to end\nfruits.pop();            // Remove last\nfruits.length;           // Get length\nfruits.forEach(fruit => console.log(fruit));\n\nArrays are zero-indexed, so the first element is at index 0.',
        difficulty: 'MEDIUM',
        cardType: 'CONCEPT',
        order: 4,
        tags: '["arrays", "methods"]'
      }
    ]

    await prisma.card.createMany({
      data: sampleCards
    })

    console.log(`✅ Created ${sampleCards.length} sample cards`)
    console.log('🎉 Sample content added successfully!')
    console.log('\n📋 Next steps:')
    console.log('1. Start the backend server: npm start')
    console.log('2. Start the frontend: cd frontend && npm run dev')
    console.log('3. Register a new account at http://localhost:3000')
    console.log('4. Go to dashboard and click "JavaScript Fundamentals" to start learning!')

  } catch (error) {
    console.error('❌ Error adding sample content:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addSampleContent()