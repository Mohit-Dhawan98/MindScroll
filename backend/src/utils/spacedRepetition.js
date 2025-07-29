/**
 * Spaced Repetition Algorithm (SM-2)
 * Based on the SuperMemo algorithm for optimal learning intervals
 */

export class SpacedRepetition {
  /**
   * Calculate next review parameters based on user performance
   * @param {Object} current - Current progress data
   * @param {number} quality - Quality of recall (0-5)
   * @returns {Object} Updated progress parameters
   */
  static calculateNextReview(current, quality) {
    const { easeFactor, interval, repetitions } = current
    
    let newEaseFactor = easeFactor
    let newInterval = interval
    let newRepetitions = repetitions

    // Update ease factor based on quality
    newEaseFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    if (quality < 3) {
      // Poor recall - restart from beginning
      newRepetitions = 0
      newInterval = 1
    } else {
      // Good recall - increase interval
      newRepetitions += 1
      
      if (newRepetitions === 1) {
        newInterval = 1
      } else if (newRepetitions === 2) {
        newInterval = 6
      } else {
        newInterval = Math.round(interval * newEaseFactor)
      }
    }

    // Calculate next review date
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + newInterval)

    return {
      easeFactor: newEaseFactor,
      interval: newInterval,
      repetitions: newRepetitions,
      nextReview,
      lastReviewed: new Date()
    }
  }

  /**
   * Determine if a card is due for review
   * @param {Date} nextReview - Scheduled next review date
   * @returns {boolean} Whether card is due
   */
  static isDue(nextReview) {
    return new Date() >= new Date(nextReview)
  }

  /**
   * Get cards due for review for a user
   * @param {Array} userProgress - User's progress data
   * @param {number} limit - Maximum number of cards to return
   * @returns {Array} Cards due for review
   */
  static getDueCards(userProgress, limit = 20) {
    return userProgress
      .filter(progress => this.isDue(progress.nextReview))
      .sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview))
      .slice(0, limit)
  }

  /**
   * Convert user response to quality score
   * @param {string} response - User response ('easy', 'good', 'hard', 'again')
   * @returns {number} Quality score (0-5)
   */
  static responseToQuality(response) {
    const qualityMap = {
      'again': 0,   // Complete blackout
      'hard': 2,    // Incorrect response, correct one remembered
      'good': 3,    // Correct response with serious difficulty
      'easy': 5     // Perfect response
    }
    
    return qualityMap[response] || 3
  }

  /**
   * Calculate optimal daily study load
   * @param {Array} userProgress - User's progress data
   * @param {number} dailyGoal - User's daily card goal
   * @returns {Object} Study session configuration
   */
  static calculateDailySession(userProgress, dailyGoal = 10) {
    const dueCards = this.getDueCards(userProgress)
    const newCards = userProgress
      .filter(progress => progress.repetitions === 0)
      .slice(0, Math.max(0, dailyGoal - dueCards.length))

    return {
      reviewCards: dueCards,
      newCards,
      totalCards: dueCards.length + newCards.length,
      breakdown: {
        due: dueCards.length,
        new: newCards.length
      }
    }
  }

  /**
   * Generate study statistics
   * @param {Array} userProgress - User's progress data
   * @returns {Object} Learning statistics
   */
  static generateStats(userProgress) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const total = userProgress.length
    const mastered = userProgress.filter(p => p.repetitions >= 3 && p.easeFactor >= 2.5).length
    const learning = userProgress.filter(p => p.repetitions > 0 && p.repetitions < 3).length
    const new_cards = userProgress.filter(p => p.repetitions === 0).length
    const due = this.getDueCards(userProgress).length
    
    const reviewedToday = userProgress.filter(p => {
      if (!p.lastReviewed) return false
      const reviewDate = new Date(p.lastReviewed)
      return reviewDate >= today
    }).length

    return {
      total,
      mastered,
      learning,
      new: new_cards,
      due,
      reviewedToday,
      retention: total > 0 ? Math.round((mastered / total) * 100) : 0
    }
  }
}