-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "score" REAL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "isKnown" BOOLEAN NOT NULL DEFAULT false,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "difficulty" REAL NOT NULL DEFAULT 2.5,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReview" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_progress_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_progress" ("attempts", "cardId", "createdAt", "easeFactor", "id", "interval", "lastReviewed", "nextReview", "repetitions", "score", "status", "updatedAt", "userId") SELECT "attempts", "cardId", "createdAt", "easeFactor", "id", "interval", "lastReviewed", "nextReview", "repetitions", "score", "status", "updatedAt", "userId" FROM "user_progress";
DROP TABLE "user_progress";
ALTER TABLE "new_user_progress" RENAME TO "user_progress";
CREATE UNIQUE INDEX "user_progress_userId_cardId_key" ON "user_progress"("userId", "cardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
