import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate a unique fingerprint for a PDF file based on its content
 * This helps prevent duplicate uploads of the same PDF
 */
export function generatePDFFingerprint(buffer) {
  // Create a hash of the PDF content
  // Using SHA-256 for a reliable, collision-resistant fingerprint
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Check if a PDF with this fingerprint already exists in the database
 * @param {string} fingerprint - The SHA-256 hash of the PDF
 * @param {string} userId - The user attempting to upload
 * @returns {object|null} - Existing content if found, null otherwise
 */
export async function checkDuplicatePDF(fingerprint, userId) {
  try {
    // First check if this exact PDF has been uploaded before
    const existingUpload = await prisma.contentUpload.findFirst({
      where: {
        fingerprint: fingerprint
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            author: true,
            userId: true,
            approvedForGlobal: true,
            totalCards: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (existingUpload) {
      // Check if content was actually created (processing succeeded)
      const hasContent = existingUpload.content && existingUpload.content.totalCards > 0;
      
      if (hasContent) {
        // Processing succeeded - treat as successful duplicate
        if (existingUpload.userId === userId) {
          return {
            isDuplicate: true,
            isOwnUpload: true,
            message: 'You have already uploaded this PDF',
            content: existingUpload.content,
            uploadedBy: existingUpload.user
          };
        } else {
          // Different user uploaded this PDF
          // Check if it's available in global library
          if (existingUpload.content?.approvedForGlobal) {
            return {
              isDuplicate: true,
              isOwnUpload: false,
              isGloballyAvailable: true,
              message: 'This book is already available in the global library',
              content: existingUpload.content,
              uploadedBy: existingUpload.user
            };
          } else {
            // Another user uploaded but it's not globally available
            return {
              isDuplicate: true,
              isOwnUpload: false,
              isGloballyAvailable: false,
              message: 'This PDF has been uploaded by another user and is pending approval',
              content: null, // Don't expose private content
              uploadedBy: null // Don't expose user info for privacy
            };
          }
        }
      } else {
        // Processing failed or incomplete - allow retry for same user
        if (existingUpload.userId === userId) {
          console.log(`🔄 Allowing retry for failed upload ${existingUpload.id} (same user)`);
          return {
            isDuplicate: false,
            allowRetry: true,
            existingUploadId: existingUpload.id,
            message: 'Previous upload failed, retrying with existing record'
          };
        } else {
          // Different user - still block to prevent duplicate attempts
          return {
            isDuplicate: true,
            isOwnUpload: false,
            isGloballyAvailable: false,
            message: 'This PDF is currently being processed by another user',
            content: null,
            uploadedBy: null
          };
        }
      }
    }

    return null; // No duplicate found
  } catch (error) {
    console.error('Error checking for duplicate PDF:', error);
    return null; // In case of error, allow upload to proceed
  }
}

/**
 * Generate a content-based fingerprint that's more forgiving
 * This uses title + author to detect semantic duplicates
 */
export async function checkSemanticDuplicate(title, author, userId) {
  try {
    // Normalize title and author for comparison
    const normalizedTitle = title.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedAuthor = author.toLowerCase().trim().replace(/\s+/g, ' ');

    // Check for existing content with similar title and author
    const existingContent = await prisma.content.findFirst({
      where: {
        AND: [
          { title: { contains: normalizedTitle, mode: 'insensitive' } },
          { author: { contains: normalizedAuthor, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        title: true,
        author: true,
        userId: true,
        approvedForGlobal: true,
        totalCards: true
      }
    });

    if (existingContent) {
      // Check ownership and availability
      if (existingContent.userId === userId) {
        return {
          isDuplicate: true,
          isOwnContent: true,
          message: `You already have "${existingContent.title}" by ${existingContent.author} in your library`,
          content: existingContent
        };
      } else if (existingContent.approvedForGlobal) {
        return {
          isDuplicate: true,
          isOwnContent: false,
          isGloballyAvailable: true,
          message: `"${existingContent.title}" by ${existingContent.author} is already available in the global library`,
          content: existingContent
        };
      }
    }

    return null; // No semantic duplicate found
  } catch (error) {
    console.error('Error checking for semantic duplicate:', error);
    return null;
  }
}

export default {
  generatePDFFingerprint,
  checkDuplicatePDF,
  checkSemanticDuplicate
};