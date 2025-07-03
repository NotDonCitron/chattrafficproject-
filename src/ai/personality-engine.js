const winston = require('winston');
const { EventEmitter } = require('events');

/**
 * PersonalityEngine - Dynamic personality management for conversational AI
 * Handles personality selection, adaptation, and consistency across conversations
 */
class PersonalityEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableAdaptivePersonality: config.enableAdaptivePersonality ?? true,
      personalityAdaptationRate: config.personalityAdaptationRate || 0.1,
      abTestingEnabled: config.abTestingEnabled ?? true,
      ...config
    };
    
    // Initialize personality profiles
    this.personalities = this.initializePersonalities();
    
    // Performance tracking for each personality
    this.personalityMetrics = new Map();
    
    // A/B testing data
    this.abTestData = new Map();
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/personality-engine.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.initializeMetrics();
  }

  /**
   * Initialize personality profiles with detailed characteristics
   */
  initializePersonalities() {
    return {
      friendly: {
        name: 'Friendly',
        description: 'Warm, welcoming, and genuinely interested in others',
        traits: ['warm', 'welcoming', 'genuine', 'supportive', 'positive'],
        communicationStyle: 'Uses warm language, lots of positivity, exclamation points, asks caring questions',
        keywords: ['awesome', 'amazing', 'wonderful', 'love', 'great', 'fantastic', 'excited'],
        responsePatterns: [
          'That sounds amazing!',
          'I love that!',
          'How wonderful!',
          'That must be exciting!'
        ],
        guidelines: 'Be genuinely enthusiastic and show real interest in what the partner shares. Use warm, positive language.',
        strengths: ['builds rapport quickly', 'makes others feel valued', 'creates positive atmosphere'],
        idealFor: ['casual conversations', 'first meetings', 'when partner seems shy'],
        effectiveness: {
          opening: 0.9,
          middle: 0.8,
          closing: 0.9
        }
      },
      
      professional: {
        name: 'Professional',
        description: 'Articulate, thoughtful, and intellectually engaging',
        traits: ['articulate', 'thoughtful', 'intelligent', 'respectful', 'composed'],
        communicationStyle: 'Clear, well-structured responses, thoughtful questions, proper grammar',
        keywords: ['interesting', 'perspective', 'consider', 'appreciate', 'understand', 'thoughtful'],
        responsePatterns: [
          'That\'s an interesting perspective.',
          'I appreciate you sharing that.',
          'What led you to that conclusion?',
          'That\'s quite thoughtful.'
        ],
        guidelines: 'Maintain intellectual curiosity while being approachable. Ask thoughtful follow-up questions.',
        strengths: ['builds credibility', 'encourages deep conversation', 'shows respect for intelligence'],
        idealFor: ['educated partners', 'serious topics', 'professional contexts'],
        effectiveness: {
          opening: 0.7,
          middle: 0.9,
          closing: 0.8
        }
      },
      
      casual: {
        name: 'Casual',
        description: 'Relaxed, easy-going, and naturally conversational',
        traits: ['relaxed', 'easy-going', 'natural', 'laid-back', 'approachable'],
        communicationStyle: 'Informal language, contractions, natural flow, conversational',
        keywords: ['cool', 'nice', 'yeah', 'totally', 'pretty', 'kinda', 'sorta'],
        responsePatterns: [
          'Yeah, that\'s pretty cool.',
          'Nice! How\'d that go?',
          'That\'s kinda awesome.',
          'Cool, I can see that.'
        ],
        guidelines: 'Keep it natural and relaxed. Use casual language but stay engaged and interested.',
        strengths: ['feels natural', 'reduces pressure', 'encourages openness'],
        idealFor: ['young adults', 'informal settings', 'building comfort'],
        effectiveness: {
          opening: 0.8,
          middle: 0.8,
          closing: 0.7
        }
      },
      
      witty: {
        name: 'Witty',
        description: 'Clever, humorous, and engaging with wordplay',
        traits: ['clever', 'humorous', 'quick', 'playful', 'engaging'],
        communicationStyle: 'Uses humor appropriately, clever observations, light teasing, wordplay',
        keywords: ['funny', 'hilarious', 'clever', 'witty', 'joke', 'humor', 'laugh'],
        responsePatterns: [
          'Haha, that\'s pretty clever!',
          'You\'ve got a good sense of humor.',
          'That made me laugh!',
          'Witty! I like that.'
        ],
        guidelines: 'Use humor to enhance conversation but never at partner\'s expense. Keep it light and fun.',
        strengths: ['creates memorable interactions', 'reduces tension', 'shows personality'],
        idealFor: ['humor-loving partners', 'breaking ice', 'lightening mood'],
        effectiveness: {
          opening: 0.9,
          middle: 0.7,
          closing: 0.6
        }
      },
      
      empathetic: {
        name: 'Empathetic',
        description: 'Understanding, supportive, and emotionally intelligent',
        traits: ['understanding', 'supportive', 'caring', 'patient', 'sensitive'],
        communicationStyle: 'Validates feelings, asks about emotions, offers support, active listening',
        keywords: ['understand', 'feel', 'support', 'care', 'listen', 'here', 'important'],
        responsePatterns: [
          'I can understand how that would feel.',
          'That sounds really important to you.',
          'I\'m here to listen.',
          'Your feelings about that make sense.'
        ],
        guidelines: 'Focus on emotional connection and validation. Show genuine care for partner\'s wellbeing.',
        strengths: ['builds deep connection', 'provides emotional support', 'encourages sharing'],
        idealFor: ['emotional conversations', 'when partner is upset', 'building trust'],
        effectiveness: {
          opening: 0.6,
          middle: 0.9,
          closing: 0.8
        }
      },
      
      curious: {
        name: 'Curious',
        description: 'Inquisitive, exploratory, and genuinely interested in learning',
        traits: ['inquisitive', 'exploratory', 'interested', 'open-minded', 'engaging'],
        communicationStyle: 'Asks lots of questions, explores topics deeply, shows genuine interest',
        keywords: ['why', 'how', 'what', 'tell me', 'explore', 'discover', 'learn'],
        responsePatterns: [
          'That\'s fascinating! Tell me more.',
          'How did you get into that?',
          'What\'s that like?',
          'I\'d love to learn more about that.'
        ],
        guidelines: 'Ask engaging questions that encourage the partner to share more. Show genuine curiosity.',
        strengths: ['keeps conversation flowing', 'makes partner feel interesting', 'discovers common ground'],
        idealFor: ['knowledge sharing', 'getting to know someone', 'exploring interests'],
        effectiveness: {
          opening: 0.8,
          middle: 0.9,
          closing: 0.7
        }
      }
    };
  }

  /**
   * Initialize metrics tracking for each personality
   */
  initializeMetrics() {
    Object.keys(this.personalities).forEach(personalityType => {
      this.personalityMetrics.set(personalityType, {
        usageCount: 0,
        successRate: 0,
        averageEngagement: 0,
        averageQuality: 0,
        conversationLengths: [],
        stageEffectiveness: {
          opening: { attempts: 0, successes: 0 },
          middle: { attempts: 0, successes: 0 },
          closing: { attempts: 0, successes: 0 }
        },
        platformPerformance: {},
        partnerTypeEffectiveness: {}
      });
    });
  }

  /**
   * Select optimal personality based on context
   */
  selectOptimalPersonality(context = {}) {
    try {
      // If specific personality requested, validate and return
      if (context.requestedPersonality) {
        if (this.personalities[context.requestedPersonality]) {
          return context.requestedPersonality;
        }
        this.logger.warn(`Requested personality '${context.requestedPersonality}' not found, selecting optimal`);
      }
      
      // Analyze context factors
      const contextFactors = this.analyzeContext(context);
      
      // Get personality scores based on context
      const personalityScores = this.calculatePersonalityScores(contextFactors);
      
      // Apply A/B testing if enabled
      if (this.config.abTestingEnabled) {
        return this.applyABTesting(personalityScores, context);
      }
      
      // Select highest scoring personality
      const optimalPersonality = Object.entries(personalityScores)
        .sort(([,a], [,b]) => b - a)[0][0];
      
      this.logger.info('Selected optimal personality', {
        personality: optimalPersonality,
        score: personalityScores[optimalPersonality],
        context: contextFactors
      });
      
      return optimalPersonality;
    } catch (error) {
      this.logger.error('Error selecting personality, defaulting to friendly', { error: error.message });
      return 'friendly';
    }
  }

  /**
   * Analyze conversation context
   */
  analyzeContext(context) {
    const factors = {
      platform: context.platform || 'unknown',
      chatMode: context.chatMode || 'text',
      conversationStage: context.conversationStage || 'opening',
      partnerAge: context.partnerProfile?.age || 'unknown',
      partnerInterests: context.partnerProfile?.interests || [],
      conversationGoals: context.conversationGoals || ['engagement'],
      timeOfDay: this.getTimeOfDay(),
      isFirstInteraction: !context.hasHistory,
      mood: context.currentMood || 'neutral',
      interests: context.interests || []
    };
    
    return factors;
  }

  /**
   * Calculate personality effectiveness scores
   */
  calculatePersonalityScores(contextFactors) {
    const scores = {};
    
    Object.entries(this.personalities).forEach(([personalityType, personality]) => {
      let score = 0.5; // Base score
      
      // Stage effectiveness
      const stageEffect = personality.effectiveness[contextFactors.conversationStage] || 0.7;
      score += stageEffect * 0.3;
      
      // Platform compatibility
      score += this.getPlatformCompatibility(personalityType, contextFactors.platform) * 0.2;
      
      // Historical performance
      const metrics = this.personalityMetrics.get(personalityType);
      if (metrics && metrics.usageCount > 10) {
        score += metrics.successRate * 0.3;
      }
      
      // Goal alignment
      score += this.getGoalAlignment(personality, contextFactors.conversationGoals) * 0.2;
      
      scores[personalityType] = Math.min(score, 1.0);
    });
    
    return scores;
  }

  /**
   * Get platform compatibility score
   */
  getPlatformCompatibility(personalityType, platform) {
    const compatibility = {
      thundr: {
        friendly: 0.9, professional: 0.6, casual: 0.8, witty: 0.9, empathetic: 0.7, curious: 0.8
      },
      omegle: {
        friendly: 0.8, professional: 0.5, casual: 0.9, witty: 0.9, empathetic: 0.6, curious: 0.8
      },
      chatroulette: {
        friendly: 0.9, professional: 0.4, casual: 0.8, witty: 0.8, empathetic: 0.7, curious: 0.7
      },
      emeraldchat: {
        friendly: 0.8, professional: 0.7, casual: 0.7, witty: 0.7, empathetic: 0.8, curious: 0.9
      }
    };
    
    return compatibility[platform]?.[personalityType] || 0.7;
  }

  /**
   * Get goal alignment score
   */
  getGoalAlignment(personality, goals) {
    const goalAlignment = {
      engagement: { friendly: 0.9, witty: 0.9, curious: 0.8, casual: 0.7, empathetic: 0.7, professional: 0.6 },
      entertainment: { witty: 0.9, friendly: 0.8, casual: 0.8, curious: 0.7, empathetic: 0.6, professional: 0.5 },
      learning: { curious: 0.9, professional: 0.8, empathetic: 0.7, friendly: 0.6, casual: 0.5, witty: 0.5 },
      support: { empathetic: 0.9, friendly: 0.8, professional: 0.7, curious: 0.6, casual: 0.5, witty: 0.4 },
      connection: { empathetic: 0.9, friendly: 0.8, curious: 0.7, professional: 0.6, casual: 0.6, witty: 0.5 }
    };
    
    let totalAlignment = 0;
    goals.forEach(goal => {
      const alignment = goalAlignment[goal];
      if (alignment) {
        Object.entries(alignment).forEach(([type, score]) => {
          if (type === personality.name.toLowerCase()) {
            totalAlignment += score;
          }
        });
      }
    });
    
    return goals.length > 0 ? totalAlignment / goals.length : 0.7;
  }

  /**
   * Apply A/B testing to personality selection
   */
  applyABTesting(personalityScores, context) {
    const sessionId = context.sessionId || 'unknown';
    
    // Use hash of session ID to consistently assign test group
    const testGroup = this.hashCode(sessionId) % 100;
    
    // 20% of users get random personality for testing
    if (testGroup < 20) {
      const personalities = Object.keys(this.personalities);
      const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
      
      // Track A/B test assignment
      this.abTestData.set(sessionId, {
        assignedPersonality: randomPersonality,
        originalBest: Object.entries(personalityScores).sort(([,a], [,b]) => b - a)[0][0],
        testGroup: 'random'
      });
      
      return randomPersonality;
    }
    
    // 80% get optimal personality
    const optimalPersonality = Object.entries(personalityScores)
      .sort(([,a], [,b]) => b - a)[0][0];
    
    this.abTestData.set(sessionId, {
      assignedPersonality: optimalPersonality,
      originalBest: optimalPersonality,
      testGroup: 'optimal'
    });
    
    return optimalPersonality;
  }

  /**
   * Get personality definition
   */
  getPersonality(personalityType) {
    if (!this.personalities[personalityType]) {
      this.logger.warn(`Personality type '${personalityType}' not found, returning friendly`);
      return this.personalities.friendly;
    }
    
    return this.personalities[personalityType];
  }

  /**
   * Get all available personalities
   */
  getProfiles() {
    return Object.keys(this.personalities).map(type => ({
      type,
      ...this.personalities[type]
    }));
  }

  /**
   * Adapt personality based on conversation feedback
   */
  adaptPersonality(conversationData) {
    if (!this.config.enableAdaptivePersonality) return;
    
    const { personalityType, engagementScore, qualityScore, success, stage, platform } = conversationData;
    
    try {
      const metrics = this.personalityMetrics.get(personalityType);
      if (!metrics) return;
      
      // Update usage count
      metrics.usageCount++;
      
      // Update success rate
      metrics.successRate = this.updateRunningAverage(
        metrics.successRate, 
        success ? 1 : 0, 
        metrics.usageCount
      );
      
      // Update engagement and quality
      if (engagementScore !== undefined) {
        metrics.averageEngagement = this.updateRunningAverage(
          metrics.averageEngagement,
          engagementScore,
          metrics.usageCount
        );
      }
      
      if (qualityScore !== undefined) {
        metrics.averageQuality = this.updateRunningAverage(
          metrics.averageQuality,
          qualityScore,
          metrics.usageCount
        );
      }
      
      // Update stage effectiveness
      if (stage) {
        const stageMetrics = metrics.stageEffectiveness[stage];
        stageMetrics.attempts++;
        if (success) stageMetrics.successes++;
      }
      
      // Update platform performance
      if (platform) {
        if (!metrics.platformPerformance[platform]) {
          metrics.platformPerformance[platform] = { attempts: 0, successes: 0, avgQuality: 0 };
        }
        
        const platformMetrics = metrics.platformPerformance[platform];
        platformMetrics.attempts++;
        if (success) platformMetrics.successes++;
        
        if (qualityScore !== undefined) {
          platformMetrics.avgQuality = this.updateRunningAverage(
            platformMetrics.avgQuality,
            qualityScore,
            platformMetrics.attempts
          );
        }
      }
      
      this.personalityMetrics.set(personalityType, metrics);
      
      this.emit('personality-adapted', {
        personalityType,
        metrics: metrics,
        adaptationData: conversationData
      });
      
    } catch (error) {
      this.logger.error('Error adapting personality', { error: error.message, conversationData });
    }
  }

  /**
   * Update running average
   */
  updateRunningAverage(currentAvg, newValue, count) {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  /**
   * Get personality recommendations
   */
  getRecommendations(context) {
    const contextFactors = this.analyzeContext(context);
    const personalityScores = this.calculatePersonalityScores(contextFactors);
    
    // Sort personalities by score
    const rankedPersonalities = Object.entries(personalityScores)
      .sort(([,a], [,b]) => b - a)
      .map(([type, score]) => ({
        type,
        score: Math.round(score * 100),
        personality: this.personalities[type],
        reasoning: this.getRecommendationReasoning(type, contextFactors)
      }));
    
    return {
      recommended: rankedPersonalities[0],
      alternatives: rankedPersonalities.slice(1, 3),
      contextFactors
    };
  }

  /**
   * Get reasoning for personality recommendation
   */
  getRecommendationReasoning(personalityType, contextFactors) {
    const personality = this.personalities[personalityType];
    const metrics = this.personalityMetrics.get(personalityType);
    
    const reasons = [];
    
    // Stage effectiveness
    const stageScore = personality.effectiveness[contextFactors.conversationStage];
    if (stageScore > 0.8) {
      reasons.push(`Highly effective for ${contextFactors.conversationStage} stage (${Math.round(stageScore * 100)}%)`);
    }
    
    // Platform compatibility
    const platformScore = this.getPlatformCompatibility(personalityType, contextFactors.platform);
    if (platformScore > 0.8) {
      reasons.push(`Great fit for ${contextFactors.platform} platform (${Math.round(platformScore * 100)}%)`);
    }
    
    // Historical performance
    if (metrics && metrics.usageCount > 10) {
      if (metrics.successRate > 0.8) {
        reasons.push(`Strong historical performance (${Math.round(metrics.successRate * 100)}% success rate)`);
      }
      if (metrics.averageEngagement > 0.8) {
        reasons.push(`High engagement scores (avg: ${Math.round(metrics.averageEngagement * 100)}%)`);
      }
    }
    
    // Ideal usage scenarios
    if (personality.idealFor) {
      const relevantScenarios = personality.idealFor.filter(scenario => 
        contextFactors.conversationStage.includes(scenario) ||
        contextFactors.platform.includes(scenario) ||
        contextFactors.chatMode.includes(scenario)
      );
      
      if (relevantScenarios.length > 0) {
        reasons.push(`Ideal for: ${relevantScenarios.join(', ')}`);
      }
    }
    
    return reasons.length > 0 ? reasons : ['General effectiveness for this context'];
  }

  /**
   * Get personality analytics
   */
  getAnalytics() {
    const analytics = {
      totalUsage: 0,
      personalityBreakdown: {},
      topPerformingPersonalities: [],
      abTestResults: {},
      recommendations: []
    };
    
    // Calculate personality breakdown and performance
    this.personalityMetrics.forEach((metrics, personalityType) => {
      analytics.totalUsage += metrics.usageCount;
      
      analytics.personalityBreakdown[personalityType] = {
        usageCount: metrics.usageCount,
        usagePercentage: 0, // Will calculate after total
        successRate: Math.round(metrics.successRate * 100),
        averageEngagement: Math.round(metrics.averageEngagement * 100),
        averageQuality: Math.round(metrics.averageQuality * 100),
        stageEffectiveness: this.calculateStageEffectiveness(metrics.stageEffectiveness),
        platformPerformance: this.calculatePlatformPerformance(metrics.platformPerformance)
      };
    });
    
    // Calculate usage percentages
    Object.keys(analytics.personalityBreakdown).forEach(personalityType => {
      const breakdown = analytics.personalityBreakdown[personalityType];
      breakdown.usagePercentage = analytics.totalUsage > 0 
        ? Math.round((breakdown.usageCount / analytics.totalUsage) * 100)
        : 0;
    });
    
    // Get top performing personalities
    analytics.topPerformingPersonalities = Object.entries(analytics.personalityBreakdown)
      .sort((a, b) => b[1].successRate - a[1].successRate)
      .slice(0, 3)
      .map(([type, data]) => ({ type, ...data }));
    
    // A/B test results
    analytics.abTestResults = this.getABTestResults();
    
    return analytics;
  }

  /**
   * Calculate stage effectiveness
   */
  calculateStageEffectiveness(stageData) {
    const effectiveness = {};
    
    Object.entries(stageData).forEach(([stage, data]) => {
      effectiveness[stage] = data.attempts > 0 
        ? Math.round((data.successes / data.attempts) * 100)
        : 0;
    });
    
    return effectiveness;
  }

  /**
   * Calculate platform performance
   */
  calculatePlatformPerformance(platformData) {
    const performance = {};
    
    Object.entries(platformData).forEach(([platform, data]) => {
      performance[platform] = {
        successRate: data.attempts > 0 ? Math.round((data.successes / data.attempts) * 100) : 0,
        avgQuality: Math.round(data.avgQuality * 100),
        attempts: data.attempts
      };
    });
    
    return performance;
  }

  /**
   * Get A/B test results
   */
  getABTestResults() {
    const results = {
      totalTests: this.abTestData.size,
      randomAssignments: 0,
      optimalAssignments: 0,
      performanceComparison: {}
    };
    
    this.abTestData.forEach((data, sessionId) => {
      if (data.testGroup === 'random') {
        results.randomAssignments++;
      } else {
        results.optimalAssignments++;
      }
    });
    
    return results;
  }

  /**
   * Get time of day context
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Simple hash function for A/B testing
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

module.exports = PersonalityEngine;