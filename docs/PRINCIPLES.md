# Design principles

These are the ideas the code is built around, each with a pointer to where it lives. Where the code does not yet live up to the idea, that is stated.

## 1. The chapter is the unit of learning

A book already has a structure its author chose. The app keeps it: a reader works through one chapter at a time, and the next chapter's cards are not served until the current one is finished. This gives a session a natural end and makes progress legible ("chapter 4 of 12") in a way a flat deck of 200 cards does not.

Chapter names are read from the table of contents by a model and then mapped to page ranges. When that fails, the book is cut into fixed page windows labelled "Section N" so the rest of the system still has units to work with.

- `detectBookStructure` and `createPageLevelChunks` in `backend/src/processors/enhancedCardGenerator.js`
- `GET /session` in `backend/src/routes/progress.js`
- `Chapter` and `ChapterProgress` in `backend/prisma/schema.prisma`

Shortfall: the page-window fallback produces sections that do not correspond to the author's chapters, and plain-text or web sources, which have no page data, skip chapter detection and are cut by word count instead.

## 2. Three card types, always in the same order

Within a chapter the reader sees flashcards, then a quiz, then a summary. The order follows how the material is meant to be absorbed: meet each idea once, be tested on it, then see how the ideas fit together. The summary comes last on purpose, so it consolidates rather than replaces the work.

The data model enforces the limit. A card is one of `FLASHCARD`, `QUIZ` or `SUMMARY`, and the session endpoint sorts by that type order before the card's own position.

- `typeOrder` sort in `GET /session`, `backend/src/routes/progress.js`
- `Card.type` and `Content.enabledCardTypes` in `backend/prisma/schema.prisma`

## 3. Later cards are built from earlier cards, not from the raw text

Generation runs in passes. Flashcards are written from the book's text. Quizzes are written from the flashcards of a chapter. Summaries are written from the same flashcards. A quiz therefore only tests what the reader has just been shown, and a summary cannot introduce a claim the flashcards did not make. It also keeps cost down, since the long source text is sent to the model once.

Each card records what it was generated from, so a card can be traced back to its chunks or parent cards.

- `generateEnhancedLearningCards`, `generateQuizzesFromCards` and `generateChapterSummaries` in `backend/src/processors/enhancedCardGenerator.js`
- `Card.sourceChunks` and `Card.sourceCards` in `backend/prisma/schema.prisma`

Shortfall: the generator tracks these source links in memory, but `backend/scripts/library/addBook.js` does not write them to the database, so the columns hold their empty defaults.

## 4. Generation is constrained, and a bad book is not saved

Each prompt gives the model a fixed JSON shape, a word range, the chapter name, and an instruction to use only the supplied text. Temperature is 0 for chapter mapping and 0.1 for cards. The response is parsed strictly, with one repair attempt for trailing commas and stray quotes; a card that still fails to parse is dropped.

Before anything reaches the database, every card is checked against rules for its type (a flashcard needs a front of at least 20 characters and a back of at least 100; a quiz needs a question, at least two choices, a correct answer and an explanation). If fewer than five cards survive, or more than 30% are invalid, the whole book is rejected.

- `callAI` and `removeDuplicates` in `backend/src/processors/enhancedCardGenerator.js`
- the validation block in `addBookToLibrary`, `backend/scripts/library/addBook.js`

Shortfall: these checks are structural. A second pass in which a model compares each card with its source text and regenerates failures is written (`validateAndEnhanceCard`) but commented out in `applyQualityAssurance`, so factual accuracy currently rests on the prompt alone. Invalid cards below the 30% threshold are saved along with the valid ones.

## 5. Difficulty belongs to the reader, not the card

The same card is easy for one person and hard for another, so difficulty is stored on the reader's progress record for a card, not on the card. It starts at 2.5, rises by 1 when the reader marks a card unknown and falls by 0.1 when they mark it known, which means one miss outweighs several successes. The label shown in the interface (easy, medium, hard) is derived from that number.

Review timing is set by the same action: unknown comes back in ten minutes, skipped in four hours, known after a day or more.

- `POST /card-action`, `calculateNextReview` and `getDifficultyLabel` in `backend/src/routes/progress.js`
- `UserProgress` in `backend/prisma/schema.prisma`

Shortfall: difficulty does not yet feed the schedule. `calculateNextReview` accepts a difficulty and a streak but is called with neither, so a known card is always due the next day and the longer intervals are never reached. The SM-2 algorithm in `backend/src/utils/spacedRepetition.js`, which would use the ease-factor fields already in the schema, is not called from anywhere. Sessions are assembled from unfinished cards in chapter order and do not consult the review date.

## 6. Shared content and personal progress are kept apart

A book's cards are generated once and shared by everyone who enrols. Everything personal (known or not, review date, difficulty, chapter completion) sits in separate tables keyed by user and card or user and chapter. An early note in `Notes.md` records the decision: "cards can't contain user progress".

This is what lets a curated library exist at all, and it means re-enrolling or resetting progress never touches content.

- `Card` versus `UserProgress` and `ChapterProgress` in `backend/prisma/schema.prisma`
- the unique constraints `[userId, cardId]` and `[userId, chapterId]`

## 7. Cache whatever costs money to produce

Processing a book means dozens of model calls. Two results are cached on disk, keyed by a hash of title, author and file path: the detected chapter structure and the final set of cards (kept for seven days). A rerun after a failure late in the pipeline reuses both. The extracted text is stored on disk as well, not in the database, which keeps rows small. A debug flag, `DEBUG_CARD_GENERATION`, additionally saves the output of each generation pass for inspection.

- `backend/src/utils/fileStorage.js` (`cacheChapterStructure`, `cacheProcessedCards`, `storeExtractedText`)
- cache checks at the top of `generateEnhancedLearningCards` and `detectBookStructure`

Shortfall: embeddings are not cached; the vector store is rebuilt in memory on every run.

## 8. A reader's upload is private unless approved

A book someone uploads is theirs. The library listing shows curated content plus user uploads an admin has approved; a separate endpoint lists the caller's own uploads; and fetching a single item returns 403 unless it is curated, approved, or owned by the caller. The uploaded file itself is deleted from R2 and from local temporary storage once processing finishes, whether it succeeded or failed.

- `GET /content`, `GET /my-uploads`, `GET /content/:id` and `PUT /approve/:id` in `backend/src/routes/library.js`
- `Content.userId` and `Content.approvedForGlobal` in `backend/prisma/schema.prisma`
- the `finally` block of `processPdfUpload` in `backend/src/services/worker.js`

Shortfall: the access rules are in place but the pipeline does not yet set `userId` on the content it creates, so a new upload matches neither "owned by the caller" nor "approved" and is hidden from its own uploader. The upload job also runs `addBookToLibrary` in override mode, which replaces any existing book with the same title, author and category. And while the original file is deleted, the extracted text and generated cards remain in the on-disk cache described in principle 7.
