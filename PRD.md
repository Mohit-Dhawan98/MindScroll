# Product Requirements Document (PRD)

## Product Name: MindScroll (Working Title)

---

## 1. Overview

### 1.1 Product Summary

MindScroll is an AI-powered microlearning platform designed to replicate and extend the functionality of Shortform. It combines a high-quality curated content library with AI-driven dynamic content generation. Users can select existing topics, upload their own content (e.g., PDFs, articles), or let an agentic AI tutor guide their daily learning path through short, swipeable, attention-optimized lessons.

### 1.2 Goals

* Replicate Shortform's curated content experience.
* Allow users to ingest any type of content (web, PDFs, videos) and convert it to microlearning units.
* Provide an agentic tutor that guides learning, adapts to the user, and surfaces personalized content.
* Replace social media screen time with dopamine-friendly, intellectually rewarding experiences.

### 1.3 Target Audience

* Self-learners and knowledge workers.
* Students and professionals in fast-evolving fields (tech, business, science).
* Users seeking structured, time-efficient alternatives to long-form reading.

---

## 2. Features

### 2.1 Core Features

#### 2.1.1 Curated Content Library

* Replicate Shortform-style summaries for key non-fiction books and articles.
* Tagging by topic, difficulty level, and content type (summary, insight, key ideas, quizzes).
* Structured into swipeable cards: summaries, visual explainers, analogies, quotes.

#### 2.1.2 Dynamic Content Generation

* Input sources: URL, PDF, YouTube link, plain text.
* LLM generates:

  * Concise summaries (swipe cards)
  * Visual aids (diagrams via DALL•E or similar)
  * Flashcards (Q\&A format)
  * Quizzes (MCQs, True/False)
* Multi-day microlearning plans auto-generated from long documents.

#### 2.1.3 Agentic AI Tutor

* Chatbot-like interface powered by GPT-4/Claude.
* Can:

  * Recommend what to learn next based on previous sessions.
  * Answer follow-up questions about lessons.
  * Quiz the user on prior material.
  * Accept queries like: "Give me a 5-day plan to learn Stoicism."

#### 2.1.4 Microlearning Delivery

* Daily feed of 3–5 cards.
* Swipe UX optimized for vertical scrolling.
* Formats:

  * Text-only summary
  * Visual + caption
  * Quiz card
  * Flashcard
  * Audio snippet (TTS-generated)

#### 2.1.5 Learning Progression & Spaced Repetition

* Memory system to track what users retain.
* Cards resurfaced after 1/3/7 days.
* Streak tracking, XP levels, knowledge heatmap.

#### 2.1.6 Upload Content

* Drag & drop or mobile upload of PDFs, DOCs, or web links.
* Background processing to split into chapters or sections.
* User review/edit of generated microlearning plan.

---

## 3. Technical Requirements

### 3.1 Backend

* **LLM APIs**: OpenAI GPT-4-turbo / Claude 3 for summarization, quiz, and tutor logic.
* **Search APIs**: Perplexity/Bing/Web search wrappers for real-time content ingestion.
* **PDF Parsing**: PyMuPDF + LangChain document loaders.
* **TTS**: ElevenLabs or Whisper for optional audio playback.
* **Vector Database**: Pinecone / Weaviate for semantic search.
* **Database**: Supabase (PostgreSQL) or Firebase Firestore.
* **Scheduler**: Cloud Functions or AWS Lambda (for daily lesson generation).

### 3.2 Frontend

* **Mobile App**: Flutter for iOS/Android parity.
* **Web App**: Next.js with TailwindCSS.
* **Animations**: Framer Motion (Web), Rive (Flutter).
* **UI Components**:

  * Card viewer with swipe gesture support.
  * Chat-like interface for the AI tutor.
  * File upload module with preview.
  * Visual dashboard (XP, streaks, knowledge graph).

### 3.3 Integrations

* Readwise API (optional for syncing highlights).
* Notion API (optional for journaling or logging).
* Zapier or Pipedream (for notifications/reminders).

---

## 4. User Flows

### 4.1 Onboarding

1. Choose interests (e.g., Philosophy, AI, HR, Business).
2. Set daily goal (time or card count).
3. Pick content mode: curated / AI-generated / upload own.
4. Enable notifications.

### 4.2 Daily Feed

1. Open app and start with 3–5 cards.
2. Card types randomly interspersed.
3. End-of-feed: simple quiz + XP tally.

### 4.3 Upload Content

1. User uploads PDF.
2. AI splits into sections, summarizes.
3. User reviews auto-generated plan.
4. Edits cards if needed.

### 4.4 Agent Chat (Tutor)

1. Ask: "Teach me X" or "Quiz me on Y".
2. AI responds with cards or tailored explanations.
3. Follow-up support: rephrasing, visuals, analogies.

---

## 5. Content Structure & Card Format

```json
{
  "card_id": "abc123",
  "type": "summary | flashcard | visual | quiz | audio",
  "title": "What is First Principles Thinking?",
  "content": "Break down complex problems into foundational truths...",
  "image_url": "https://...",
  "quiz": {
    "question": "What does First Principles Thinking avoid?",
    "choices": ["Analogies", "Root causes", "Logic", "Data"],
    "answer": "Analogies"
  },
  "audio_url": "https://..."
}
```

---

## 6. Success Metrics

| Metric                    | Target                           |
| ------------------------- | -------------------------------- |
| D1 Retention              | >40%                             |
| Upload success rate       | >95%                             |
| Agentic help satisfaction | >85% thumbs-up rating            |
| Daily lesson completion   | >60% of active users             |
| Feedback loop engagement  | >30% rate of card likes/dislikes |

---

## 7. Roadmap (MVP Timeline)

| Phase                          | Timeline |
| ------------------------------ | -------- |
| UX/UI Design                   | Week 1–2 |
| Backend + AI Agent             | Week 2–5 |
| Content Generation & Ingestion | Week 3–6 |
| Frontend App (Flutter/Web)     | Week 4–7 |
| QA + UAT + Beta Launch         | Week 8–9 |

---

## 8. Post-MVP Features

* Smart daily scheduling (sync with calendar).
* Public learning streak leaderboard.
* Auto-publish user-generated cards.
* GPT-generated voice-over explanations.
* Browser extension for "Learn this later" bookmarking.

---

## 9. Open Questions

* Will curated content be licensed (like Shortform)?
* Should we allow user-generated card sharing in MVP?
* Should we support voice-based input/output fully at launch?

---

## 10. Appendices

* Competitive analysis with Blinkist, Shortform, Uptime.
* System prompt examples for summary/quiz generation.
* Potential brand names, tone & visual identity references.


