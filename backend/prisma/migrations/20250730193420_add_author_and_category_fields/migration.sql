-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_content" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "difficulty" TEXT NOT NULL DEFAULT 'BEGINNER',
    "topics" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "estimatedTime" INTEGER NOT NULL,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_content" ("createdAt", "description", "difficulty", "estimatedTime", "id", "isAiGenerated", "source", "sourceType", "sourceUrl", "tags", "title", "topics", "type", "updatedAt") SELECT "createdAt", "description", "difficulty", "estimatedTime", "id", "isAiGenerated", "source", "sourceType", "sourceUrl", "tags", "title", "topics", "type", "updatedAt" FROM "content";
DROP TABLE "content";
ALTER TABLE "new_content" RENAME TO "content";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
