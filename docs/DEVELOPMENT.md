# MindScroll Development Guide

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+
- PostgreSQL (or Neon account)
- Flutter SDK (for mobile development)

### Quick Setup
```bash
# Run the setup script
./scripts/setup.sh

# Initialize database
./scripts/init-db.sh

# Start development environment
./start-dev.sh
```

## Project Structure

```
mindscroll/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/          # Data models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── utils/           # Helper functions
│   ├── prisma/              # Database schema and migrations
│   └── uploads/             # File uploads
├── frontend/                # Next.js web application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Next.js pages
│   │   ├── styles/          # CSS and styling
│   │   ├── utils/           # Utility functions
│   │   ├── hooks/           # Custom React hooks
│   │   └── stores/          # State management
│   └── public/              # Static assets
├── mobile/                  # Flutter mobile app
│   ├── lib/
│   │   ├── models/          # Data models
│   │   ├── services/        # API services
│   │   ├── providers/       # State management
│   │   ├── screens/         # App screens
│   │   ├── widgets/         # Reusable widgets
│   │   └── utils/           # Helper functions
│   └── assets/              # Images, fonts, etc.
├── docs/                    # Documentation
└── scripts/                 # Build and deployment scripts
```

## Development Workflow

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Database operations
npm run migrate      # Run migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check
```

### Mobile Development

```bash
cd mobile

# Get dependencies
flutter pub get

# Run on device/emulator
flutter run

# Build for Android
flutter build apk

# Build for iOS
flutter build ios
```

## Environment Configuration

### Backend (.env)
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mindscroll"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# AI Services
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
ELEVENLABS_API_KEY="..."

# Vector Database
PINECONE_API_KEY="..."
PINECONE_ENVIRONMENT="us-west1-gcp"
PINECONE_INDEX_NAME="mindscroll-vectors"

# Cache
REDIS_URL="redis://localhost:6379"
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test...
CLERK_SECRET_KEY=sk_test...
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Content
- `GET /api/content` - Get content with filtering
- `GET /api/content/feed` - Get daily feed
- `GET /api/content/:id` - Get specific content
- `POST /api/content` - Create content (admin)
- `PUT /api/content/:id` - Update content (admin)
- `DELETE /api/content/:id` - Delete content (admin)

### AI Services
- `POST /api/ai/chat` - Chat with AI tutor
- `POST /api/ai/generate-content` - Generate content
- `POST /api/ai/generate-quiz` - Generate quizzes
- `POST /api/ai/text-to-speech` - Convert text to speech

### Upload
- `POST /api/upload` - Upload content file
- `POST /api/upload/url` - Process URL content
- `GET /api/upload/:id/status` - Check processing status

## Database Schema

### Key Models

**Users**
- Authentication and profile data
- Learning preferences and goals
- Gamification data (XP, level, streak)

**Content**
- Curated and user-generated content
- Metadata and categorization
- AI generation flags

**Cards**
- Individual learning units
- Support for multiple types (summary, quiz, flashcard)
- Media attachments

**UserProgress**
- Spaced repetition tracking
- Performance metrics
- Review scheduling

## AI Integration

### OpenAI Services
- **GPT-4**: Content generation, tutoring, summarization
- **DALL-E 3**: Visual content generation
- **TTS**: Text-to-speech conversion

### Anthropic Claude
- **Claude 3.5**: Alternative LLM for content generation
- **Enhanced reasoning**: Complex educational content

### Content Processing Pipeline
1. **Input**: PDF, URL, or text
2. **Extraction**: Parse and clean content
3. **Chunking**: Split into manageable sections
4. **Generation**: Create cards using AI
5. **Review**: Quality check and formatting
6. **Storage**: Save to database with metadata

## Spaced Repetition Algorithm

Implementation of SM-2 algorithm:
- **Quality scoring**: User performance rating (0-5)
- **Ease factor**: Difficulty adjustment
- **Intervals**: Optimal review timing
- **Statistics**: Learning progress tracking

## Testing

### Backend Testing
```bash
cd backend

# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

### Frontend Testing
```bash
cd frontend

# Component tests
npm test

# E2E tests
npm run test:e2e
```

### Mobile Testing
```bash
cd mobile

# Unit tests
flutter test

# Integration tests
flutter test integration_test/
```

## Deployment

### Development
```bash
# Start all services
npm run dev
```

### Staging
```bash
# Build and deploy to staging
./scripts/deploy.sh staging
```

### Production
```bash
# Build and deploy to production
./scripts/deploy.sh production
```

## Monitoring and Analytics

### Backend Monitoring
- **Sentry**: Error tracking and performance
- **Morgan**: HTTP request logging
- **Custom metrics**: API response times, user activity

### Frontend Analytics
- **PostHog**: User behavior tracking
- **Vercel Analytics**: Performance metrics
- **Custom events**: Learning progress, feature usage

## Contributing

1. **Create feature branch**: `git checkout -b feature/amazing-feature`
2. **Follow conventions**: ESLint, Prettier, commit messages
3. **Write tests**: Maintain test coverage
4. **Update docs**: Keep documentation current
5. **Submit PR**: Include description and testing notes

## Common Issues

### Database Connection
```bash
# Check database is running
pg_ctl status

# Reset database
npm run db:reset
```

### Port Conflicts
```bash
# Check what's using port 3001
lsof -i :3001

# Kill process if needed
kill -9 <PID>
```

### Flutter Issues
```bash
# Clean build
flutter clean
flutter pub get

# Doctor check
flutter doctor
```

### API Key Issues
- Ensure all API keys are set in `.env`
- Check key permissions and quotas
- Verify environment variables are loaded

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Flutter Documentation](https://flutter.dev/docs)
- [Prisma Documentation](https://prisma.io/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)