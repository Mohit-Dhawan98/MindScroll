-- Migration: Unified Learning System Schema
-- Date: 2025-08-02
-- Description: Add concept mapping, structure units, and enhanced learning system

-- Add new columns to Content table
ALTER TABLE content ADD COLUMN structure_type VARCHAR(20) DEFAULT 'CHAPTERS';
ALTER TABLE content ADD COLUMN enabled_card_types TEXT DEFAULT '["FLASHCARD", "APPLICATION", "QUIZ", "SYNTHESIS"]';
ALTER TABLE content ADD COLUMN learning_flow VARCHAR(30) DEFAULT 'tier_based_with_chapters';

-- Create StructureUnit table (chapters, sections, segments, topics)
CREATE TABLE structure_units (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  unit_number INTEGER NOT NULL,
  unit_title TEXT NOT NULL,
  unit_type VARCHAR(20) NOT NULL DEFAULT 'CHAPTER', -- 'CHAPTER', 'SECTION', 'SEGMENT', 'TOPIC'
  start_page INTEGER,
  end_page INTEGER,
  timestamp_start INTEGER, -- For videos/audio (seconds)
  timestamp_end INTEGER,
  concept_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Create Concept table
CREATE TABLE concepts (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  structure_unit_id TEXT NOT NULL,
  concept_name TEXT NOT NULL,
  description TEXT,
  order_in_unit INTEGER NOT NULL,
  prerequisite_concepts TEXT DEFAULT '[]', -- JSON array of concept IDs
  difficulty_level REAL DEFAULT 2.5,
  estimated_time INTEGER DEFAULT 10, -- Minutes to master
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
  FOREIGN KEY (structure_unit_id) REFERENCES structure_units(id) ON DELETE CASCADE
);

-- Create ConceptMastery table for tracking user progress per concept
CREATE TABLE concept_mastery (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  mastery_score REAL DEFAULT 0.0, -- 0.0 to 1.0
  flashcard_completion REAL DEFAULT 0.0,
  application_completion REAL DEFAULT 0.0,
  quiz_completion REAL DEFAULT 0.0,
  synthesis_completion REAL DEFAULT 0.0,
  last_practiced DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
  UNIQUE(user_id, concept_id)
);

-- Add new columns to Card table
ALTER TABLE cards ADD COLUMN concept_id TEXT;
ALTER TABLE cards ADD COLUMN structure_unit_id TEXT;
ALTER TABLE cards ADD COLUMN concept_weight REAL DEFAULT 1.0; -- How much this card contributes to concept mastery

-- Add foreign key constraints for new Card columns
-- Note: SQLite doesn't support adding FK constraints to existing tables directly
-- We'll handle this in the application layer for now

-- Create indexes for performance
CREATE INDEX idx_structure_units_content_id ON structure_units(content_id);
CREATE INDEX idx_structure_units_unit_number ON structure_units(content_id, unit_number);
CREATE INDEX idx_concepts_content_id ON concepts(content_id);
CREATE INDEX idx_concepts_structure_unit_id ON concepts(structure_unit_id);
CREATE INDEX idx_concepts_order ON concepts(structure_unit_id, order_in_unit);
CREATE INDEX idx_concept_mastery_user_id ON concept_mastery(user_id);
CREATE INDEX idx_concept_mastery_concept_id ON concept_mastery(concept_id);
CREATE INDEX idx_cards_concept_id ON cards(concept_id);
CREATE INDEX idx_cards_structure_unit_id ON cards(structure_unit_id);

-- Add some sample data for testing (optional - can be removed)
-- This will be populated by the enhanced card generation process