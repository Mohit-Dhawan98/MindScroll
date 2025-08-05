# Content Processor Architecture Roadmap

## 🎯 Vision
Build a comprehensive content processing system that can handle any type of learning material - books, research papers, articles, videos, audio, and more - while leveraging the robust chapter detection and AI-powered card generation system already built for books.

## 📋 Current State (Phase 0 - Complete)
- ✅ **Book Processor**: Advanced PDF/EPUB processing with AI-based TOC detection and chapter mapping
- ✅ **Semantic Chunking**: Chapter-aware content chunking with embedding generation
- ✅ **AI Card Generation**: Multi-tier card generation (summaries, flashcards, quizzes)
- ✅ **Bulk Processing**: Parallel book processing with error handling
- ✅ **Dual AI Support**: OpenAI GPT-4.1-mini and Anthropic Claude integration

## 🚀 Roadmap Phases

### Phase 1: Content Type Detection & Base Architecture (2-3 weeks)
**Goal**: Create modular architecture that leverages existing book processing infrastructure

#### 1.1 Content Type Detection System
```javascript
// Auto-detect content type from:
- File extensions (.pdf, .epub, .mp3, .mp4, .html)
- URL patterns (youtube.com, arxiv.org, medium.com)
- Content analysis (abstract = paper, chapters = book, timestamps = video)
- MIME types and metadata
```

#### 1.2 Base Processor Architecture
```
processors/
├── base/
│   ├── BaseProcessor.js           // Abstract base class
│   ├── ContentTypeDetector.js     // Auto-detection logic
│   └── ProcessorFactory.js        // Factory pattern for processor creation
├── BookProcessor.js               // Current enhanced system (refactored)
├── ResearchPaperProcessor.js      // Extends BaseProcessor
├── ArticleProcessor.js            // Extends BaseProcessor
└── VideoProcessor.js              // Extends BaseProcessor
```

### Phase 2: Research Paper Processing (3-4 weeks)
**Goal**: Academic paper processing with citation extraction and section detection

#### 2.1 Research Paper Features
- **Abstract Extraction**: AI-powered abstract identification and summarization
- **Section Detection**: Introduction, Methods, Results, Discussion, Conclusion
- **Citation Processing**: Reference extraction and linking
- **Figure/Table Extraction**: Mathematical formulas and visual content
- **Author/Venue Recognition**: Metadata extraction

#### 2.2 Reuse Book Infrastructure
- ✅ **AI Chapter Detection** → **AI Section Detection**
- ✅ **Semantic Chunking** → **Section-aware Chunking**
- ✅ **Card Generation** → **Academic Card Generation** (terminology, concepts, findings)

### Phase 3: Article & Web Content Processing (2-3 weeks)
**Goal**: Web articles, blog posts, and documentation processing

#### 3.1 Article Features
- **Headline Hierarchy**: H1, H2, H3 structure detection
- **Author/Date Extraction**: Publication metadata
- **Link Processing**: External reference handling
- **Tag/Category Inference**: Content classification

#### 3.2 Reuse Book Infrastructure
- ✅ **Chapter Detection** → **Section Detection** (headlines)
- ✅ **TOC Processing** → **Navigation Menu Processing**
- ✅ **Semantic Chunking** → **Paragraph-based Chunking**

### Phase 4: Video Content Processing (4-5 weeks)
**Goal**: YouTube videos, online courses, and video lectures

#### 4.1 Video Features
- **Transcript Extraction**: YouTube API + Whisper API fallback
- **Timestamp Segmentation**: Chapter markers and topic changes
- **Speaker Identification**: Multiple speaker handling
- **Visual Content**: Slide detection and OCR
- **Auto-Generated Chapters**: AI-based topic segmentation

#### 4.2 Reuse Book Infrastructure
- ✅ **Chapter Detection** → **Segment Detection** (topic changes)
- ✅ **AI Processing** → **Transcript Analysis**
- ✅ **Card Generation** → **Video-based Cards** (concepts, key points, quotes)

### Phase 5: Audio Content Processing (3-4 weeks)
**Goal**: Audiobooks, podcasts, and audio lectures

#### 5.1 Audio Features
- **Speech-to-Text**: Whisper API integration
- **Speaker Diarization**: Multiple speaker identification
- **Chapter Detection**: Audio markers and silence patterns
- **Quality Enhancement**: Noise reduction and normalization

