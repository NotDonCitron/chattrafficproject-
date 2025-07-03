const winston = require('winston');
const { EventEmitter } = require('events');

/**
 * ContextMemory - Advanced conversation context management
 * Handles conversation history, context preservation, and memory optimization
 */
class ContextMemory extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxConversations: config.maxConversations || 100,
      maxHistoryLength: config.maxHistoryLength || 50,
      maxContextAge: config.maxContextAge || 24 * 60 * 60 * 1000, // 24 hours
      compressionThreshold: config.compressionThreshold || 20, // messages before compression
      enableContextSummary: config.enableContextSummary ?? true,
      persistToDisk: config.persistToDisk ?? false,
      memoryOptimization: config.memoryOptimization ?? true,
      ...config
    };
    
    // In-memory conversation storage
    this.conversations = new Map();
    
    // Context summaries for compressed conversations
    this.contextSummaries = new Map();
    
    // Memory usage tracking
    this.memoryStats = {
      activeConversations: 0,
      totalMemoryUsage: 0,
      compressionsSaved: 0,
      summariesGenerated: 0
    };
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/context-memory.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    // Initialize cleanup and optimization
    this.initializeOptimization();
  }

  /**
   * Initialize memory optimization routines
   */
  initializeOptimization() {
    // Clean up expired conversations every 5 minutes
    setInterval(() => this.cleanupExpiredConversations(), 5 * 60 * 1000);
    
    // Optimize memory usage every 10 minutes
    if (this.config.memoryOptimization) {
      setInterval(() => this.optimizeMemoryUsage(), 10 * 60 * 1000);
    }
    
    // Update memory statistics every minute
    setInterval(() => this.updateMemoryStats(), 60 * 1000);
  }

  /**
   * Set conversation context
   */
  setContext(conversationId, context) {
    try {
      // Validate context
      this.validateContext(context);
      
      // Check if we need to compress old messages
      if (context.messageHistory && context.messageHistory.length > this.config.compressionThreshold) {
        context = this.compressMessageHistory(conversationId, context);
      }
      
      // Ensure we don't exceed max conversations
      this.enforceMaxConversations();
      
      // Store context with metadata
      const contextWithMeta = {
        ...context,
        lastUpdated: new Date(),
        memoryUsage: this.estimateMemoryUsage(context),
        accessCount: (this.conversations.get(conversationId)?.accessCount || 0) + 1
      };
      
      this.conversations.set(conversationId, contextWithMeta);
      
      this.emit('context-updated', {
        conversationId,
        memoryUsage: contextWithMeta.memoryUsage,
        messageCount: context.messageHistory?.length || 0
      });
      
      this.logger.debug('Context updated', {
        conversationId,
        messageCount: context.messageHistory?.length || 0,
        memoryUsage: contextWithMeta.memoryUsage
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to set context', {
        conversationId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get conversation context
   */
  getContext(conversationId) {
    const context = this.conversations.get(conversationId);
    
    if (!context) {
      return null;
    }
    
    // Update access count and last accessed time
    context.accessCount = (context.accessCount || 0) + 1;
    context.lastAccessed = new Date();
    
    // Reconstruct full context if compressed
    if (context.isCompressed && this.contextSummaries.has(conversationId)) {
      return this.reconstructContext(conversationId, context);
    }
    
    return context;
  }

  /**
   * Remove conversation context
   */
  removeContext(conversationId) {
    const context = this.conversations.get(conversationId);
    
    if (context) {
      // Clean up associated summaries
      this.contextSummaries.delete(conversationId);
      
      // Remove from main storage
      this.conversations.delete(conversationId);
      
      this.emit('context-removed', {
        conversationId,
        memoryFreed: context.memoryUsage || 0
      });
      
      this.logger.debug('Context removed', { conversationId });
      return true;
    }
    
    return false;
  }

  /**
   * Check if conversation exists
   */
  hasContext(conversationId) {
    return this.conversations.has(conversationId);
  }

  /**
   * Get conversation summary
   */
  getContextSummary(conversationId) {
    const context = this.conversations.get(conversationId);
    
    if (!context) return null;
    
    return {
      conversationId,
      startTime: context.startTime,
      lastUpdated: context.lastUpdated,
      platform: context.platform,
      personality: context.personality,
      messageCount: context.messageHistory?.length || 0,
      qualityScore: context.qualityScore,
      engagementLevel: context.engagementLevel,
      conversationStage: context.conversationStage,
      isCompressed: context.isCompressed || false,
      memoryUsage: context.memoryUsage || 0
    };
  }

  /**
   * Get all active conversations
   */
  getActiveConversations() {
    const conversations = [];
    
    this.conversations.forEach((context, conversationId) => {
      conversations.push(this.getContextSummary(conversationId));
    });
    
    return conversations.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }

  /**
   * Compress message history for long conversations
   */
  compressMessageHistory(conversationId, context) {
    try {
      const messages = context.messageHistory || [];
      
      if (messages.length <= this.config.compressionThreshold) {
        return context;
      }
      
      // Keep recent messages uncompressed
      const recentMessages = messages.slice(-10);
      const oldMessages = messages.slice(0, -10);
      
      // Generate summary of old messages
      const summary = this.generateMessageSummary(oldMessages, context);
      
      // Store compressed summary
      this.contextSummaries.set(conversationId, {
        summary,
        compressedMessageCount: oldMessages.length,
        compressionDate: new Date(),
        originalMemoryUsage: this.estimateMemoryUsage({ messageHistory: oldMessages })
      });
      
      // Update context with compressed data
      const compressedContext = {
        ...context,
        messageHistory: recentMessages,
        contextSummary: summary,
        isCompressed: true,
        compressedMessageCount: oldMessages.length
      };
      
      this.memoryStats.compressionsSaved++;
      
      this.emit('context-compressed', {
        conversationId,
        originalMessageCount: messages.length,
        compressedCount: oldMessages.length,
        retainedCount: recentMessages.length
      });
      
      this.logger.info('Context compressed', {
        conversationId,
        originalMessages: messages.length,
        compressedMessages: oldMessages.length,
        retainedMessages: recentMessages.length
      });
      
      return compressedContext;
    } catch (error) {
      this.logger.error('Failed to compress context', {
        conversationId,
        error: error.message
      });
      return context;
    }
  }

  /**
   * Generate summary of message history
   */
  generateMessageSummary(messages, context) {
    try {
      // Extract key information from messages
      const topics = this.extractTopics(messages);
      const emotions = this.extractEmotions(messages);
      const keyMoments = this.extractKeyMoments(messages);
      
      const summary = {
        messageCount: messages.length,
        timespan: {
          start: messages[0]?.timestamp,
          end: messages[messages.length - 1]?.timestamp
        },
        dominantTopics: topics.slice(0, 5),
        emotionalTone: emotions,
        keyMoments: keyMoments,
        conversationFlow: this.analyzeConversationFlow(messages),
        partnerEngagement: this.analyzePartnerEngagement(messages)
      };
      
      this.memoryStats.summariesGenerated++;
      
      return summary;
    } catch (error) {
      this.logger.error('Failed to generate message summary', { error: error.message });
      return {
        messageCount: messages.length,
        timespan: {
          start: messages[0]?.timestamp,
          end: messages[messages.length - 1]?.timestamp
        },
        note: 'Summary generation failed'
      };
    }
  }

  /**
   * Extract topics from messages
   */
  extractTopics(messages) {
    const topicKeywords = {
      technology: ['computer', 'tech', 'software', 'app', 'internet', 'phone', 'digital'],
      entertainment: ['movie', 'music', 'game', 'show', 'film', 'song', 'play', 'watch'],
      travel: ['travel', 'trip', 'vacation', 'country', 'city', 'flight', 'hotel'],
      work: ['job', 'work', 'career', 'office', 'business', 'company', 'boss'],
      hobbies: ['hobby', 'sport', 'exercise', 'art', 'draw', 'paint', 'read', 'book'],
      relationships: ['friend', 'family', 'relationship', 'love', 'date', 'partner'],
      food: ['food', 'eat', 'restaurant', 'cook', 'recipe', 'dinner', 'lunch'],
      education: ['school', 'university', 'study', 'learn', 'student', 'teacher']
    };
    
    const topicCounts = {};
    const allText = messages.map(m => m.content.toLowerCase()).join(' ');
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      const count = keywords.reduce((total, keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        const matches = allText.match(regex);
        return total + (matches ? matches.length : 0);
      }, 0);
      
      if (count > 0) {
        topicCounts[topic] = count;
      }
    });
    
    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([topic]) => topic);
  }

  /**
   * Extract emotional tone from messages
   */
  extractEmotions(messages) {
    const emotionWords = {
      positive: ['happy', 'excited', 'great', 'awesome', 'love', 'amazing', 'wonderful', 'good'],
      negative: ['sad', 'angry', 'upset', 'terrible', 'hate', 'awful', 'bad', 'disappointed'],
      neutral: ['okay', 'fine', 'normal', 'regular', 'usual', 'typical']
    };
    
    const emotionCounts = { positive: 0, negative: 0, neutral: 0 };
    const allText = messages.map(m => m.content.toLowerCase()).join(' ');
    
    Object.entries(emotionWords).forEach(([emotion, words]) => {
      words.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = allText.match(regex);
        emotionCounts[emotion] += matches ? matches.length : 0;
      });
    });
    
    const total = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
    
    if (total === 0) return 'neutral';
    
    return Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  /**
   * Extract key moments from conversation
   */
  extractKeyMoments(messages) {
    const keyMoments = [];
    
    messages.forEach((message, index) => {
      // Look for significant events
      if (message.content.includes('?') && message.content.length > 20) {
        keyMoments.push({
          type: 'important_question',
          message: message.content.substring(0, 50) + '...',
          timestamp: message.timestamp
        });
      }
      
      if (message.quality && message.quality > 0.8) {
        keyMoments.push({
          type: 'high_quality_response',
          message: message.content.substring(0, 50) + '...',
          timestamp: message.timestamp,
          quality: message.quality
        });
      }
      
      if (message.engagement && message.engagement > 0.8) {
        keyMoments.push({
          type: 'high_engagement',
          message: message.content.substring(0, 50) + '...',
          timestamp: message.timestamp,
          engagement: message.engagement
        });
      }
    });
    
    return keyMoments.slice(0, 5); // Top 5 key moments
  }

  /**
   * Analyze conversation flow
   */
  analyzeConversationFlow(messages) {
    const flow = {
      avgResponseTime: 0,
      longestPause: 0,
      messageFrequency: 'steady',
      conversationPace: 'normal'
    };
    
    if (messages.length < 2) return flow;
    
    const responseTimes = [];
    
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].timestamp && messages[i-1].timestamp) {
        const timeDiff = new Date(messages[i].timestamp) - new Date(messages[i-1].timestamp);
        responseTimes.push(timeDiff);
      }
    }
    
    if (responseTimes.length > 0) {
      flow.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      flow.longestPause = Math.max(...responseTimes);
      
      // Determine pace
      const avgMinutes = flow.avgResponseTime / (1000 * 60);
      if (avgMinutes < 0.5) flow.conversationPace = 'fast';
      else if (avgMinutes > 2) flow.conversationPace = 'slow';
    }
    
    return flow;
  }

  /**
   * Analyze partner engagement
   */
  analyzePartnerEngagement(messages) {
    const partnerMessages = messages.filter(m => m.type === 'received');
    
    if (partnerMessages.length === 0) {
      return { level: 'unknown', indicators: [] };
    }
    
    const indicators = [];
    let engagementScore = 0.5;
    
    // Check for questions
    const questionsAsked = partnerMessages.filter(m => m.content.includes('?')).length;
    const questionRatio = questionsAsked / partnerMessages.length;
    
    if (questionRatio > 0.3) {
      indicators.push('asks questions');
      engagementScore += 0.2;
    }
    
    // Check message length
    const avgLength = partnerMessages.reduce((total, m) => total + m.content.length, 0) / partnerMessages.length;
    
    if (avgLength > 30) {
      indicators.push('detailed responses');
      engagementScore += 0.2;
    }
    
    // Check for enthusiasm
    const enthusiasmWords = ['!', 'awesome', 'amazing', 'great', 'love', 'wow'];
    const enthusiasmCount = partnerMessages.reduce((count, m) => {
      return count + enthusiasmWords.reduce((wordCount, word) => {
        return wordCount + (m.content.toLowerCase().includes(word) ? 1 : 0);
      }, 0);
    }, 0);
    
    if (enthusiasmCount > partnerMessages.length * 0.3) {
      indicators.push('enthusiastic');
      engagementScore += 0.2;
    }
    
    let level = 'low';
    if (engagementScore > 0.7) level = 'high';
    else if (engagementScore > 0.5) level = 'medium';
    
    return { level, indicators, score: engagementScore };
  }

  /**
   * Reconstruct full context from compressed data
   */
  reconstructContext(conversationId, compressedContext) {
    const summary = this.contextSummaries.get(conversationId);
    
    if (!summary) {
      return compressedContext;
    }
    
    return {
      ...compressedContext,
      historicalSummary: summary.summary,
      fullMessageHistory: null, // Indicate that full history is not available
      reconstructed: true
    };
  }

  /**
   * Estimate memory usage of context
   */
  estimateMemoryUsage(context) {
    try {
      const jsonString = JSON.stringify(context);
      return jsonString.length * 2; // Rough estimate (UTF-16)
    } catch (error) {
      return 1000; // Default estimate
    }
  }

  /**
   * Validate context structure
   */
  validateContext(context) {
    if (!context || typeof context !== 'object') {
      throw new Error('Context must be an object');
    }
    
    if (!context.conversationId) {
      throw new Error('Context must have conversationId');
    }
    
    if (context.messageHistory && !Array.isArray(context.messageHistory)) {
      throw new Error('messageHistory must be an array');
    }
  }

  /**
   * Enforce maximum number of conversations
   */
  enforceMaxConversations() {
    if (this.conversations.size >= this.config.maxConversations) {
      // Remove oldest conversations by last updated time
      const sortedConversations = Array.from(this.conversations.entries())
        .sort(([,a], [,b]) => new Date(a.lastUpdated) - new Date(b.lastUpdated));
      
      const toRemove = sortedConversations.slice(0, Math.floor(this.config.maxConversations * 0.1));
      
      toRemove.forEach(([conversationId]) => {
        this.removeContext(conversationId);
      });
      
      this.logger.info('Enforced max conversations limit', {
        removed: toRemove.length,
        remaining: this.conversations.size
      });
    }
  }

  /**
   * Clean up expired conversations
   */
  cleanupExpiredConversations() {
    const now = Date.now();
    const expiredConversations = [];
    
    this.conversations.forEach((context, conversationId) => {
      const age = now - new Date(context.lastUpdated).getTime();
      
      if (age > this.config.maxContextAge) {
        expiredConversations.push(conversationId);
      }
    });
    
    expiredConversations.forEach(conversationId => {
      this.removeContext(conversationId);
    });
    
    if (expiredConversations.length > 0) {
      this.logger.info('Cleaned up expired conversations', {
        count: expiredConversations.length
      });
    }
  }

  /**
   * Optimize memory usage
   */
  optimizeMemoryUsage() {
    let totalSavings = 0;
    let optimizedCount = 0;
    
    this.conversations.forEach((context, conversationId) => {
      // Compress contexts with long message histories
      if (context.messageHistory && 
          context.messageHistory.length > this.config.compressionThreshold &&
          !context.isCompressed) {
        
        const originalSize = context.memoryUsage || 0;
        const optimizedContext = this.compressMessageHistory(conversationId, context);
        const newSize = this.estimateMemoryUsage(optimizedContext);
        
        this.conversations.set(conversationId, {
          ...optimizedContext,
          memoryUsage: newSize
        });
        
        totalSavings += originalSize - newSize;
        optimizedCount++;
      }
    });
    
    if (optimizedCount > 0) {
      this.logger.info('Memory optimization completed', {
        conversationsOptimized: optimizedCount,
        memorySaved: totalSavings
      });
      
      this.emit('memory-optimized', {
        conversationsOptimized: optimizedCount,
        memorySaved: totalSavings
      });
    }
  }

  /**
   * Update memory statistics
   */
  updateMemoryStats() {
    let totalMemory = 0;
    
    this.conversations.forEach(context => {
      totalMemory += context.memoryUsage || 0;
    });
    
    this.memoryStats = {
      ...this.memoryStats,
      activeConversations: this.conversations.size,
      totalMemoryUsage: totalMemory,
      averageMemoryPerConversation: this.conversations.size > 0 
        ? Math.round(totalMemory / this.conversations.size) 
        : 0
    };
    
    this.emit('memory-stats-updated', this.memoryStats);
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    this.updateMemoryStats();
    return {
      ...this.memoryStats,
      compressionRatio: this.memoryStats.compressionsSaved > 0 
        ? Math.round((this.memoryStats.compressionsSaved / this.conversations.size) * 100)
        : 0
    };
  }

  /**
   * Clear all contexts (useful for testing or reset)
   */
  clear() {
    const conversationCount = this.conversations.size;
    
    this.conversations.clear();
    this.contextSummaries.clear();
    
    this.emit('memory-cleared', { conversationsRemoved: conversationCount });
    
    this.logger.info('All contexts cleared', { conversationsRemoved: conversationCount });
  }
}

module.exports = ContextMemory;