import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function fixExistingContent() {
  try {
    console.log('🔧 Applying security fixes to existing content...');
    
    // First, let's see what content we have
    const allContent = await prisma.content.findMany({
      select: { id: true, title: true, source: true }
    });
    
    console.log(`📚 Found ${allContent.length} existing content items`);
    
    // Mark all existing content as approved for global library
    // This assumes current content is curated/safe
    const updateResult = await prisma.content.updateMany({
      where: {
        // Only update content that doesn't already have these fields
        userId: null
      },
      data: {
        approvedForGlobal: true,
        // Leave userId as null for curated content
      }
    });
    
    console.log(`✅ Updated ${updateResult.count} content items as approved global content`);
    console.log('✅ Security migration completed!');
    
    // Verify the changes
    const globalContent = await prisma.content.count({
      where: { approvedForGlobal: true }
    });
    
    console.log(`📊 Total approved global content: ${globalContent}`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixExistingContent();