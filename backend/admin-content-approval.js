#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ANSI color codes for better output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

async function showPendingContent() {
  console.log(`\n${colors.cyan}${colors.bold}📋 PENDING USER CONTENT FOR APPROVAL${colors.reset}\n`);
  
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
    console.log(`${colors.yellow}⚠️  No pending content found for approval.${colors.reset}\n`);
    return;
  }

  console.log(`Found ${colors.bold}${pendingContent.length}${colors.reset} pending books:\n`);
  
  pendingContent.forEach((content, index) => {
    console.log(`${colors.bold}${index + 1}.${colors.reset} ${colors.green}${content.title}${colors.reset}`);
    console.log(`   ${colors.blue}ID:${colors.reset} ${content.id}`);
    console.log(`   ${colors.blue}Author:${colors.reset} ${content.author || 'Unknown'}`);
    console.log(`   ${colors.blue}Category:${colors.reset} ${content.category} | ${colors.blue}Difficulty:${colors.reset} ${content.difficulty}`);
    console.log(`   ${colors.blue}Cards:${colors.reset} ${content._count.cards} | ${colors.blue}Chapters:${colors.reset} ${content.totalChapters || 'N/A'}`);
    console.log(`   ${colors.blue}Uploaded by:${colors.reset} ${content.owner?.name || content.owner?.email || 'Unknown'} (${content.owner?.email})`);
    console.log(`   ${colors.blue}Created:${colors.reset} ${content.createdAt.toLocaleDateString()}`);
    console.log('');
  });
}

async function approveContent(contentId) {
  try {
    // First check if content exists and is eligible
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        owner: {
          select: { name: true, email: true }
        },
        _count: {
          select: { cards: true }
        }
      }
    });

    if (!content) {
      console.log(`${colors.red}❌ Content with ID '${contentId}' not found.${colors.reset}\n`);
      return false;
    }

    if (content.source !== 'USER_UPLOADED') {
      console.log(`${colors.red}❌ Content '${content.title}' is not user-uploaded (source: ${content.source}).${colors.reset}\n`);
      return false;
    }

    if (content.approvedForGlobal) {
      console.log(`${colors.yellow}⚠️  Content '${content.title}' is already approved for global library.${colors.reset}\n`);
      return false;
    }

    if (content.totalCards === 0 || content._count.cards === 0) {
      console.log(`${colors.red}❌ Content '${content.title}' has no cards and cannot be approved.${colors.reset}\n`);
      return false;
    }

    // Approve the content
    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: { approvedForGlobal: true }
    });

    console.log(`${colors.green}✅ SUCCESS: Approved '${content.title}' for global library!${colors.reset}`);
    console.log(`   ${colors.blue}Author:${colors.reset} ${content.author || 'Unknown'}`);
    console.log(`   ${colors.blue}Cards:${colors.reset} ${content._count.cards}`);
    console.log(`   ${colors.blue}Uploaded by:${colors.reset} ${content.owner?.name || content.owner?.email || 'Unknown'}`);
    console.log(`   ${colors.magenta}This book is now visible to all users in the global library.${colors.reset}\n`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Error approving content:${colors.reset}`, error.message);
    return false;
  }
}

async function revokeApproval(contentId) {
  try {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        owner: {
          select: { name: true, email: true }
        }
      }
    });

    if (!content) {
      console.log(`${colors.red}❌ Content with ID '${contentId}' not found.${colors.reset}\n`);
      return false;
    }

    if (!content.approvedForGlobal) {
      console.log(`${colors.yellow}⚠️  Content '${content.title}' is not currently approved for global library.${colors.reset}\n`);
      return false;
    }

    // Revoke approval
    await prisma.content.update({
      where: { id: contentId },
      data: { approvedForGlobal: false }
    });

    console.log(`${colors.yellow}🔒 REVOKED: Removed '${content.title}' from global library.${colors.reset}`);
    console.log(`   ${colors.magenta}This book is now private to the uploader only.${colors.reset}\n`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Error revoking approval:${colors.reset}`, error.message);
    return false;
  }
}

