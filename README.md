# MindScroll - AI-Powered Microlearning Platform

MindScroll is an AI-powered microlearning platform that combines curated content with dynamic AI generation, featuring a TikTok-style swipeable interface and an intelligent tutor agent.

## Features

### Core Shortform Features
- ✅ Comprehensive chapter-by-chapter summaries
- ✅ Interactive exercises and quizzes
- ✅ Original articles with fact-checking
- ✅ PDF export functionality
- ✅ ReadWise integration
- ✅ Multi-format content (text + audio)

### Enhanced Features
- 🤖 AI Tutor Agent for personalized learning
- 📱 TikTok-style swipeable card interface
- 🧠 Spaced repetition memory system
- 📄 Content upload (PDFs, URLs, videos)
- 🎨 AI-generated visual aids and diagrams
- 🎮 Gamification with XP, streaks, and achievements
- 🔄 Multi-source learning (books, podcasts, courses)

## Tech Stack

### Frontend
- **Mobile**: Flutter with Dart
- **Web**: Next.js 14+ with TypeScript
- **UI**: TailwindCSS + shadcn/ui
- **Animations**: Framer Motion (web), Rive (Flutter)

### Backend
- **API**: Node.js with Express
- **Database**: Neon (PostgreSQL) + Prisma ORM
- **Vector DB**: Pinecone for semantic search
- **Storage**: AWS S3/CloudFlare R2

### AI Services
- **LLM**: OpenAI GPT-4 + Anthropic Claude 3.5
- **TTS**: ElevenLabs + OpenAI Whisper
- **Images**: DALL-E 3
- **Docs**: LangChain + PyMuPDF

### Infrastructure
- **Hosting**: Vercel (web), Firebase (mobile)
- **Auth**: Clerk
- **Monitoring**: Sentry + PostHog

## Project Structure

```
mindscroll/
├── backend/          # Node.js API server
├── frontend/         # Next.js web app
├── mobile/          # Flutter mobile app
├── docs/            # Documentation
├── scripts/         # Build and deployment scripts
└── README.md
```

## Development Phases

1. **Foundation** (Weeks 1-3): Core setup, auth, basic UI
2. **Content Engine** (Weeks 3-6): AI generation, content management
3. **Interactive Features** (Weeks 5-8): AI tutor, spaced repetition
4. **Advanced Features** (Weeks 7-10): Multi-media, social features
5. **Polish & Launch** (Weeks 9-12): Optimization, testing, deployment

## Getting Started

### Prerequisites
- Node.js 18+
- Flutter SDK
- PostgreSQL (or Neon account)
- OpenAI API key

### Quick Start
```bash
# Clone and setup
git clone <repo-url>
cd mindscroll

# Backend setup
cd backend
npm install
cp .env.example .env
# Configure environment variables
npm run dev

# Frontend setup
cd ../frontend
npm install
npm run dev

# Mobile setup
cd ../mobile
flutter pub get
flutter run
```

## API Keys Required
- OpenAI API key
- Anthropic API key
- ElevenLabs API key
- Pinecone API key
- Neon database URL

## License
MIT License - see LICENSE file for details