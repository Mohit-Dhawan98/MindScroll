# MindScroll Content Management System

## 🏗️ **Two-Tier Content Architecture**

### **📚 Static Library Content (Curated)**
- **Purpose**: High-quality, professionally curated books available to all users
- **Management**: Offline, manual process with quality control
- **Source**: PDF/EPUB books added by content team
- **Processing**: Batch processing via scheduled scripts

### **📤 User Upload Content (Personal)**  
- **Purpose**: Personal content processing for individual users
- **Management**: Real-time processing when users upload
- **Source**: User-uploaded PDFs, articles, URLs
- **Processing**: On-demand via upload API

---

## 📁 **Directory Structure**

```
📁 content-library-pending/          # Books waiting to be processed
├── 📁 technology/                   # Drop PDFs here for processing
├── 📁 business/
├── 📁 science/
├── 📁 personal-development/
├── 📁 economics/
├── 📁 health/
├── 📁 history/
├── 📁 philosophy/
└── 📁 arts/

📁 content-library-processed/        # Successfully processed books
├── 📁 technology/                   # Moved here after processing
├── 📁 business/
└── 📁 _errors/                      # Failed processing attempts

📁 content-library/                  # OLD - No longer monitored
└── 📄 README.md                     # Legacy documentation
```

---

## 🔄 **Library Content Workflow**

### **1. Adding New Books**

**Manual (Single Book):**
```bash
cd backend
node scripts/library/addBook.js "path/to/book.pdf" "technology"
```

**Daily Batch (Recommended):**
```bash
# 1. Drop PDFs in pending folders with correct naming:
#    content-library-pending/technology/Robert Martin - Clean Code.pdf
#    content-library-pending/business/Eric Ries - The Lean Startup.pdf

# 2. Run daily processing script
npm run daily-update

# 3. Books automatically processed and moved to content-library-processed/
```

### **2. File Naming Convention**
```
[Author] - [Title].[ext]

✅ Good:
- Robert Martin - Clean Code.pdf  
- Eric Ries - The Lean Startup.epub
- Carl Sagan - Cosmos.pdf

❌ Bad:
- clean-code.pdf
- book1.pdf
- Eric_Ries_Lean_Startup.pdf
```

### **3. Daily Processing Schedule**
```bash
# Add to crontab for daily 2 AM processing:
0 2 * * * cd /Users/mohitdhawan/Microlearn/backend && npm run daily-update

# Or run manually:
npm run daily-update
```

---

## 📤 **User Upload Content**

### **API Endpoints:**
```bash
POST /api/upload/file          # Upload PDF/document
POST /api/upload/url           # Process article URL  
GET  /api/upload/my-content    # Get user's content
GET  /api/upload/status/:id    # Check processing status
```

### **Processing Flow:**
1. User uploads file or submits URL
2. Content extracted and processed immediately  
3. AI generates personalized learning cards
4. Cards saved to user's personal collection
5. Available in user's dashboard under "My Uploads"

---

## 🗄️ **Database Schema**

### **Library Content (Shared)**
```sql
content (id, title, author, category, source='LIBRARY', ...)
├── cards (contentId, title, content, difficulty, ...)
└── user_progress (userId, cardId, isKnown, nextReview, ...)
```

### **User Content (Personal)**  
```sql
user_content (id, userId, title, source, sourceType, status, ...)
├── user_cards (userContentId, userId, title, content, ...)
└── user_card_progress (userId, cardId, isKnown, nextReview, ...)
```

---

## 🛠️ **Available Scripts**

### **Backend Package.json Scripts:**
```bash
npm run daily-update          # Process pending library books
npm run add-sample            # Add sample content for testing
npm run add-book              # Add single book to library
```

### **Library Management Scripts:**
```bash
# Add single book
node scripts/library/addBook.js "book.pdf" "category"

# Daily batch processing  
node scripts/library/dailyContentUpdate.js

# Check library stats
node scripts/library/checkStats.js
```

---

## 📊 **Content Quality Control**

### **Library Content Standards:**
- ✅ High-quality, well-known books
- ✅ Proper author attribution  
- ✅ Clear text extraction (not scanned images)
- ✅ Appropriate category classification
- ✅ Manual review of generated cards

### **Processing Validation:**
- Minimum 100 characters extracted text
- At least 3 learning cards generated
- Valid difficulty assessment
- Proper metadata extraction

---

## 🚀 **Getting Started**

### **1. Set up the system:**
```bash
cd backend
npm install
```

### **2. Add your first book:**
```bash
# Option A: Drop in pending folder
cp "path/to/Clean Code.pdf" "content-library-pending/technology/Robert Martin - Clean Code.pdf"
npm run daily-update

# Option B: Add directly  
node scripts/library/addBook.js "path/to/book.pdf" "technology"
```

### **3. Verify in dashboard:**
- Start servers: `npm start` (backend) + `npm run dev` (frontend)
- Register/login at http://localhost:3000
- Check dashboard for new content

---

## 💡 **Benefits of This Architecture**

**✅ Quality Control**: Manual curation ensures high-quality library content  
**✅ Scalability**: Batch processing handles large content volumes efficiently  
**✅ User Privacy**: Personal uploads stay private to each user  
**✅ Flexibility**: Library team can control content without affecting users  
**✅ Performance**: No real-time file watching overhead  
**✅ Reliability**: Failed processing doesn't affect the entire system