async function showApprovedContent() {
  console.log(`\n${colors.green}${colors.bold}✅ APPROVED USER CONTENT IN GLOBAL LIBRARY${colors.reset}\n`);
  
  const approvedContent = await prisma.content.findMany({
    where: {
      source: 'USER_UPLOADED',
      approvedForGlobal: true,
      isActive: true
    },
    include: {
      owner: {
        select: {
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

  if (approvedContent.length === 0) {
    console.log(`${colors.yellow}⚠️  No approved user content found in global library.${colors.reset}\n`);
    return;
  }

  console.log(`Found ${colors.bold}${approvedContent.length}${colors.reset} approved user books in global library:\n`);
  
  approvedContent.forEach((content, index) => {
    console.log(`${colors.bold}${index + 1}.${colors.reset} ${colors.green}${content.title}${colors.reset} ${colors.cyan}[GLOBAL]${colors.reset}`);
    console.log(`   ${colors.blue}ID:${colors.reset} ${content.id}`);
    console.log(`   ${colors.blue}Author:${colors.reset} ${content.author || 'Unknown'}`);
    console.log(`   ${colors.blue}Cards:${colors.reset} ${content._count.cards}`);
    console.log(`   ${colors.blue}Uploaded by:${colors.reset} ${content.owner?.name || content.owner?.email || 'Unknown'}`);
    console.log('');
  });
}

async function showUsage() {
  console.log(`
${colors.cyan}${colors.bold}🛠️  EPIGRAM CONTENT APPROVAL TOOL${colors.reset}

${colors.yellow}Usage:${colors.reset}
  ${colors.green}node admin-content-approval.js${colors.reset}                     Show this help
  ${colors.green}node admin-content-approval.js --pending${colors.reset}           List pending content
  ${colors.green}node admin-content-approval.js --approved${colors.reset}          List approved content
  ${colors.green}node admin-content-approval.js --approve <content-id>${colors.reset}    Approve content for global library
  ${colors.green}node admin-content-approval.js --revoke <content-id>${colors.reset}     Revoke global approval

${colors.yellow}Examples:${colors.reset}
  ${colors.blue}# List all content waiting for approval${colors.reset}
  node admin-content-approval.js --pending
  
  ${colors.blue}# Approve specific content by ID${colors.reset}
  node admin-content-approval.js --approve clm2x5f0y0000abc123def456
  
  ${colors.blue}# List all user content that's been approved for global library${colors.reset}
  node admin-content-approval.js --approved
  
  ${colors.blue}# Remove content from global library (make it private again)${colors.reset}
  node admin-content-approval.js --revoke clm2x5f0y0000abc123def456

${colors.yellow}Notes:${colors.reset}
- Only user-uploaded content with cards can be approved for global library
- Curated content is automatically available globally
- Approved content appears in the global "Discover" tab for all users
- Private content only appears in the uploader's "My Uploads" tab
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      await showUsage();
    } else if (args[0] === '--pending') {
      await showPendingContent();
    } else if (args[0] === '--approved') {
      await showApprovedContent();
    } else if (args[0] === '--approve') {
      if (args[1]) {
        const success = await approveContent(args[1]);
        process.exit(success ? 0 : 1);
      } else {
        console.log(`${colors.red}❌ Please provide a content ID to approve.${colors.reset}\n`);
        console.log(`${colors.yellow}Usage:${colors.reset} node admin-content-approval.js --approve <content-id>`);
        process.exit(1);
      }
    } else if (args[0] === '--revoke') {
      if (args[1]) {
        const success = await revokeApproval(args[1]);
        process.exit(success ? 0 : 1);
      } else {
        console.log(`${colors.red}❌ Please provide a content ID to revoke.${colors.reset}\n`);
        console.log(`${colors.yellow}Usage:${colors.reset} node admin-content-approval.js --revoke <content-id>`);
        process.exit(1);
      }
    } else {
      console.log(`${colors.red}❌ Unknown command: ${args[0]}${colors.reset}\n`);
      await showUsage();
      process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Fatal error:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();