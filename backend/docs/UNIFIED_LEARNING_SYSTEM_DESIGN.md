# Simplified Learning System Design (v1)

## 🎯 Vision
Create a simple, effective learning system that tracks chapter-level progress across all content types with basic card dependencies and tier-based progression.

## 🏗️ System Overview

### **Simplified Content Hierarchy**
```
Content (Book/Paper/Article/Video/Audio)
├── Chapters/Proxy Chapters (from chunks)
│   ├── FLASHCARD cards (foundation)
│   ├── APPLICATION cards (generated from flashcards) 
│   ├── QUIZ cards (generated from flashcards + applications)
│   └── SYNTHESIS cards (chapter summary)
└── Card Dependencies (which cards generated which)
```

### **Key Design Principles**
1. **Chapter-Level Tracking**: Every card maps to a chapter or proxy chapter
2. **Simple Progression**: Complete chapter flashcards → unlock applications → quiz → synthesis
3. **Card Dependencies**: Track which source cards were used to generate derived cards
4. **Content Flexibility**: All content types use same chapter-based approach
5. **Proxy Chapters**: Non-book content gets chapters from semantic chunks

## 📊 Simplified Database Schema

### **New Tables**

#### **Chapter Table** (simplified structure units)
```sql
CREATE TABLE chapters (
  id VARCHAR PRIMARY KEY,
  content_id VARCHAR,
  chapter_number INTEGER,
  chapter_title VARCHAR,
  source_chunks TEXT, -- JSON array of chunk IDs used
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (content_id) REFERENCES Content(id)
);
```

#### **ChapterProgress Table** (simplified progress tracking)
```sql
CREATE TABLE chapter_progress (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR,
  chapter_id VARCHAR,
  flashcards_completed INTEGER DEFAULT 0,
  flashcards_total INTEGER DEFAULT 0,
  applications_completed INTEGER DEFAULT 0,
  applications_total INTEGER DEFAULT 0,
  quizzes_completed INTEGER DEFAULT 0,
  quizzes_total INTEGER DEFAULT 0,
  synthesis_completed BOOLEAN DEFAULT FALSE,
  completion_percentage FLOAT DEFAULT 0.0,
  last_accessed TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES User(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  UNIQUE(user_id, chapter_id)
);
```

### **Enhanced Existing Tables**

#### **Card Table Additions**
```sql
ALTER TABLE Card ADD COLUMN chapter_id VARCHAR; -- Links to chapter
ALTER TABLE Card ADD COLUMN source_chunks TEXT; -- JSON array of chunk IDs used to generate this card
ALTER TABLE Card ADD COLUMN source_cards TEXT; -- JSON array of card IDs used to generate this card (for derived cards)
ADD FOREIGN KEY (chapter_id) REFERENCES chapters(id);
```

## 🎮 Content Type Configurations

```javascript
const CONTENT_TYPE_CONFIG = {
  'BOOK': {
    structure_type: 'CHAPTERS',
    enabled_card_types: ['FLASHCARD', 'APPLICATION', 'QUIZ', 'SYNTHESIS'],
    ui_features: ['chapter_navigation', 'progress_gating', 'concept_mapping'],
    learning_flow: 'tier_based_with_chapters',
    mastery_threshold: 0.8,
    unlock_criteria: 'chapter_based'
  },
  'RESEARCH_PAPER': {
    structure_type: 'SECTIONS', 
    enabled_card_types: ['FLASHCARD', 'QUIZ', 'SYNTHESIS'], // No APPLICATION
    ui_features: ['section_navigation', 'citation_links', 'abstract_preview'],
    learning_flow: 'section_based',
    mastery_threshold: 0.75,
    unlock_criteria: 'section_based'
  },
  'ARTICLE': {
    structure_type: 'TOPICS',
    enabled_card_types: ['FLASHCARD', 'QUIZ'],
    ui_features: ['topic_navigation', 'reading_time'],
    learning_flow: 'simple_progression',
    mastery_threshold: 0.7,
    unlock_criteria: 'linear'
  },
  'VIDEO': {
    structure_type: 'SEGMENTS',
    enabled_card_types: ['FLASHCARD', 'APPLICATION', 'QUIZ'],
    ui_features: ['timestamp_navigation', 'video_preview', 'playback_sync'],
    learning_flow: 'tier_based_with_chapters',
    mastery_threshold: 0.8,
    unlock_criteria: 'segment_based'
  },
  'AUDIO': {
    structure_type: 'SEGMENTS',
    enabled_card_types: ['FLASHCARD', 'QUIZ', 'SYNTHESIS'],
    ui_features: ['timestamp_navigation', 'audio_preview', 'transcript_sync'],
    learning_flow: 'segment_based',
    mastery_threshold: 0.75,
    unlock_criteria: 'segment_based'
  }
}
```

