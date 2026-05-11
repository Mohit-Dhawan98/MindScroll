import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function approveContentForGlobal() {
  const prisma = new PrismaClient();
  
  // Get content IDs from command line arguments
  const contentIds = process.argv.slice(2);
  
  if (contentIds.length === 0) {
    console.log('📚 Admin Content Approval Tool');
    console.log('');
    console.log('Usage: node admin-approve-content.js <contentId1> <contentId2> ...');
    console.log('');
    console.log('Examples:');
    console.log('  node admin-approve-content.js cm123abc cm456def');
    console.log('  node admin-approve-content.js --list-pending');
    console.log('  node admin-approve-content.js --approve-all');
    console.log('  node admin-approve-content.js --revoke cm123abc');
    console.log('');
    process.exit(0);
  }
  
  try {
    console.log('🔧 Admin Content Approval Tool');
    console.log('');
    
    // Handle special commands
    if (contentIds[0] === '--list-pending') {
      await listPendingContent(prisma);
      return;
    }
    
    if (contentIds[0] === '--approve-all') {
      await approveAllPending(prisma);
      return;
    }
    
    if (contentIds[0] === '--revoke') {
      await revokeApproval(prisma, contentIds.slice(1));
      return;
    }
    
    // Regular approval process
    console.log(`📋 Processing ${contentIds.length} content ID(s)...`);
    
    let approved = 0;
    let failed = 0;
    
    for (const contentId of contentIds) {
      try {
        // First check if content exists and is user-uploaded
        const content = await prisma.content.findUnique({
          where: { id: contentId },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });
        
        if (!content) {
          console.log(`❌ Content ${contentId} not found`);
          failed++;
          continue;
        }
        
        if (content.source !== 'USER_UPLOADED') {
          console.log(`⚠️  Content ${contentId} is not user-uploaded (source: ${content.source}), skipping`);
          continue;
        }
        
        if (content.approvedForGlobal) {
          console.log(`✅ Content "${content.title}" is already approved for global library`);
          continue;
        }
        
        // Approve the content
        await prisma.content.update({
          where: { id: contentId },
          data: { approvedForGlobal: true }
        });
        
        console.log(`✅ Approved "${content.title}" by ${content.owner?.name || 'Unknown'} for global library`);
        approved++;
        
      } catch (error) {
        console.log(`❌ Failed to approve ${contentId}: ${error.message}`);
        failed++;
      }
    }
    
    console.log('');
    console.log('📊 Approval Summary:');
    console.log(`   ✅ Approved: ${approved}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📚 Total processed: ${contentIds.length}`);
    
    if (approved > 0) {
      console.log('');
      console.log('🎉 Content approval completed successfully!');
      console.log('💡 These books are now visible in the global library for all users.');
    }
    
  } catch (error) {
    console.error('❌ Approval process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function listPendingContent(prisma) {
  console.log('📋 Listing pending user content awaiting approval...');
  console.log('');
  
  const pendingContent = await prisma.content.findMany({
    where: {
      source: 'USER_UPLOADED',
      approvedForGlobal: false,
      isActive: true,
      totalCards: { gt: 0 }
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      _count: {
        select: { cards: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  if (pendingContent.length === 0) {
    console.log('✨ No pending content found!');
    return;
  }
  
  console.log(`📚 Found ${pendingContent.length} pending content item(s):`);
  console.log('');
  
  pendingContent.forEach((content, index) => {
    console.log(`${index + 1}. 📖 "${content.title}"`);
    console.log(`   ID: ${content.id}`);
    console.log(`   Author: ${content.author || 'Unknown'}`);
    console.log(`   Uploaded by: ${content.owner?.name || 'Unknown'} (${content.owner?.email || 'No email'})`);
    console.log(`   Cards: ${content._count.cards}`);
    console.log(`   Category: ${content.category || 'Uncategorized'}`);
    console.log(`   Created: ${content.createdAt.toLocaleDateString()}`);
    console.log('');
  });
  
  console.log('💡 To approve content, run:');
  console.log(`   node admin-approve-content.js ${pendingContent.map(c => c.id).join(' ')}`);
}

async function approveAllPending(prisma) {
  console.log('🚀 Approving ALL pending user content...');
  console.log('');
  
  const result = await prisma.content.updateMany({
    where: {
      source: 'USER_UPLOADED',
      approvedForGlobal: false,
      isActive: true,
      totalCards: { gt: 0 }
    },
    data: {
      approvedForGlobal: true
    }
  });
  
  console.log(`✅ Approved ${result.count} content item(s) for global library`);
  console.log('🎉 All pending user content is now available in the global library!');
}

async function revokeApproval(prisma, contentIds) {
  console.log('🔒 Revoking global library approval...');
  console.log('');
  
  let revoked = 0;
  let failed = 0;
  
  for (const contentId of contentIds) {
    try {
      const content = await prisma.content.findUnique({
        where: { id: contentId },
        select: { id: true, title: true, approvedForGlobal: true, source: true }
      });
      
      if (!content) {
        console.log(`❌ Content ${contentId} not found`);
        failed++;
        continue;
      }
      
      if (!content.approvedForGlobal) {
        console.log(`⚠️  Content "${content.title}" is already not approved`);
        continue;
      }
      
      await prisma.content.update({
        where: { id: contentId },
        data: { approvedForGlobal: false }
      });
      
      console.log(`🔒 Revoked approval for "${content.title}"`);
      revoked++;
      
    } catch (error) {
      console.log(`❌ Failed to revoke ${contentId}: ${error.message}`);
      failed++;
    }
  }
  
  console.log('');
  console.log('📊 Revocation Summary:');
  console.log(`   🔒 Revoked: ${revoked}`);
  console.log(`   ❌ Failed: ${failed}`);
}

approveContentForGlobal();