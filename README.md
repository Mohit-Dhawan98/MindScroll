# MindScroll (Epigram)

MindScroll turns a book into a chapter-by-chapter course of flashcards, quizzes and summaries, and tracks what each reader has learned.

The deployed app is branded **Epigram**: https://epigram-lake.vercel.app. The repository, package names and most of the code still use the original name, MindScroll.

The reasoning behind the design is written up in [docs/PRINCIPLES.md](docs/PRINCIPLES.md).

## How it works

A book goes through five stages between upload and a card appearing in a study session. The file names below are the ones that do the work.

1. **Intake.** `backend/src/controllers/upload.js` accepts a file, records a `ContentUpload` row, stores the file in Cloudflare R2 and puts a job on a Bull/Redis queue (`backend/src/services/queueService.js`). `backend/src/services/worker.js` picks the job up. Curated library books skip the queue and are added from the command line with `backend/scripts/library/addBook.js`; the PDF upload job calls the same function, so both routes share one pipeline.

2. **Extraction.** `backend/src/processors/textExtractor.js` reads PDF (via `pdf.js-extract`), EPUB (via `epub2`) or plain text. For PDFs it rebuilds lines from the x/y position of each text fragment and keeps the result per page. EPUB chapters are cut into roughly 300-word pseudo-pages so both formats come out in the same shape: full text plus a `pages` array.

3. **Structure and chunking.** `detectBookStructure` in `backend/src/processors/enhancedCardGenerator.js` sends the first ten pages to a language model to read chapter names from the table of contents, then asks it to map those names to page ranges. If that fails, it falls back to fixed windows of 5, 8 or 12 pages depending on how dense the pages are. `createSemanticChunks` then splits each chapter into chunks of about 3,500 characters on paragraph boundaries, with a 300-character overlap. Each chunk is embedded locally with `all-MiniLM-L6-v2` (`@xenova/transformers`) into an in-memory vector store.

4. **Generation passes.** `generateEnhancedLearningCards` in the same file runs the passes in a fixed order, each built on the one before:
   - **Flashcards**: one per group of four consecutive chunks, with the three most similar chunks from elsewhere in the book added as context (`generateFlashcardFromChunkGroup`).
   - **Quizzes**: one multiple-choice question per chapter, written from that chapter's flashcards rather than from the raw text (`generateQuizzesFromCards`).
   - **Summaries**: one per chapter, also written from the chapter's flashcards (`generateChapterSummaries`), plus one whole-book overview card.

   A fourth "application" card type is designed but switched off in code until the AI tutor exists.

5. **Validation and storage.** Model output is parsed as JSON with a repair step for common faults (`callAI`). Cards are de-duplicated by type and title. `addBook.js` then checks every card against per-type minimum lengths and required fields, and refuses to save the book at all if fewer than five cards were produced or more than 30% fail. Chapters and cards are written to Postgres through Prisma (`backend/prisma/schema.prisma`).

6. **Sessions and scheduling.** `GET /api/progress/session` in `backend/src/routes/progress.js` finds the first chapter with unfinished cards and serves them in the order flashcards, quizzes, summary. `POST /api/progress/card-action` records "known", "unknown" or "skip", sets the card's next review time, updates the reader's per-card difficulty and chapter progress, and awards XP (10, 5 or 2 points; a level is 100 XP).

### Which model does the generating

The generator supports two providers. The default, and the one the upload worker uses, is OpenAI (`gpt-4o` for chapter mapping, `gpt-4.1-mini` for cards). Anthropic Claude can be selected for library books with `--provider anthropic`. The tutor endpoints in `backend/src/services/aiService.js` call OpenAI.

## What is in the repository

```
backend/
  src/
    processors/     text extraction and card generation (the pipeline above)
    services/       queue, worker, tutor/AI service
    routes/         library, progress, upload, auth, content, AI endpoints
    controllers/    request handlers for auth, upload, content, users, AI
    middleware/     JWT auth, error handling
    utils/          file cache, R2 storage, SM-2 implementation
  prisma/           Postgres schema and the initial migration
  scripts/          library ingestion (addBook, bulkAddBooks), data migration
  docs/             design notes written while building the card generator
frontend/
  src/app/          Next.js app router pages (dashboard, library, learn, auth)
  src/components/   card viewer, chapter navigation, upload modal, tutor chat
  src/lib/          API client
  src/stores/       Zustand auth store
docs/               principles, architecture, deployment, database and Docker guides
content-library/    where curated source books are placed (books are not committed)
mobile/             a Flutter pubspec only; no mobile app has been written
nginx/, redis/      production configuration
```