## 🎯 Learning Flow Design

### **1. Content Structure Navigation**
```jsx
<ContentStructure contentType={content.type}>
  <ContentHeader>
    📖 {content.title} ({content.type}) - {structureUnits.length} {structureType}
  </ContentHeader>
  
  <StructureList>
    {structureUnits.map(unit => (
      <StructureUnit 
        key={unit.id}
        completed={unit.completion >= mastery_threshold}
        current={unit.id === currentUnit}
        locked={!unit.unlocked}
      >
        <UnitHeader>
          {getStatusIcon(unit.completion)} {unit.title}
        </UnitHeader>
        
        <ConceptProgress>
          {unit.concepts.map(concept => (
            <ConceptItem
              key={concept.id}
              name={concept.name}
              mastery={concept.mastery_score}
              status={getConceptStatus(concept.mastery_score)}
            />
          ))}
        </ConceptProgress>
        
        <UnitActions>
          {unit.unlocked && (
            <Button onClick={() => startLearning(unit.id)}>
              {unit.completion > 0 ? 'Continue' : 'Start'} Learning
            </Button>
          )}
        </UnitActions>
      </StructureUnit>
    ))}
  </StructureList>
</ContentStructure>
```

### **2. Concept Learning Interface**
```jsx
<ConceptLearning concept={currentConcept}>
  <ConceptHeader>
    <Breadcrumb>
      {content.title} → {structureUnit.title} → {concept.name}
    </Breadcrumb>
    <ConceptProgress value={conceptMastery.overall} />
  </ConceptHeader>
  
  <TierProgress>
    <TierIndicator 
      type="FLASHCARD" 
      progress={conceptMastery.flashcard_completion}
      active={currentTier === 'FLASHCARD'}
    />
    <TierIndicator 
      type="APPLICATION" 
      progress={conceptMastery.application_completion} 
      unlocked={conceptMastery.flashcard_completion >= 0.8}
      active={currentTier === 'APPLICATION'}
    />
    <TierIndicator 
      type="QUIZ" 
      progress={conceptMastery.quiz_completion}
      unlocked={conceptMastery.application_completion >= 0.8}
      active={currentTier === 'QUIZ'}
    />
    <TierIndicator 
      type="SYNTHESIS" 
      progress={conceptMastery.synthesis_completion}
      unlocked={conceptMastery.quiz_completion >= 0.8}
      active={currentTier === 'SYNTHESIS'}
    />
  </TierProgress>
  
  <CardLearning>
    <UnifiedCard 
      card={currentCard}
      onComplete={handleCardCompletion}
      onFailure={handleCardFailure}
    />
  </CardLearning>
  
  <ConceptActions>
    <Button secondary onClick={() => reviewPrerequisites(concept.prerequisite_concepts)}>
      Review Prerequisites
    </Button>
    <Button onClick={() => skipToAssessment(concept.id)} 
            disabled={conceptMastery.flashcard_completion < 0.8}>
      Skip to Quiz
    </Button>
  </ConceptActions>
</ConceptLearning>
```

## 🎨 Card UI Design with Type Variants

### **Unified Card Component**
```jsx
<UnifiedCard type={card.type} content={card} onAction={handleCardAction}>
  {/* Dynamic Card Header with Type Styling */}
  <CardHeader className={getCardStyle(card.type)}>
    <CardTypeIcon type={card.type} />
    <CardTypeLabel>{card.type}</CardTypeLabel>
    <ConceptTag>{card.concept_name}</ConceptTag>
    <DifficultyIndicator level={card.difficulty} />
  </CardHeader>
  
  {/* Dynamic Content Rendering Based on Card Type */}
  <CardContent>
    {card.type === 'FLASHCARD' && (
      <FlashcardContent 
        front={card.front} 
        back={card.back}
        onFlip={handleFlip}
        showBack={showBack}
      />
    )}
    
    {card.type === 'QUIZ' && (
      <QuizContent 
        question={parseQuiz(card.quiz).question}
        options={parseQuiz(card.quiz).options}
        correctAnswer={parseQuiz(card.quiz).answer}
        explanation={parseQuiz(card.quiz).explanation}
        onAnswer={handleQuizAnswer}
        showFeedback={showQuizFeedback}
      />
    )}
    
    {card.type === 'APPLICATION' && (
      <ApplicationContent 
        scenario={card.text}
        context={card.context}
        onUnderstand={() => handleAction('understood')}
        onConfused={() => handleAction('confused')}
      />
    )}
    
    {card.type === 'SYNTHESIS' && (
      <SynthesisContent 
        summary={card.text}
        keyPoints={extractKeyPoints(card.text)}
        relatedConcepts={card.related_concepts}
        onComplete={() => handleAction('completed')}
      />
    )}
  </CardContent>
  
  {/* Card Actions */}
  <CardActions>
    {renderActionsForType(card.type)}
  </CardActions>
</UnifiedCard>
```

