const { Anthropic } = require('@anthropic-ai/sdk');
const winston = require('winston');
const { EventEmitter } = require('events');
const PersonalityEngine = require('./personality-engine');
const ContextMemory = require('./context-memory');

/**
 * ConversationManager - AI-powered conversation management with Claude
 * Handles context-aware responses, conversation flow, and multi-threading
 */
class ConversationManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      claudeApiKey: config.claudeApiKey || process.env.CLAUDE_API_KEY,
      model: config.model || 'claude-3-opus-20240229',
      maxTokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7,
      contextWindow: config.contextWindow || 8000,
      maxConcurrentConversations: config.maxConcurrentConversations || 50,
      responseTimeout: config.responseTimeout || 10000,
      ...config
    };
    
    if (!this.config.claudeApiKey) {
      throw new Error('Claude API key is required');
    }
    
    this.claude = new Anthropic({
      apiKey: this.config.claudeApiKey
    });
    
    this.personalityEngine = new PersonalityEngine();
    this.contextMemory = new ContextMemory({
      maxConversations: this.config.maxConcurrentConversations,
      maxHistoryLength: 50
    });
    
    // Active conversations tracking
    this.activeConversations = new Map();
    this.conversationMetrics = new Map();
    
    // Response caching for efficiency
    this.responseCache = new Map();
    this.cacheMaxSize = 1000;
    this.cacheHitRate = 0;
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/conversation-manager.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.initializeMetrics();
  }

  /**
   * Initialize conversation metrics tracking
   */
  initializeMetrics() {
    this.metrics = {
      totalConversations: 0,
      successfulResponses: 0,
      failedResponses: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      conversationLengths: [],
      personalityUsage: {},
      qualityScores: []
    };
    
    // Update metrics every minute
    setInterval(() => this.updateMetrics(), 60000);
  }

  /**
   * Generate intelligent response based on conversation context
   */
  async generateResponse(params) {
    const startTime = Date.now();
    const conversationId = params.conversationId || this.generateConversationId();
    
    try {
      // Validate input parameters
      this.validateGenerateParams(params);
      
      // Get or create conversation context
      const context = await this.getConversationContext(conversationId, params);
      
      // Check response cache first
      const cacheKey = this.generateCacheKey(context);
      if (this.responseCache.has(cacheKey)) {
        this.cacheHitRate++;
        const cachedResponse = this.responseCache.get(cacheKey);
        this.logger.info('Using cached response', { conversationId, cacheKey });
        return cachedResponse;
      }
      
      // Generate personality-aware response
      const response = await this.generateAIResponse(context);
      
      // Update conversation context
      await this.updateConversationContext(conversationId, {
        userMessage: params.lastMessage,
        botResponse: response.content,
        timestamp: new Date(),
        quality: response.quality,
        engagement: response.engagement
      });
      
      // Cache response for future use
      this.cacheResponse(cacheKey, response);
      
      // Update metrics
      this.updateResponseMetrics(conversationId, Date.now() - startTime, true);
      
      this.emit('response-generated', {
        conversationId,
        response: response.content,
        quality: response.quality,
        engagement: response.engagement,
        responseTime: Date.now() - startTime
      });
      
      return response;
    } catch (error) {
      this.logger.error('Failed to generate response', { 
        conversationId, 
        error: error.message,
        params 
      });
      
      this.updateResponseMetrics(conversationId, Date.now() - startTime, false);
      
      // Return fallback response
      return this.getFallbackResponse(params);
    }
  }

  /**
   * Get or create conversation context
   */
  async getConversationContext(conversationId, params) {
    let context = this.contextMemory.getContext(conversationId);
    
    if (!context) {
      context = {
        conversationId,
        startTime: new Date(),
        platform: params.platform || 'unknown',
        chatMode: params.chatMode || 'text',
        personality: params.personality || this.personalityEngine.selectOptimalPersonality(params),
        partnerProfile: params.partnerProfile || {},
        conversationGoals: params.conversationGoals || ['engagement'],
        messageHistory: [],
        contextSummary: '',
        mood: params.currentMood || 'neutral',
        interests: params.interests || [],
        conversationStage: 'opening', // opening, middle, closing
        qualityScore: 0,
        engagementLevel: 0
      };
      
      this.contextMemory.setContext(conversationId, context);
      this.activeConversations.set(conversationId, {
        startTime: new Date(),
        messageCount: 0,
        lastActivity: new Date()
      });
    }
    
    // Update context with new information
    if (params.chatHistory && params.chatHistory.length > 0) {
      context.messageHistory = [...context.messageHistory, ...params.chatHistory].slice(-20); // Keep last 20 messages
    }
    
    if (params.partnerProfile) {
      context.partnerProfile = { ...context.partnerProfile, ...params.partnerProfile };
    }
    
    // Determine conversation stage
    context.conversationStage = this.determineConversationStage(context);
    
    return context;
  }

  /**
   * Generate AI response using Claude
   */
  async generateAIResponse(context) {
    const personality = this.personalityEngine.getPersonality(context.personality);
    const systemPrompt = this.buildSystemPrompt(personality, context);
    const userPrompt = this.buildUserPrompt(context);
    
    try {
      const response = await this.claude.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });
      
      const content = response.content[0].text;
      
      // Analyze response quality
      const quality = await this.analyzeResponseQuality(content, context);
      const engagement = await this.analyzeEngagementLevel(content, context);
      
      return {
        content,
        quality,
        engagement,
        personality: context.personality,
        tokens: response.usage.output_tokens,
        model: this.config.model
      };
    } catch (error) {
      this.logger.error('Claude API error', { error: error.message });
      throw new Error(`Claude API failed: ${error.message}`);
    }
  }

  /**
   * Build system prompt for Claude
   */
  buildSystemPrompt(personality, context) {
    const platformContext = this.getPlatformContext(context.platform);
    const stageContext = this.getStageContext(context.conversationStage);
    
    return `You are engaging in a ${context.chatMode} chat on ${context.platform}. 

Personality: ${personality.description}
Traits: ${personality.traits.join(', ')}
Communication Style: ${personality.communicationStyle}

Platform Context: ${platformContext}
Conversation Stage: ${stageContext}
Current Mood: ${context.mood}
Interests: ${context.interests.join(', ')}

Guidelines:
- Be natural and human-like
- Match the conversation stage appropriately
- Show genuine interest in the partner
- Ask engaging follow-up questions
- Keep responses conversational (1-2 sentences typically)
- Avoid repetitive patterns
- Be responsive to the partner's energy level
- ${personality.guidelines}

IMPORTANT: Respond as a real person having a genuine conversation. Never mention being an AI or bot.`;
  }

  /**
   * Build user prompt for Claude
   */
  buildUserPrompt(context) {
    const recentHistory = context.messageHistory.slice(-6); // Last 6 messages for context
    let prompt = '';
    
    if (recentHistory.length > 0) {
      prompt += 'Recent conversation:\n';
      recentHistory.forEach(msg => {
        const speaker = msg.type === 'sent' ? 'Me' : 'Partner';
        prompt += `${speaker}: ${msg.content}\n`;
      });
    }
    
    if (context.partnerProfile && Object.keys(context.partnerProfile).length > 0) {
      prompt += `\nPartner Profile: ${JSON.stringify(context.partnerProfile)}\n`;
    }
    
    if (context.conversationGoals.length > 0) {
      prompt += `\nConversation Goals: ${context.conversationGoals.join(', ')}\n`;
    }
    
    prompt += '\nGenerate a natural, engaging response that continues the conversation:';
    
    return prompt;
  }

  /**
   * Analyze response quality
   */
  async analyzeResponseQuality(response, context) {
    const qualityFactors = {
      length: this.analyzeLength(response),
      relevance: this.analyzeRelevance(response, context),
      naturalness: this.analyzeNaturalness(response),
      engagement: this.analyzeEngagementPotential(response),
      personality: this.analyzePersonalityConsistency(response, context.personality)
    };
    
    const weights = { length: 0.15, relevance: 0.25, naturalness: 0.25, engagement: 0.25, personality: 0.1 };
    const qualityScore = Object.entries(qualityFactors).reduce((sum, [factor, score]) => {
      return sum + (score * weights[factor]);
    }, 0);
    
    return Math.round(qualityScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Analyze engagement level
   */
  async analyzeEngagementLevel(response, context) {
    const engagementFactors = {
      hasQuestion: response.includes('?') ? 1 : 0.3,
      showsInterest: this.containsInterestIndicators(response) ? 1 : 0.5,
      personalConnection: this.hasPersonalElements(response) ? 1 : 0.6,
      conversationAdvancement: this.advancesConversation(response, context) ? 1 : 0.4
    };
    
    const averageEngagement = Object.values(engagementFactors).reduce((a, b) => a + b, 0) / Object.keys(engagementFactors).length;
    return Math.round(averageEngagement * 100) / 100;
  }

  /**
   * Quality analysis helper methods
   */
  analyzeLength(response) {
    const idealLength = { min: 10, max: 100 };
    const length = response.length;
    
    if (length < idealLength.min) return 0.3;
    if (length > idealLength.max) return 0.7;
    return 1.0;
  }

  analyzeRelevance(response, context) {
    const recentMessages = context.messageHistory.slice(-3);
    if (recentMessages.length === 0) return 0.8;
    
    // Simple relevance check based on keyword overlap
    const recentKeywords = recentMessages.map(msg => msg.content.toLowerCase().split(' ')).flat();
    const responseKeywords = response.toLowerCase().split(' ');
    const overlap = responseKeywords.filter(word => recentKeywords.includes(word)).length;
    
    return Math.min(overlap / 3, 1.0); // Normalize to 0-1
  }

  analyzeNaturalness(response) {
    const unnaturalPatterns = [
      /as an ai/i,
      /i am (a|an) (ai|bot|assistant)/i,
      /my programming/i,
      /i don't have (feelings|emotions)/i
    ];
    
    const hasUnnaturalPatterns = unnaturalPatterns.some(pattern => pattern.test(response));
    if (hasUnnaturalPatterns) return 0.1;
    
    // Check for natural language patterns
    const naturalPatterns = [
      /\b(yeah|yep|nah|hmm|wow|cool|nice|awesome)\b/i,
      /\b(i think|i feel|i believe|personally)\b/i,
      /\b(what about|how about|have you)\b/i
    ];
    
    const hasNaturalPatterns = naturalPatterns.some(pattern => pattern.test(response));
    return hasNaturalPatterns ? 1.0 : 0.7;
  }

  analyzeEngagementPotential(response) {
    const engagementIndicators = [
      /\?/, // Questions
      /\b(tell me|what do you think|how about you)\b/i,
      /\b(interesting|fascinating|amazing|curious)\b/i,
      /\b(really|seriously|no way|definitely)\b/i
    ];
    
    const indicatorCount = engagementIndicators.reduce((count, pattern) => {
      return count + (pattern.test(response) ? 1 : 0);
    }, 0);
    
    return Math.min(indicatorCount / 2, 1.0);
  }

  analyzePersonalityConsistency(response, personalityType) {
    const personality = this.personalityEngine.getPersonality(personalityType);
    const keywords = personality.keywords || [];
    
    if (keywords.length === 0) return 0.8;
    
    const responseKeywords = response.toLowerCase();
    const matchingKeywords = keywords.filter(keyword => 
      responseKeywords.includes(keyword.toLowerCase())
    ).length;
    
    return Math.min(matchingKeywords / 2, 1.0);
  }

  /**
   * Helper methods for engagement analysis
   */
  containsInterestIndicators(response) {
    const interestPatterns = [
      /\b(cool|interesting|awesome|amazing|wow|nice)\b/i,
      /\b(tell me more|that's great|love that)\b/i
    ];
    
    return interestPatterns.some(pattern => pattern.test(response));
  }

  hasPersonalElements(response) {
    const personalPatterns = [
      /\b(i|me|my|myself)\b/i,
      /\b(you|your|yourself)\b/i
    ];
    
    return personalPatterns.some(pattern => pattern.test(response));
  }

  advancesConversation(response, context) {
    // Check if response introduces new topics or builds on existing ones
    const newTopicIndicators = [
      /\b(by the way|speaking of|that reminds me)\b/i,
      /\b(what about|how about|have you ever)\b/i
    ];
    
    return newTopicIndicators.some(pattern => pattern.test(response));
  }

  /**
   * Determine conversation stage
   */
  determineConversationStage(context) {
    const messageCount = context.messageHistory.length;
    const duration = Date.now() - new Date(context.startTime).getTime();
    const minutes = duration / (1000 * 60);
    
    if (messageCount < 3 || minutes < 2) return 'opening';
    if (messageCount < 15 || minutes < 10) return 'middle';
    return 'closing';
  }

  /**
   * Get platform-specific context
   */
  getPlatformContext(platform) {
    const contexts = {
      'thundr': 'Casual video chat platform, focus on fun and engaging conversation',
      'omegle': 'Anonymous chat platform, be interesting to keep partner engaged',
      'chatroulette': 'Video chat platform, visual interaction important',
      'emeraldchat': 'Interest-based matching, focus on shared interests'
    };
    
    return contexts[platform] || 'General chat platform';
  }

  /**
   * Get stage-specific context
   */
  getStageContext(stage) {
    const contexts = {
      'opening': 'Start of conversation - be welcoming, introduce yourself naturally, show interest',
      'middle': 'Conversation is flowing - ask follow-up questions, share experiences, build connection',
      'closing': 'Conversation is winding down - be gracious, express enjoyment, natural conclusion'
    };
    
    return contexts[stage];
  }

  /**
   * Update conversation context
   */
  async updateConversationContext(conversationId, update) {
    const context = this.contextMemory.getContext(conversationId);
    if (!context) return;
    
    // Add new message to history
    context.messageHistory.push({
      type: 'received',
      content: update.userMessage,
      timestamp: update.timestamp
    });
    
    context.messageHistory.push({
      type: 'sent',
      content: update.botResponse,
      timestamp: update.timestamp,
      quality: update.quality,
      engagement: update.engagement
    });
    
    // Update quality metrics
    context.qualityScore = this.updateRunningAverage(context.qualityScore, update.quality, context.messageHistory.length / 2);
    context.engagementLevel = this.updateRunningAverage(context.engagementLevel, update.engagement, context.messageHistory.length / 2);
    
    // Update activity tracking
    const activeConv = this.activeConversations.get(conversationId);
    if (activeConv) {
      activeConv.messageCount++;
      activeConv.lastActivity = new Date();
    }
    
    this.contextMemory.setContext(conversationId, context);
  }

  /**
   * Update running average
   */
  updateRunningAverage(currentAvg, newValue, count) {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  /**
   * Generate cache key for response caching
   */
  generateCacheKey(context) {
    const recentMessages = context.messageHistory.slice(-3).map(m => m.content).join('|');
    const contextKey = `${context.personality}:${context.conversationStage}:${context.mood}`;
    const hash = this.simpleHash(`${contextKey}:${recentMessages}`);
    return `conv_${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Cache response
   */
  cacheResponse(key, response) {
    // Implement LRU cache behavior
    if (this.responseCache.size >= this.cacheMaxSize) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    
    this.responseCache.set(key, {
      ...response,
      cachedAt: new Date()
    });
  }

  /**
   * Get fallback response for errors
   */
  getFallbackResponse(params) {
    const fallbacks = [
      { content: "That's interesting! Tell me more about that.", quality: 0.6, engagement: 0.7 },
      { content: "Cool! What else is going on with you?", quality: 0.6, engagement: 0.8 },
      { content: "Nice! How's your day been so far?", quality: 0.6, engagement: 0.7 },
      { content: "Awesome! What are you up to today?", quality: 0.6, engagement: 0.8 },
      { content: "That sounds great! What do you like most about it?", quality: 0.7, engagement: 0.8 }
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Update response metrics
   */
  updateResponseMetrics(conversationId, responseTime, success) {
    this.metrics.totalConversations++;
    
    if (success) {
      this.metrics.successfulResponses++;
    } else {
      this.metrics.failedResponses++;
    }
    
    // Update average response time
    const totalResponses = this.metrics.successfulResponses + this.metrics.failedResponses;
    this.metrics.averageResponseTime = ((this.metrics.averageResponseTime * (totalResponses - 1)) + responseTime) / totalResponses;
  }

  /**
   * Update overall metrics
   */
  updateMetrics() {
    const totalRequests = this.metrics.successfulResponses + this.metrics.failedResponses;
    this.metrics.cacheHitRate = totalRequests > 0 ? (this.cacheHitRate / totalRequests) * 100 : 0;
    
    this.emit('metrics-updated', this.metrics);
  }

  /**
   * Validate generate parameters
   */
  validateGenerateParams(params) {
    if (!params) {
      throw new Error('Parameters are required');
    }
    
    if (!params.lastMessage && (!params.chatHistory || params.chatHistory.length === 0)) {
      throw new Error('Either lastMessage or chatHistory is required');
    }
  }

  /**
   * Generate unique conversation ID
   */
  generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * End conversation and cleanup
   */
  async endConversation(conversationId) {
    const context = this.contextMemory.getContext(conversationId);
    if (!context) return;
    
    const conversation = this.activeConversations.get(conversationId);
    if (conversation) {
      const duration = Date.now() - conversation.startTime.getTime();
      
      // Store conversation metrics
      this.metrics.conversationLengths.push(duration);
      
      // Track personality usage
      if (!this.metrics.personalityUsage[context.personality]) {
        this.metrics.personalityUsage[context.personality] = 0;
      }
      this.metrics.personalityUsage[context.personality]++;
      
      // Store quality score
      this.metrics.qualityScores.push(context.qualityScore);
      
      this.activeConversations.delete(conversationId);
    }
    
    this.contextMemory.removeContext(conversationId);
    
    this.emit('conversation-ended', {
      conversationId,
      duration: conversation ? Date.now() - conversation.startTime.getTime() : 0,
      messageCount: conversation ? conversation.messageCount : 0,
      qualityScore: context.qualityScore,
      engagementLevel: context.engagementLevel
    });
  }

  /**
   * Get conversation analytics
   */
  getAnalytics() {
    const activeConversationCount = this.activeConversations.size;
    const avgConversationLength = this.metrics.conversationLengths.length > 0 
      ? this.metrics.conversationLengths.reduce((a, b) => a + b, 0) / this.metrics.conversationLengths.length 
      : 0;
    
    const avgQualityScore = this.metrics.qualityScores.length > 0
      ? this.metrics.qualityScores.reduce((a, b) => a + b, 0) / this.metrics.qualityScores.length
      : 0;
    
    return {
      ...this.metrics,
      activeConversationCount,
      avgConversationLength: Math.round(avgConversationLength / 1000), // Convert to seconds
      avgQualityScore: Math.round(avgQualityScore * 100) / 100,
      successRate: this.metrics.totalConversations > 0 
        ? (this.metrics.successfulResponses / this.metrics.totalConversations) * 100 
        : 0
    };
  }

  /**
   * Cleanup expired conversations
   */
  cleanupExpiredConversations() {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    for (const [conversationId, conversation] of this.activeConversations.entries()) {
      if (now - conversation.lastActivity.getTime() > maxAge) {
        this.endConversation(conversationId);
      }
    }
  }
}

module.exports = ConversationManager;