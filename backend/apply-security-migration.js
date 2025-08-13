import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function applySecurityMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Applying database security migration...');
    
    // Step 1: Add the new columns using raw SQL
    console.log('📋 Adding userId and approvedForGlobal columns...');
    
    await prisma.$executeRaw`
      ALTER TABLE "content" 
      ADD COLUMN IF NOT EXISTS "userId" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "approvedForGlobal" BOOLEAN NOT NULL DEFAULT false;
    `;
    
    console.log('✅ Columns added successfully');
    
    // Step 2: Add foreign key constraint
    console.log('🔗 Adding foreign key constraint...');
    
    try {
      await prisma.$executeRaw`
        ALTER TABLE "content" 
        ADD CONSTRAINT "Content_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Foreign key constraint already exists, skipping...');
      } else {
        throw error;
      }
    }
    
    console.log('✅ Foreign key constraint ready');
    
    // Step 3: Mark all existing content as approved global library content
    console.log('📚 Marking existing content as global library...');
    
    const updateResult = await prisma.$executeRaw`
      UPDATE "content" 
      SET "approvedForGlobal" = true 
      WHERE "userId" IS NULL;
    `;
    
    console.log(`✅ Updated existing content as approved global library`);
    
    // Step 4: Verify the changes
    const totalContent = await prisma.content.count();
    const globalContent = await prisma.content.count({
      where: { approvedForGlobal: true }
    });
    
    console.log('📊 Migration Summary:');
    console.log(`   Total content items: ${totalContent}`);
    console.log(`   Global library items: ${globalContent}`);
    console.log(`   User uploads (private): ${totalContent - globalContent}`);
    
    console.log('🎉 Security migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applySecurityMigration();