### **Card Type Styling**
```javascript
const getCardStyle = (type) => ({
  'FLASHCARD': {
    borderColor: 'border-blue-500',
    backgroundColor: 'bg-blue-50',
    accentColor: 'text-blue-600',
    icon: '🔵'
  },
  'APPLICATION': {
    borderColor: 'border-green-500',
    backgroundColor: 'bg-green-50', 
    accentColor: 'text-green-600',
    icon: '🟢'
  },
  'QUIZ': {
    borderColor: 'border-orange-500',
    backgroundColor: 'bg-orange-50',
    accentColor: 'text-orange-600',
    icon: '🟠'
  },
  'SYNTHESIS': {
    borderColor: 'border-purple-500',
    backgroundColor: 'bg-purple-50',
    accentColor: 'text-purple-600',
    icon: '🟣'
  }
})
```

## 🧠 Adaptive Learning Engine

### **Core Learning Logic**
```javascript
class AdaptiveLearningEngine {
  
  async getNextCard(userId, contentId, lastResponse) {
    const userProgress = await this.getUserProgress(userId, contentId)
    const currentConcept = await this.getCurrentConcept(userProgress)
    
    // Handle failures - route back to prerequisite concepts
    if (lastResponse?.failed) {
      return await this.handleFailureRouting(lastResponse, currentConcept)
    }
    
    // Check concept mastery to determine next tier
    const conceptMastery = await this.calculateConceptMastery(currentConcept, userProgress)
    const nextTier = this.determineNextTier(conceptMastery)
    
    return await this.getNextCardForTier(currentConcept, nextTier)
  }
  
  async handleFailureRouting(lastResponse, currentConcept) {
    switch (lastResponse.cardType) {
      case 'QUIZ':
        // Failed quiz - identify specific missed concepts
        const missedConcepts = await this.analyzeMissedQuestions(lastResponse.quizResults)
        return await this.getReinforcementCards(missedConcepts, 'FLASHCARD')
        
      case 'APPLICATION':
        // Didn't understand application - review prerequisites
        const prerequisites = await this.getPrerequisiteConcepts(currentConcept.id)
        return await this.getReinforcementCards(prerequisites, 'FLASHCARD')
        
      case 'SYNTHESIS':
        // Synthesis confusion - break down into component concepts
        const componentConcepts = await this.getComponentConcepts(currentConcept.id)
        return await this.getReinforcementCards(componentConcepts, 'APPLICATION')
        
      default:
        // Flashcard failure - provide easier variation
        return await this.getEasierVariation(lastResponse.cardId)
    }
  }
  
  determineNextTier(conceptMastery) {
    const config = CONTENT_TYPE_CONFIG[this.contentType]
    const threshold = config.mastery_threshold
    
    if (conceptMastery.flashcard_completion < threshold) return 'FLASHCARD'
    if (conceptMastery.application_completion < threshold && 
        config.enabled_card_types.includes('APPLICATION')) return 'APPLICATION'
    if (conceptMastery.quiz_completion < threshold) return 'QUIZ'
    if (config.enabled_card_types.includes('SYNTHESIS')) return 'SYNTHESIS'
    
    // Concept mastered - move to next concept
    return 'NEXT_CONCEPT'
  }
  
  async handleCardCompletion(userId, cardId, response) {
    const card = await this.getCard(cardId)
    const concept = await this.getConcept(card.concept_id)
    
    // Update concept mastery based on card performance
    await this.updateConceptMastery(userId, concept.id, {
      cardType: card.type,
      performance: response.performance,
      timeSpent: response.timeSpent,
      confidence: response.confidence
    })
    
    // Check unlock conditions
    await this.checkUnlockConditions(userId, concept)
  }
  
  async checkUnlockConditions(userId, concept) {
    const conceptMastery = await this.getConceptMastery(userId, concept.id)
    const config = CONTENT_TYPE_CONFIG[this.contentType]
    
    // Concept completion
    if (conceptMastery.overall >= config.mastery_threshold) {
      await this.unlockNextConcept(userId, concept.structure_unit_id)
      
      // Check structure unit (chapter/section) completion
      const unitProgress = await this.calculateUnitProgress(userId, concept.structure_unit_id)
      if (unitProgress >= config.mastery_threshold) {
        await this.unlockNextUnit(userId, concept.content_id)
        
        // Award completion XP and achievements
        await this.awardCompletionRewards(userId, concept.structure_unit_id)
      }
    }
  }
}
```

