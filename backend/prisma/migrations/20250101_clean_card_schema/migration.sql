-- Migration: Clean up Card schema for simplified 3-card system
-- Remove redundant fields and update for FLASHCARD, QUIZ, SUMMARY only

BEGIN TRANSACTION;

-- Step 1: Remove redundant columns from Card table
-- Keep: id, contentId, type, title, order, quiz, front, back, chapterId, sourceChunks, sourceCards
-- Remove: text, imageUrl, audioUrl (redundant fields)
ALTER TABLE cards ADD COLUMN new_text TEXT;
UPDATE cards SET new_text = COALESCE(front, text) WHERE type = 'FLASHCARD' AND front IS NOT NULL;
UPDATE cards SET new_text = text WHERE type IN ('QUIZ', 'SUMMARY', 'APPLICATION', 'SYNTHESIS') AND text IS NOT NULL;

-- Create new cards table with clean schema
CREATE TABLE cards_new (
    id TEXT PRIMARY KEY,
    contentId TEXT NOT NULL,
    type TEXT NOT NULL, -- FLASHCARD, QUIZ, SUMMARY only
    title TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    
    -- Type-specific fields
    quiz TEXT, -- JSON: { question, choices, correctAnswer, explanation } for QUIZ cards
    front TEXT, -- Front of flashcard for FLASHCARD cards
    back TEXT, -- Back of flashcard for FLASHCARD cards
    
    -- Simplified Learning System fields
    chapterId TEXT,
    sourceChunks TEXT DEFAULT '[]',
    sourceCards TEXT DEFAULT '[]',
    
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
    FOREIGN KEY (chapterId) REFERENCES chapters(id)
);

-- Copy data to new table, converting types as needed
INSERT INTO cards_new (
    id, contentId, type, title, "order", quiz, front, back, 
    chapterId, sourceChunks, sourceCards, createdAt, updatedAt
)
SELECT 
    id, 
    contentId, 
    CASE 
        WHEN type = 'SYNTHESIS' THEN 'SUMMARY' -- Convert SYNTHESIS to SUMMARY
        WHEN type = 'APPLICATION' THEN 'SUMMARY' -- Convert APPLICATION to SUMMARY (will be moved to AI tutor later)
        ELSE type 
    END as type,
    title, 
    "order", 
    quiz, 
    CASE 
        WHEN type = 'FLASHCARD' THEN front
        WHEN type IN ('SUMMARY', 'SYNTHESIS', 'APPLICATION') AND front IS NULL THEN SUBSTR(COALESCE(text, title), 1, 100) -- Generate front from content
        ELSE front
    END as front,
    CASE 
        WHEN type = 'FLASHCARD' THEN back
        WHEN type IN ('SUMMARY', 'SYNTHESIS', 'APPLICATION') AND back IS NULL THEN COALESCE(text, 'Summary content') -- Use text as back
        ELSE back
    END as back,
    chapterId, 
    sourceChunks, 
    sourceCards, 
    createdAt, 
    updatedAt
FROM cards;

-- Drop old table and rename new one
DROP TABLE cards;
ALTER TABLE cards_new RENAME TO cards;

-- Step 2: Update ChapterProgress table for simplified card types
-- Remove APPLICATION fields, rename SYNTHESIS to SUMMARY
ALTER TABLE chapter_progress RENAME TO chapter_progress_old;

CREATE TABLE chapter_progress (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    chapterId TEXT NOT NULL,
    
    flashcardsCompleted INTEGER DEFAULT 0,
    flashcardsTotal INTEGER DEFAULT 0,
    quizzesCompleted INTEGER DEFAULT 0,
    quizzesTotal INTEGER DEFAULT 0,
    summariesCompleted INTEGER DEFAULT 0, -- Renamed from synthesisCompleted
    summariesTotal INTEGER DEFAULT 1, -- Usually 1 summary per chapter
    
    completionPercentage REAL DEFAULT 0.0,
    lastAccessed TEXT,
    
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chapterId) REFERENCES chapters(id) ON DELETE CASCADE,
    
    UNIQUE(userId, chapterId)
);

-- Copy data from old table, converting fields
INSERT INTO chapter_progress (
    id, userId, chapterId, 
    flashcardsCompleted, flashcardsTotal,
    quizzesCompleted, quizzesTotal,
    summariesCompleted, summariesTotal,
    completionPercentage, lastAccessed,
    createdAt, updatedAt
)
SELECT 
    id, userId, chapterId,
    flashcardsCompleted, flashcardsTotal,
    quizzesCompleted, quizzesTotal,
    CASE WHEN synthesisCompleted = 1 THEN 1 ELSE 0 END as summariesCompleted, -- Convert boolean to integer
    1 as summariesTotal, -- Default 1 summary per chapter
    completionPercentage, lastAccessed,
    createdAt, updatedAt
FROM chapter_progress_old;

-- Drop old table
DROP TABLE chapter_progress_old;

-- Step 3: Update Content.enabledCardTypes to reflect new system
UPDATE content SET enabledCardTypes = '["FLASHCARD", "QUIZ", "SUMMARY"]';

COMMIT;