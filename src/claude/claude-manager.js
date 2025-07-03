const axios = require('axios');
const winston = require('winston');
const { EventEmitter } = require('events');

/**
 * Claude Manager - Intelligent decision making and optimization
 */
class ClaudeManager extends EventEmitter {
  constructor(apiKey, config = {}) {
    super();
    
    this.apiKey = apiKey;
    this.config = {
      model: config.model || 'claude-3-haiku-20240307',
      maxTokens: config.maxTokens || 1024,
      temperature: config.temperature || 0.7,
      cacheEnabled: config.cacheEnabled ?? true,
      ...config
    };
    
    this.anthropicClient = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
    
    // Conversation and performance tracking
    this.conversationHistory = [];
    this.performanceMetrics = new Map();
    this.decisionCache = new Map();
    this.learningData = {
      successfulResponses: [],
      failedResponses: [],
      interestSelectionPatterns: [],
      chatDurationStats: []
    };
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/claude-manager.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Analyze a bot step and suggest optimizations
   */
  async analyzeStep(stepName, context, logs) {
    try {
      const prompt = `Analyze this bot automation step and suggest optimizations:

Step: ${stepName}
Context: ${JSON.stringify(context, null, 2)}
Recent Logs: ${logs.slice(-10).join('\n')}

Consider:
1. Success rate improvement
2. Error handling strategies
3. Timing optimizations
4. Selector improvements

Respond with specific, actionable suggestions.`;

      const response = await this.makeRequest(prompt, {
        system: 'You are an expert in web automation and bot optimization.'
      });

      const analysis = {
        stepName,
        timestamp: new Date(),
        suggestions: response.content,
        context
      };

      this.emit('step-analyzed', analysis);
      return analysis;
    } catch (error) {
      this.logger.error(`Failed to analyze step ${stepName}:`, error);
      throw error;
    }
  }

  /**
   * Generate intelligent chat response based on context
   */
  async generateResponse(chatContext, userMessage) {
    try {
      // Check cache first
      const cacheKey = `${chatContext.interests.join('-')}-${userMessage.substring(0, 20)}`;
      if (this.config.cacheEnabled && this.decisionCache.has(cacheKey)) {
        this.logger.info('Using cached response');
        return this.decisionCache.get(cacheKey);
      }

      const prompt = `Generate a natural, engaging response for a video chat conversation:

User Message: "${userMessage}"
My Interests: ${chatContext.interests.join(', ')}
Chat Mode: ${chatContext.mode}
Previous Messages: ${chatContext.previousMessages.slice(-3).join('\n')}

Requirements:
- Be friendly and conversational
- Show interest in what they said
- Ask a follow-up question to keep conversation flowing
- Keep it under 2 sentences
- Match their energy level

Response:`;

      const response = await this.makeRequest(prompt, {
        system: 'You are a friendly person in a video chat. Be natural and engaging.',
        temperature: 0.8
      });

      const generatedResponse = response.content.trim();
      
      // Cache the response
      if (this.config.cacheEnabled) {
        this.decisionCache.set(cacheKey, generatedResponse);
      }

      // Track for learning
      this.conversationHistory.push({
        userMessage,
        botResponse: generatedResponse,
        context: chatContext,
        timestamp: new Date()
      });

      this.emit('response-generated', { userMessage, response: generatedResponse });
      return generatedResponse;
    } catch (error) {
      this.logger.error('Failed to generate response:', error);
      // Fallback to random response
      const fallbacks = [
        "That's interesting! Tell me more about that.",
        "Cool! I'd love to hear more.",
        "That sounds great! What else?",
        "Interesting perspective! How did you get into that?"
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  /**
   * Optimize bot configuration based on performance data
   */
  async optimizeBot(performanceLogs) {
    try {
      const metrics = this.calculateMetrics(performanceLogs);
      
      const prompt = `Analyze these bot performance metrics and suggest configuration optimizations:

Metrics:
${JSON.stringify(metrics, null, 2)}

Recent Failures:
${performanceLogs.filter(log => !log.success).slice(-5).map(log => 
  `- ${log.stepName}: ${log.error}`
).join('\n')}

Suggest specific configuration changes for:
1. Timing delays
2. Selector strategies
3. Interest selection
4. Message strategies
5. Error recovery

Provide JSON configuration updates.`;

      const response = await this.makeRequest(prompt, {
        system: 'You are an expert in bot optimization and web automation.'
      });

      try {
        // Extract JSON from response
        const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
        const optimizations = jsonMatch ? JSON.parse(jsonMatch[1]) : {};
        
        this.emit('optimizations-generated', optimizations);
        return optimizations;
      } catch (parseError) {
        this.logger.error('Failed to parse optimization JSON:', parseError);
        return {
          suggestions: response.content,
          parseError: true
        };
      }
    } catch (error) {
      this.logger.error('Failed to optimize bot:', error);
      throw error;
    }
  }

  /**
   * Analyze selector failures and suggest alternatives
   */
  async analyzeSelectorFailure(failedSelector, pageContent, elementType) {
    try {
      const prompt = `A web automation selector failed. Suggest alternative selectors:

Failed Selector: ${failedSelector}
Element Type: ${elementType}
Page Structure Sample: ${pageContent.substring(0, 2000)}

Provide 5 alternative selectors that might work, considering:
1. Different selector strategies (CSS, XPath, text)
2. Parent/child relationships
3. Attribute-based selection
4. Aria labels and roles

Format as JSON array of selector strings.`;

      const response = await this.makeRequest(prompt, {
        system: 'You are an expert in web scraping and DOM navigation.',
        temperature: 0.3
      });

      try {
        const jsonMatch = response.content.match(/\[([\s\S]*?)\]/);
        const selectors = jsonMatch ? JSON.parse(`[${jsonMatch[1]}]`) : [];
        
        this.emit('selectors-suggested', { failedSelector, suggestions: selectors });
        return selectors;
      } catch (parseError) {
        this.logger.error('Failed to parse selector suggestions:', parseError);
        return [];
      }
    } catch (error) {
      this.logger.error('Failed to analyze selector:', error);
      return [];
    }
  }

  /**
   * Learn from session data to improve future performance
   */
  async learnFromSession(sessionData) {
    try {
      const prompt = `Analyze this bot session data and identify patterns for improvement:

Session Summary:
- Total Chats: ${sessionData.totalChats}
- Successful Chats: ${sessionData.successfulChats}
- Average Chat Duration: ${sessionData.avgChatDuration}s
- Most Common Errors: ${JSON.stringify(sessionData.commonErrors)}
- Interest Success Rates: ${JSON.stringify(sessionData.interestStats)}

Identify:
1. Patterns in successful vs failed chats
2. Optimal timing strategies
3. Best performing interests
4. Common failure points

Provide actionable insights.`;

      const response = await this.makeRequest(prompt, {
        system: 'You are a data analyst specializing in bot performance optimization.'
      });

      const insights = {
        sessionId: sessionData.sessionId,
        timestamp: new Date(),
        analysis: response.content,
        metrics: sessionData
      };

      // Store learning data
      this.updateLearningData(sessionData);
      
      this.emit('session-analyzed', insights);
      return insights;
    } catch (error) {
      this.logger.error('Failed to learn from session:', error);
      throw error;
    }
  }

  /**
   * Make API request to Claude
   */
  async makeRequest(prompt, options = {}) {
    try {
      const response = await this.anthropicClient.post('/messages', {
        model: options.model || this.config.model,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        system: options.system || 'You are a helpful assistant for bot automation.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return response.data.content[0];
    } catch (error) {
      this.logger.error('Claude API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Calculate performance metrics from logs
   */
  calculateMetrics(logs) {
    const totalSteps = logs.length;
    const successfulSteps = logs.filter(log => log.success).length;
    const failedSteps = logs.filter(log => !log.success).length;
    
    const stepDurations = {};
    const errorTypes = {};
    
    logs.forEach(log => {
      // Track step durations
      if (!stepDurations[log.stepName]) {
        stepDurations[log.stepName] = [];
      }
      stepDurations[log.stepName].push(log.duration);
      
      // Track error types
      if (!log.success && log.error) {
        errorTypes[log.error] = (errorTypes[log.error] || 0) + 1;
      }
    });
    
    // Calculate average durations
    const avgDurations = {};
    Object.entries(stepDurations).forEach(([step, durations]) => {
      avgDurations[step] = durations.reduce((a, b) => a + b, 0) / durations.length;
    });
    
    return {
      totalSteps,
      successfulSteps,
      failedSteps,
      successRate: (successfulSteps / totalSteps * 100).toFixed(2) + '%',
      avgStepDurations: avgDurations,
      commonErrors: Object.entries(errorTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }))
    };
  }

  /**
   * Update learning data for continuous improvement
   */
  updateLearningData(sessionData) {
    // Update chat duration statistics
    if (sessionData.chatDurations) {
      this.learningData.chatDurationStats.push(...sessionData.chatDurations);
    }
    
    // Update interest selection patterns
    if (sessionData.interestStats) {
      Object.entries(sessionData.interestStats).forEach(([interest, stats]) => {
        const existing = this.learningData.interestSelectionPatterns.find(
          p => p.interest === interest
        );
        if (existing) {
          existing.successCount += stats.success || 0;
          existing.failCount += stats.fail || 0;
        } else {
          this.learningData.interestSelectionPatterns.push({
            interest,
            successCount: stats.success || 0,
            failCount: stats.fail || 0
          });
        }
      });
    }
    
    // Persist learning data
    this.saveLearningData();
  }

  /**
   * Save learning data to file
   */
  saveLearningData() {
    try {
      const fs = require('fs');
      fs.writeFileSync(
        'data/claude-learning-data.json',
        JSON.stringify(this.learningData, null, 2)
      );
      this.logger.info('Learning data saved');
    } catch (error) {
      this.logger.error('Failed to save learning data:', error);
    }
  }

  /**
   * Load learning data from file
   */
  loadLearningData() {
    try {
      const fs = require('fs');
      if (fs.existsSync('data/claude-learning-data.json')) {
        this.learningData = JSON.parse(
          fs.readFileSync('data/claude-learning-data.json', 'utf-8')
        );
        this.logger.info('Learning data loaded');
      }
    } catch (error) {
      this.logger.error('Failed to load learning data:', error);
    }
  }
}

module.exports = ClaudeManager;