Other documents at the top level: [PRD.md](PRD.md) (original product brief), [CHANGELOG.md](CHANGELOG.md), [RELEASE_NOTES_V0.1.md](RELEASE_NOTES_V0.1.md), [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick start

You need Node.js 18 or later, a PostgreSQL database, a Redis instance, and an OpenAI API key (an Anthropic key as well if you want to use `--provider anthropic`).

```bash
git clone https://github.com/Mohit-Dhawan98/MindScroll.git
cd MindScroll

# Install root, backend and frontend dependencies
npm run setup

# Configure the backend
cp backend/.env.example backend/.env
# then edit backend/.env (see below)

# Create the database tables
cd backend
npm run migrate
cd ..

# Start backend (port 3001) and frontend (port 3000) together
npm run dev
```

`backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mindscroll"
JWT_SECRET="a-long-random-string"
OPENAI_API_KEY="..."
ANTHROPIC_API_KEY="..."
REDIS_URL="redis://localhost:6379"
```

`backend/.env.example` does not list `OPENAI_API_KEY` or `REDIS_URL`; add them by hand. Uploads also need the Cloudflare R2 variables shown in `backend/.env.production.example`.

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
```

To add a book to the library (EPUB gives the best chapter detection):

```bash
cd backend
npm run add-book -- "path/to/Title - Author.epub" business
npm run add-book -- "path/to/Title - Author.epub" business --provider anthropic
```

The backend and Redis can also be run in Docker with `make dev`; see [docs/DOCKER_GUIDE.md](docs/DOCKER_GUIDE.md).

## Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, Framer Motion.
- **Backend:** Node.js, Express, Prisma on PostgreSQL, JWT authentication, Bull on Redis for background jobs, Cloudflare R2 for uploaded files.
- **Generation:** OpenAI and Anthropic SDKs; local sentence embeddings via `@xenova/transformers`.
- **Deployment:** frontend on Vercel; backend, worker, Redis and Nginx via Docker Compose.

## Status and known gaps

This is a v0.1 project built by one person. The library, enrolment, chapter-based learning flow, progress tracking and XP work end to end. The points below are where the code stops short of what the documents describe.

- **Spaced repetition is partial.** A review date is stored on every card action, and a full SM-2 implementation exists in `backend/src/utils/spacedRepetition.js`, but nothing calls it. The route uses a simpler interval ladder (1, 3, 7, 14, 30, 60 days) and currently does not pass the card's streak into it, so a "known" card is always scheduled one day out. The session endpoint serves cards by chapter completion, not by due date.
- **Streaks.** A per-card streak is maintained. The user-level daily streak shown in the app is stored but no code updates it.
- **Model-based quality check is off.** `applyQualityAssurance` contains a validate-then-regenerate step, but it is commented out; only de-duplication and the structural checks in `addBook.js` run.
- **Uploads.** The PDF upload job is wired to the main pipeline. The URL and plain-text upload jobs in `worker.js` call two helper functions that are not defined, so they will fail. The upload filter accepts DOC and DOCX, which the extractor cannot read.
- **Private uploads.** The library routes restrict a user's uploads to their owner unless an admin approves them, but the pipeline does not yet record the owner on the content it creates. See principle 8 in [docs/PRINCIPLES.md](docs/PRINCIPLES.md).
- **AI tutor.** The chat UI and endpoints exist; the roadmap lists tutor integration with card content as not built (V0.3 and V0.4 in [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md)).
- **Mobile app, collaboration, offline use, video and audio sources:** on the roadmap or in the PRD, not built.
- **Tests.** `npm test` is configured for Jest in the backend but the repository contains no test suite.
- **Older documents are out of date.** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes an early plan (Clerk, Neon, Pinecone, a Flutter client) rather than what was built. The changelog and release notes say SQLite; the schema is PostgreSQL. `backend/src/processors/contentProcessor.js`, `userContentProcessor.js` and `aiCardGenerator.js` are an earlier pipeline that no longer matches the schema and is not used by the running app.

The v0.1 release notes report performance improvements from parallel API calls and query changes (a dashboard load of about 800 ms). Those figures come from [RELEASE_NOTES_V0.1.md](RELEASE_NOTES_V0.1.md); the repository has no benchmark that reproduces them.

## Licence

MIT. See [LICENSE](LICENSE).
