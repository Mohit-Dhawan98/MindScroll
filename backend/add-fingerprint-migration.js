import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function addFingerprintColumn() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Adding fingerprint column to content_uploads table...');
    
    // Add fingerprint column using raw SQL
    await prisma.$executeRaw`
      ALTER TABLE "content_uploads" 
      ADD COLUMN IF NOT EXISTS "fingerprint" TEXT NULL;
    `;
    
    console.log('✅ Fingerprint column added successfully');
    
    // Add index for fast duplicate lookups
    console.log('📇 Creating index on fingerprint column...');
    
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "content_uploads_fingerprint_idx" 
        ON "content_uploads" ("fingerprint");
      `;
      console.log('✅ Index created successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Index already exists, skipping...');
      } else {
        throw error;
      }
    }
    
    // Check the table structure
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'content_uploads'
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📋 ContentUpload table structure:');
    console.table(columns);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 PDF fingerprinting is now enabled for duplicate detection');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addFingerprintColumn();