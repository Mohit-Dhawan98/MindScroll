# MindScroll Content Library

This directory contains the curated book library that will be processed into learning cards for all users.

## Folder Structure

### 📁 technology/
Place programming, software engineering, and tech books here:
- Clean Code - Robert Martin
- The Pragmatic Programmer - Andrew Hunt  
- You Don't Know JS series - Kyle Simpson
- Python Crash Course - Eric Matthes
- Design Patterns - Gang of Four
- System Design Interview - Alex Xu

### 📁 business/
Business, entrepreneurship, and management books:
- The Lean Startup - Eric Ries
- Good to Great - Jim Collins
- Zero to One - Peter Thiel
- The Hard Thing About Hard Things - Ben Horowitz
- The Innovator's Dilemma - Clayton Christensen
- Built to Last - Jim Collins

### 📁 science/
Science, medicine, and research books:
- Sapiens - Yuval Noah Harari
- The Gene - Siddhartha Mukherjee
- Cosmos - Carl Sagan
- The Body - Bill Bryson
- A Brief History of Time - Stephen Hawking
- The Origin of Species - Charles Darwin

### 📁 personal-development/
Self-improvement and productivity books:
- Atomic Habits - James Clear
- Mindset - Carol Dweck
- Deep Work - Cal Newport
- The 7 Habits of Highly Effective People - Stephen Covey
- Flow - Mihaly Csikszentmihalyi
- Grit - Angela Duckworth

### 📁 economics/
Economics, finance, and behavioral economics:
- Thinking, Fast and Slow - Daniel Kahneman
- The Intelligent Investor - Benjamin Graham
- Freakonomics - Steven Levitt
- The Black Swan - Nassim Nicholas Taleb
- Capital in the Twenty-First Century - Thomas Piketty

### 📁 health/
Health, fitness, and wellness books:
- The Blue Zones - Dan Buettner
- Why We Sleep - Matthew Walker
- The China Study - T. Colin Campbell
- Becoming a Supple Leopard - Kelly Starrett

### 📁 history/
Historical narratives and biographies:
- The Guns of August - Barbara Tuchman
- 1776 - David McCullough
- The Wright Brothers - David McCullough
- Steve Jobs - Walter Isaacson
- Leonardo da Vinci - Walter Isaacson

### 📁 philosophy/
Philosophy and critical thinking:
- Meditations - Marcus Aurelius
- The Republic - Plato  
- Man's Search for Meaning - Viktor Frankl
- The Art of War - Sun Tzu

### 📁 arts/
Art, creativity, and design:
- The Creative Act - Rick Rubin
- Steal Like an Artist - Austin Kleon
- The Design of Everyday Things - Don Norman
- Ways of Seeing - John Berger

## Processing Instructions

1. Place PDF/EPUB files in the appropriate category folders
2. Use clear, consistent naming: "Author - Title.pdf"
3. Ensure files are text-searchable (not just images)
4. The backend processor will automatically:
   - Extract text content
   - Generate learning cards using AI
   - Create spaced repetition schedules
   - Index content for search

## File Naming Convention
```
[Category]/[Author] - [Title].[ext]

Examples:
technology/Robert Martin - Clean Code.pdf
business/Eric Ries - The Lean Startup.epub
science/Carl Sagan - Cosmos.pdf
```

## Backend Processing
The content processor (`/backend/src/processors/`) will:
- Monitor these folders for new content
- Extract and chunk text intelligently
- Generate learning cards via AI APIs
- Store processed content in database
- Make content available to all users