# MindScroll Architecture

## System Overview

MindScroll is built as a microservices architecture with separate frontend, backend, and mobile applications, all connected through RESTful APIs and real-time communication.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Flutter App   │    │   Next.js Web   │    │  Admin Panel    │
│   (Mobile)      │    │   (Frontend)    │    │   (Dashboard)   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Express.js)  │
                    └─────────┬───────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────┴───────┐ ┌─────┴─────┐ ┌─────────┴───────┐
    │  Auth Service   │ │ AI Service │ │ Content Service │
    │   (Clerk)       │ │  (OpenAI)  │ │   (Express)     │
    └─────────────────┘ └───────────┘ └─────────────────┘
                              │
                    ┌─────────┴───────┐
                    │   Data Layer    │
                    │                 │
                    │ ┌─────────────┐ │
                    │ │ PostgreSQL  │ │
                    │ │   (Neon)    │ │
                    │ └─────────────┘ │
                    │ ┌─────────────┐ │
                    │ │  Pinecone   │ │
                    │ │ (Vector DB) │ │
                    │ └─────────────┘ │
                    │ ┌─────────────┐ │
                    │ │    Redis    │ │
                    │ │   (Cache)   │ │
                    │ └─────────────┘ │
                    └─────────────────┘
```

## Core Components

### 1. Frontend Applications

#### Next.js Web App
- **Purpose**: Desktop web interface, admin dashboard
- **Key Features**: Content management, analytics, responsive design
- **Tech**: Next.js 14, TypeScript, TailwindCSS, shadcn/ui

#### Flutter Mobile App
- **Purpose**: Primary user interface for learning
- **Key Features**: Swipeable cards, offline support, push notifications
- **Tech**: Flutter, Dart, Provider/Riverpod state management

### 2. Backend Services

#### API Gateway (Express.js)
- **Purpose**: Central API endpoint, request routing, authentication
- **Responsibilities**:
  - Route requests to appropriate services
  - Handle authentication and authorization
  - Rate limiting and request validation
  - API documentation (Swagger)

#### Auth Service (Clerk)
- **Purpose**: User authentication and authorization
- **Features**:
  - Social login (Google, Apple, GitHub)
  - JWT token management
  - User profile management
  - Role-based access control

#### AI Service
- **Purpose**: Content generation and processing
- **Capabilities**:
  - Document summarization (GPT-4, Claude)
  - Quiz generation
  - Visual content creation (DALL-E)
  - Text-to-speech (ElevenLabs)
  - Semantic search (embeddings)

#### Content Service
- **Purpose**: Content management and delivery
- **Features**:
  - CRUD operations for content
  - Content categorization and tagging
  - Search functionality
  - Progress tracking

### 3. Data Layer

#### PostgreSQL (Neon)
```sql
-- Core tables
users (id, email, profile, preferences, created_at)
content (id, title, type, source, metadata, created_at)
cards (id, content_id, type, data, order, created_at)
user_progress (user_id, card_id, status, score, last_reviewed)
learning_sessions (id, user_id, cards_completed, duration, created_at)
```

#### Pinecone (Vector Database)
- **Purpose**: Semantic search and content recommendations
- **Data**: Content embeddings, user preference vectors

#### Redis Cache
- **Purpose**: Session management, rate limiting, content caching
- **Data**: User sessions, API responses, frequently accessed content

## Data Flow

### 1. Content Ingestion Flow
```
User Upload → Document Parser → AI Processor → Content Generator → Database Storage
```

1. User uploads PDF/URL/text
2. Document parser extracts text and metadata
3. AI processor creates summaries, quizzes, and visual aids
4. Content generator creates swipeable cards
5. Cards stored in database with metadata

### 2. Learning Session Flow
```
User Request → Content Recommender → Spaced Repetition → Card Delivery → Progress Tracking
```

1. User opens app or requests specific content
2. AI recommender selects appropriate cards
3. Spaced repetition algorithm determines review cards
4. Cards delivered via API to frontend
5. User interactions tracked and stored

### 3. AI Tutor Interaction Flow
```
User Query → Context Retrieval → LLM Processing → Response Generation → Conversation Storage
```

1. User asks question to AI tutor
2. System retrieves relevant context from knowledge base
3. LLM processes query with context
4. Response generated and formatted
5. Conversation history stored for continuity

## Security Architecture

### Authentication & Authorization
- **JWT tokens** for stateless authentication
- **Role-based access control** (User, Admin, Super Admin)
- **API key management** for external services
- **Rate limiting** per user and endpoint

### Data Protection
- **Encryption at rest** for sensitive data
- **HTTPS/TLS** for all communications
- **Input sanitization** and validation
- **SQL injection prevention** with Prisma ORM

### Privacy Considerations
- **GDPR compliance** for European users
- **Data retention policies** for user content
- **User data export** functionality
- **Content anonymization** for AI training

## Scalability Considerations

### Horizontal Scaling
- **Microservices architecture** allows independent scaling
- **Load balancing** across multiple API instances
- **Database read replicas** for improved performance
- **CDN integration** for static content delivery

### Performance Optimization
- **Caching strategies** at multiple levels
- **Database indexing** for frequently queried data
- **API response compression** and pagination
- **Image optimization** and lazy loading

### Monitoring & Observability
- **Application monitoring** with Sentry
- **Performance tracking** with PostHog
- **API metrics** and error tracking
- **User analytics** and behavior tracking

## Development Workflow

### Local Development
```bash
# Start all services
npm run dev

# Individual services
npm run dev:backend    # API server on :3001
npm run dev:frontend   # Web app on :3000
flutter run           # Mobile app on device/emulator
```

### CI/CD Pipeline
1. **Code commit** triggers GitHub Actions
2. **Automated testing** (unit, integration, E2E)
3. **Code quality checks** (ESLint, Prettier, type checking)
4. **Security scanning** for vulnerabilities
5. **Deployment** to staging/production environments

### Environment Management
- **Development**: Local development with mock services
- **Staging**: Full production replica for testing
- **Production**: Live environment with monitoring

This architecture provides a solid foundation for building a scalable, maintainable, and secure microlearning platform that can grow with user demand and feature requirements.