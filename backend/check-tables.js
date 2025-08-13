import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function checkTables() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking database tables...');
    
    // Check if Content table exists and get its structure
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'content' OR table_name = 'Content'
      ORDER BY ordinal_position;
    `;
    
    console.log('📋 Content table structure:');
    console.log(tableInfo);
    
    // Check existing content
    const contentCount = await prisma.content.count();
    console.log(`📚 Total content items: ${contentCount}`);
    
    if (contentCount > 0) {
      const sampleContent = await prisma.content.findFirst({
        select: { 
          id: true, 
          title: true, 
          source: true,
          // Try to check if userId field exists
        }
      });
      console.log('📖 Sample content:', sampleContent);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();