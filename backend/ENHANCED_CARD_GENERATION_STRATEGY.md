# Enhanced Learning Card Generation Strategy

## Overview
This document outlines our strategy for generating high-quality learning cards from books using advanced RAG techniques, knowledge graphs, and educational optimization.

## Current Limitations
- Single chunk processing misses cross-chapter relationships
- No semantic understanding of concept connections
- Limited context for card generation
- No educational optimization for spaced repetition

## Proposed Solution: Graph RAG + Semantic Processing

### 1. Advanced Chunking Strategy

#### Semantic Chunking
- **Concept-Aware Splitting**: Respect chapter/section boundaries
- **Overlapping Windows**: 200-word overlap between chunks for context continuity
- **Entity-Boundary Detection**: Split at natural concept boundaries, not arbitrary word counts
- **Multi-Level Chunking**: Paragraph → Section → Chapter levels

#### Implementation Details
```
Chunk Size: 2000-3500 words (flexible based on semantic boundaries)
Overlap: 200 words between consecutive chunks
Metadata: Entities, concepts, chapter info, difficulty indicators
```

### 2. Knowledge Graph Construction

#### Entity Extraction
- **Named Entity Recognition**: People, places, concepts, technical terms
- **Relationship Mapping**: How entities connect across chapters
- **Importance Scoring**: TF-IDF + position-based weighting
- **Context Preservation**: Store surrounding context for each entity

#### Relationship Detection
- **Co-occurrence Analysis**: Entities appearing in same/nearby chunks
- **Semantic Similarity**: Using embeddings to find related concepts
- **Cross-Reference Tracking**: Explicit mentions across chapters
- **Hierarchical Relationships**: Parent-child concept structures

### 3. Graph RAG Implementation

#### Multi-Hop Retrieval
- **Primary Chunk**: Main content for the card
- **Related Chunks**: Connected through knowledge graph
- **Context Expansion**: Include 2-3 most relevant related chunks
- **Relationship Explanation**: Why chunks are connected

#### Context Assembly
```
Card Generation Input:
1. Primary chunk (main concept)
2. 2-3 related chunks (cross-references)
3. Entity relationship data
4. Concept hierarchy position
5. Educational metadata
```

### 4. Card Generation Strategies

#### Strategy 1: Entity-Focused Cards
- **Target**: Important entities/concepts from knowledge graph
- **Context**: All chunks where entity appears + related entities
- **Card Type**: "What is X and how does it relate to Y?"
- **Educational Focus**: Comprehensive understanding of key concepts

#### Strategy 2: Relationship Cards
- **Target**: Strong relationships between entities
- **Context**: Chunks showing the relationship + examples
- **Card Type**: "How does X connect to Y?"
- **Educational Focus**: Understanding concept connections

#### Strategy 3: Synthesis Cards
- **Target**: Concepts that span multiple chapters
- **Context**: Representative chunks from different sections
- **Card Type**: "How does the book's treatment of X evolve?"
- **Educational Focus**: Big-picture understanding

#### Strategy 4: Application Cards
- **Target**: Practical implications and examples
- **Context**: Theory chunks + application chunks
- **Card Type**: "How would you apply X in situation Y?"
- **Educational Focus**: Transfer and application

### 5. Educational Optimization

#### Spaced Repetition Integration
- **Difficulty Assessment**: Based on concept complexity and relationships
- **Review Priority**: Important concepts get higher priority
- **Cognitive Load**: Limit concepts per card (4±1 rule)
- **Progressive Disclosure**: Simple → complex concept introduction

#### Learning Science Principles
- **Semantic Processing**: Focus on meaning, not memorization
- **Retrieval Practice**: Question-based rather than statement-based
- **Elaboration**: Connect to prior knowledge and other concepts
- **Generation Effect**: Ask learners to explain relationships

### 6. Content Processing Pipeline

```
1. Text Extraction → Enhanced PDF/EPUB/HTML extraction
2. Semantic Chunking → Concept-aware splitting with overlap
3. Entity Extraction → NER + concept identification
4. Knowledge Graph → Build relationships and importance scores
5. Context Assembly → Multi-chunk context for each card
6. Card Generation → AI-powered with educational prompts
7. Educational Optimization → Difficulty, priority, cognitive load
8. Quality Filtering → Remove duplicates, ensure minimum quality
```

### 7. Implementation Architecture

#### Core Components
- **EnhancedTextExtractor**: PDF/EPUB/HTML with metadata
- **SemanticChunker**: Concept-aware chunking with overlap
- **KnowledgeGraphBuilder**: Entity extraction and relationship mapping
- **GraphRAGRetriever**: Multi-chunk context assembly
- **EducationalCardGenerator**: AI-powered card creation
- **LearningOptimizer**: Educational science-based optimization

#### Data Flow
```
Book File → Text + Metadata → Semantic Chunks → Knowledge Graph → 
Context Assembly → Card Generation → Educational Optimization → 
Quality Filtering → Final Cards
```

### 8. Content Type Support

#### PDF Processing
- **Text Extraction**: pdf-parse with OCR fallback
- **Structure Detection**: Chapter/section identification
- **Metadata Preservation**: Page numbers, hierarchy

#### EPUB Processing
- **Chapter-Aware**: Respect book structure
- **HTML Cleaning**: Remove formatting artifacts
- **Navigation Preservation**: TOC and cross-references

#### HTML/Article Processing
- **Content Extraction**: Main content vs navigation/ads
- **Link Preservation**: Cross-references and citations
- **Media Handling**: Images, tables, code blocks

### 9. Quality Metrics

#### Card Quality Assessment
- **Concept Density**: Number of key concepts per card
- **Relationship Richness**: Cross-references and connections
- **Educational Value**: Alignment with learning objectives
- **Cognitive Load**: Complexity appropriate for difficulty level

#### Success Metrics
- **Retention Rate**: Spaced repetition performance
- **Comprehension Score**: Understanding vs memorization
- **Transfer Success**: Application to new contexts
- **User Engagement**: Completion rates and feedback

### 10. Technical Considerations

#### Performance
- **Caching Strategy**: Cache knowledge graphs and processed chunks
- **Batch Processing**: Handle large books efficiently
- **Memory Management**: Stream processing for large files

#### Scalability
- **Modular Design**: Each component independently scalable
- **Database Optimization**: Efficient storage of graphs and relationships
- **API Rate Limiting**: Manage AI service costs

#### Quality Control
- **Duplicate Detection**: Semantic similarity-based deduplication
- **Content Validation**: Ensure cards meet educational standards
- **Feedback Loop**: Learn from user interactions

## Research Questions to Address

1. **Optimal Chunk Size**: What's the best balance between context and processing efficiency?
2. **Relationship Weighting**: How to score entity relationships for importance?
3. **Educational Effectiveness**: Which card types produce best learning outcomes?
4. **Cross-Book Knowledge**: How to handle concepts that span multiple books?
5. **Personalization**: How to adapt cards to individual learning styles?

## Next Steps

1. **Research Integration**: Add your research findings to this strategy
2. **Prototype Development**: Start with core components
3. **Testing Framework**: Create evaluation metrics and test data
4. **Iterative Improvement**: Refine based on results
5. **User Validation**: Test with real learners and books

---

*This strategy document will be updated as we incorporate additional research and implementation learnings.*