### **Mastery Calculation Algorithm**
```javascript
class MasteryCalculator {
  
  calculateConceptMastery(conceptProgress, cardResponses) {
    const weights = {
      'FLASHCARD': 0.3,
      'APPLICATION': 0.3,
      'QUIZ': 0.3,
      'SYNTHESIS': 0.1
    }
    
    let totalMastery = 0
    let totalWeight = 0
    
    for (const [cardType, weight] of Object.entries(weights)) {
      const typeMastery = this.calculateTypeMastery(cardResponses, cardType)
      if (typeMastery !== null) {
        totalMastery += typeMastery * weight
        totalWeight += weight
      }
    }
    
    return totalWeight > 0 ? totalMastery / totalWeight : 0
  }
  
  calculateTypeMastery(responses, cardType) {
    const typeResponses = responses.filter(r => r.cardType === cardType)
    if (typeResponses.length === 0) return null
    
    // Weighted average with recency bias
    const weights = typeResponses.map((_, index) => Math.pow(1.1, index))
    const weightedSum = typeResponses.reduce((sum, response, index) => 
      sum + response.performance * weights[index], 0)
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    
    return weightedSum / totalWeight
  }
}
```

## 📱 User Experience Flows

### **Learning Session Flow**
```
1. User selects content → 
2. Structure overview (chapters/sections) →
3. Select unlocked unit →
4. Concept learning screen →
5. Adaptive card progression →
6. Concept mastery assessment →
7. Unit completion celebration →
8. Next unit unlock
```

### **Failure Recovery Flow**
```
Quiz Failure →
Identify missed concepts →
Route to prerequisite flashcards →
Re-learn foundations →
Retry quiz with confidence →
Success → Continue progression
```

### **Progress Tracking Flow**
```
Card completion →
Update concept mastery →
Check tier progression →
Check concept completion →
Check unit completion →
Unlock next content →
Award XP and achievements
```

## 🔧 Implementation Strategy

### **Phase 1: Enhanced Card Generation**
1. **Modify book processor** to extract concepts and structure units
2. **Generate concept mapping** during card creation
3. **Track prerequisites** and concept relationships
4. **Re-run book processing** to get clean structured data

### **Phase 2: Adaptive Learning Engine**
1. **Implement mastery calculation** algorithms
2. **Build concept routing** logic
3. **Create failure recovery** mechanisms
4. **Add progress tracking** and unlocking

### **Phase 3: Unified UI Components**
1. **Build card type variants** with proper styling
2. **Create structure navigation** interface
3. **Implement concept learning** screens
4. **Add progress visualization**

### **Phase 4: Content Type Integration**
1. **Extend to research papers** with section-based flow
2. **Add article support** with topic-based progression
3. **Prepare video/audio** infrastructure
4. **Test cross-content-type** consistency

## 🎯 Success Metrics

- **Learning Effectiveness**: 80%+ concept mastery rate
- **Engagement**: 90%+ session completion rate
- **Adaptive Routing**: 70%+ improvement in struggle areas
- **Progress Persistence**: 95%+ progress saved correctly
- **Content Flexibility**: Support for 5+ content types
- **User Satisfaction**: 4.5+ rating for learning experience

## 🔄 Migration Requirements

**Current State**: Cards with order-based progression, no concept mapping
**Target State**: Concept-driven adaptive learning with proper structure

**Migration Steps**:
1. **Database schema migration** with new tables
2. **Enhanced card generation** with concept extraction
3. **Re-process existing content** to populate new structure
4. **Update frontend** to use new learning flows
5. **Gradual rollout** with A/B testing

This unified system provides the foundation for intelligent, adaptive learning across all content types while maintaining flexibility for future content processor additions.