#### 5.2 Reuse Book Infrastructure
- ✅ **Chapter Detection** → **Audio Chapter Detection**
- ✅ **Semantic Processing** → **Transcript Processing**
- ✅ **Card Generation** → **Audio-based Cards**

### Phase 6: Universal Content Processor (2-3 weeks)
**Goal**: Single interface for all content types

#### 6.1 Unified API
```javascript
// Universal content processing
const processor = await ContentProcessorFactory.create(source, options)
const result = await processor.process()

// Auto-detection with override
const result = await processContent(source, { 
  type: 'auto', // or 'book', 'paper', 'article', 'video', 'audio'
  category: 'technology',
  provider: 'openai'
})
```

#### 6.2 Advanced Features
- **Cross-Content Linking**: References between different content types
- **Content Collections**: Group related materials (course modules)
- **Quality Scoring**: Content quality assessment
- **Duplicate Detection**: Avoid processing same content twice

## 🏗️ High-Level Design (HLD)

### System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Content Ingestion Layer                  │
├─────────────────────────────────────────────────────────────┤
│  File Upload  │  URL Fetcher  │  API Integrations  │ Bulk   │
│   (PDF/EPUB)  │  (Web/Video)  │ (YouTube/Academia) │Process │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Content Type Detection Layer                 │
├─────────────────────────────────────────────────────────────┤
│  File Analysis  │  URL Pattern  │  Content Analysis  │ User │
│  (Extension/MIME) │  Matching   │   (AI-based)      │Override│
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Processor Selection Layer                   │
├─────────────────────────────────────────────────────────────┤
│   Book      │  Research  │  Article   │  Video   │ Audio   │
│ Processor   │   Paper    │ Processor  │Processor │Processor│
│             │ Processor  │            │          │         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Shared Processing Infrastructure               │
├─────────────────────────────────────────────────────────────┤
│  Structure   │  AI-Powered │  Semantic  │   Card    │ Vector│
│  Detection   │  Analysis   │  Chunking  │Generation │ Store │
│ (TOC/Sections│ (GPT/Claude)│            │           │       │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage & Retrieval Layer                │
├─────────────────────────────────────────────────────────────┤
│   Database   │ File Storage │  Cache     │  Vector   │ Index│
│  (Metadata)  │ (Content)    │ (Processed)│Embeddings │      │
└─────────────────────────────────────────────────────────────┘
```

### Shared Components (Leverage Existing Book Infrastructure)
1. **AI Processing Engine**: Reuse OpenAI/Anthropic integration
2. **Semantic Chunking**: Adapt for different content structures
3. **Card Generation**: Extend existing card types
4. **Vector Store**: Reuse embedding infrastructure
5. **File Storage**: Extend current caching system
6. **Bulk Processing**: Adapt parallel processing framework

## 🔧 Low-Level Design (LLD)

### Base Processor Architecture
```javascript
// Abstract base class
class BaseProcessor {
  constructor(aiProvider = 'openai') {
    this.aiProvider = aiProvider
    this.initialized = false
  }

  // Abstract methods (must be implemented by subclasses)
  async detectStructure(content) { throw new Error('Not implemented') }
  async extractMetadata(content) { throw new Error('Not implemented') }
  async createChunks(structure) { throw new Error('Not implemented') }
  
  // Shared methods (inherited from book processor)
  async generateCards(chunks, metadata) { /* Reuse existing logic */ }
  async buildVectorStore(chunks) { /* Reuse existing logic */ }
  async callAI(prompt) { /* Reuse existing logic */ }
}

// Concrete implementations
class BookProcessor extends BaseProcessor {
  async detectStructure(content) {
    // Existing TOC detection + chapter mapping logic
    return await this.detectBookStructure(content)
  }
}

class ResearchPaperProcessor extends BaseProcessor {
  async detectStructure(content) {
    // Abstract + sections detection (reuse AI detection patterns)
    return await this.detectPaperStructure(content)
  }
}
```

### Content Type Detection
```javascript
class ContentTypeDetector {
  static async detect(source, options = {}) {
    // 1. User override
    if (options.type && options.type !== 'auto') {
      return options.type
    }
    
    // 2. File extension analysis
    const fileType = this.detectFromFile(source)
    if (fileType) return fileType
    
    // 3. URL pattern matching
    const urlType = this.detectFromURL(source)
    if (urlType) return urlType
    
    // 4. AI-based content analysis
    return await this.detectFromContent(source)
  }
  
  static detectFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const mapping = {
      '.pdf': this.isPaper(filePath) ? 'paper' : 'book',
      '.epub': 'book',
      '.mp4': 'video',
      '.mp3': 'audio',
      '.html': 'article'
    }
    return mapping[ext]
  }
  
  static detectFromURL(url) {
    const patterns = {
      'youtube.com': 'video',
      'youtu.be': 'video',
      'arxiv.org': 'paper',
      'pubmed.ncbi.nlm.nih.gov': 'paper',
      'medium.com': 'article',
      'dev.to': 'article'
    }
    
    for (const [pattern, type] of Object.entries(patterns)) {
      if (url.includes(pattern)) return type
    }
    return null
  }
}
```

### Processor Factory
```javascript
class ProcessorFactory {
  static async create(contentType, options = {}) {
    const processors = {
      'book': () => new BookProcessor(options.aiProvider),
      'paper': () => new ResearchPaperProcessor(options.aiProvider),
      'article': () => new ArticleProcessor(options.aiProvider),
      'video': () => new VideoProcessor(options.aiProvider),
      'audio': () => new AudioProcessor(options.aiProvider)
    }
    
    const processor = processors[contentType]?.()
    if (!processor) {
      throw new Error(`Unsupported content type: ${contentType}`)
    }
    
    await processor.initialize()
    return processor
  }
}
```

## 🧪 Testing Strategy
1. **Unit Tests**: Each processor type with sample content
2. **Integration Tests**: End-to-end processing workflows
3. **Performance Tests**: Large file processing and parallel execution
4. **Quality Tests**: Card generation quality assessment

## 📊 Success Metrics
- **Coverage**: Support for 5+ content types
- **Quality**: 90%+ successful processing rate
- **Performance**: <2 minutes average processing time
- **Scalability**: Handle 100+ concurrent processes
- **Reusability**: 80%+ code reuse from book processor

## 🔄 Migration Strategy
1. **Phase 1**: Refactor existing book processor to use base architecture
2. **Phase 2**: Implement new processors one by one
3. **Phase 3**: Gradual rollout with A/B testing
4. **Phase 4**: Full migration and legacy cleanup

## 📅 Timeline
- **Total Duration**: 16-20 weeks
- **Phase 1**: Weeks 1-3 (Architecture)
- **Phase 2**: Weeks 4-7 (Research Papers)
- **Phase 3**: Weeks 8-10 (Articles)
- **Phase 4**: Weeks 11-15 (Video)
- **Phase 5**: Weeks 16-19 (Audio)
- **Phase 6**: Weeks 20 (Universal Interface)

## 🚧 Risk Mitigation
- **Content Quality**: Implement validation and quality scoring
- **API Limits**: Rate limiting and quota management
- **Processing Failures**: Robust error handling and retry logic
- **Storage Costs**: Efficient caching and cleanup strategies
- **Performance**: Optimize chunking and embedding generation

This roadmap leverages 80% of the existing book processing infrastructure while adding support for diverse content types. The modular design ensures maintainability and extensibility.

## 🎓 Learning System Integration

**See**: [Unified Learning System Design](./UNIFIED_LEARNING_SYSTEM_DESIGN.md)

The content processing roadmap is designed to integrate seamlessly with our adaptive learning system:

- **Concept Mapping**: All processors extract learning concepts and structure units
- **Card Generation**: Unified 4-tier card system (FLASHCARD → APPLICATION → QUIZ → SYNTHESIS)
- **Adaptive Routing**: Smart navigation based on user performance and content type
- **Content Flexibility**: Different content types enable different card types and learning flows

### **Content Type Learning Configurations**:
- **Books**: Chapter-based with full 4-tier progression
- **Research Papers**: Section-based with FLASHCARD + QUIZ + SYNTHESIS
- **Articles**: Topic-based with simplified FLASHCARD + QUIZ progression  
- **Videos**: Segment-based with timestamp navigation and 3-tier progression
- **Audio**: Segment-based with transcript sync and concept-focused learning

This ensures consistent learning experiences across all content types while leveraging content-specific features and optimizations.