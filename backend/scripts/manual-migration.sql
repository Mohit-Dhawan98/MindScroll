-- Add userId and approvedForGlobal columns to Content table
ALTER TABLE "Content" 
ADD COLUMN "userId" TEXT NULL,
ADD COLUMN "approvedForGlobal" BOOLEAN NOT NULL DEFAULT false;

-- Create foreign key constraint
ALTER TABLE "Content" 
ADD CONSTRAINT "Content_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mark all existing content as approved for global library
UPDATE "Content" SET "approvedForGlobal" = true WHERE "userId" IS NULL;