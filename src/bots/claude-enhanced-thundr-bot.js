const { chromium } = require('playwright');
const { EventEmitter } = require('events');
const ClaudeManager = require('../claude/claude-manager');
const PerformanceLogger = require('../logging/performance-logger');
const SelfHealingEngine = require('../self-healing/self-healing-engine');
const ThundrBot = require('./thundr-bot');

/**
 * Claude-Enhanced Thundr Bot
 * Integrates AI decision making, comprehensive logging, and self-healing
 */
class ClaudeEnhancedThundrBot extends ThundrBot {
  constructor(config = {}) {
    super(config);
    
    // Initialize Claude integration
    this.claudeManager = new ClaudeManager(config.claudeApiKey, {
      model: config.claudeModel || 'claude-3-haiku-20240307',
      cacheEnabled: config.claudeCacheEnabled ?? true
    });
    
    // Initialize performance logger
    this.performanceLogger = new PerformanceLogger({
      detailedLogging: config.detailedLogging ?? true,
      metricsInterval: config.metricsInterval || 30000
    });
    
    // Initialize self-healing engine
    this.selfHealingEngine = new SelfHealingEngine({
      autoLearn: config.autoLearn ?? true,
      domScanningEnabled: config.domScanningEnabled ?? true
    });
    
    // Enhanced configuration
    this.config = {
      ...this.config,
      useClaudeForResponses: config.useClaudeForResponses ?? true,
      adaptiveInterests: config.adaptiveInterests ?? true,
      performanceOptimization: config.performanceOptimization ?? true,
      maxHealingAttempts: config.maxHealingAttempts || 3
    };
    
    // Session tracking
    this.sessionData = {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      chats: [],
      errors: [],
      healingAttempts: 0,
      claudeInteractions: 0
    };
    
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for components
   */
  setupEventListeners() {
    // Claude Manager events
    this.claudeManager.on('response-generated', (data) => {
      this.sessionData.claudeInteractions++;
      this.logger.info('Claude response generated', data);
    });
    
    this.claudeManager.on('optimizations-generated', (optimizations) => {
      this.applyOptimizations(optimizations);
    });
    
    // Performance Logger events
    this.performanceLogger.on('step-logged', (stepData) => {
      if (!stepData.success) {
        this.sessionData.errors.push(stepData);
      }
    });
    
    this.performanceLogger.on('metrics-updated', (metrics) => {
      this.emit('metrics-updated', metrics);
    });
    
    // Self-Healing Engine events
    this.selfHealingEngine.on('healed', (healingData) => {
      this.sessionData.healingAttempts++;
      this.logger.info('Self-healing successful', healingData);
    });
    
    this.selfHealingEngine.on('healing-failed', (data) => {
      this.logger.error('Self-healing failed', data);
    });
  }

  /**
   * Execute a step with comprehensive logging and self-healing
   */
  async executeStepWithEnhancements(stepName, stepFunction, context = {}) {
    const step = this.performanceLogger.startStep(stepName, context);
    
    try {
      // Add pre-step analysis if critical step
      if (this.isCriticalStep(stepName)) {
        await this.preStepAnalysis(stepName, context);
      }
      
      // Execute the step
      const result = await stepFunction();
      
      // Log success
      step.end(true, { result });
      
      // Learn from success
      if (this.config.autoLearn && context.selector) {
        this.selfHealingEngine.addSelectorToCache(
          `${context.elementType}_${stepName}`,
          context.selector,
          0.9
        );
      }
      
      return result;
    } catch (error) {
      // Log failure
      step.end(false, { error: error.message });
      
      // Attempt self-healing
      if (this.sessionData.healingAttempts < this.config.maxHealingAttempts) {
        const healingResult = await this.selfHealingEngine.heal(error, {
          ...context,
          stepName,
          page: this.page
        });
        
        if (healingResult.success) {
          // Retry with healed approach
          return await this.retryWithHealedApproach(stepName, stepFunction, healingResult);
        }
      }
      
      // Analyze failure with Claude
      await this.analyzeFailureWithClaude(stepName, error, context);
      
      throw error;
    }
  }

  /**
   * Override parent methods with enhanced versions
   */
  async start() {
    return await this.executeStepWithEnhancements(
      'browser_start',
      () => super.start(),
      { critical: true }
    );
  }

  async openThundr() {
    return await this.executeStepWithEnhancements(
      'open_thundr',
      () => super.openThundr(),
      { url: 'https://thundr.com' }
    );
  }

  async selectInterests() {
    const step = this.performanceLogger.startStep('interest_selection');
    
    try {
      // Get adaptive interests if enabled
      let interests = this.config.interests;
      if (this.config.adaptiveInterests) {
        interests = await this.getAdaptiveInterests();
      }
      
      this.logger.info('Selecting interests', { interests });
      
      // Try multiple selection strategies
      const strategies = [
        () => this.selectInterestsByButton(interests),
        () => this.selectInterestsByCheckbox(interests),
        () => this.selectInterestsByClick(interests)
      ];
      
      for (const strategy of strategies) {
        try {
          const result = await strategy();
          if (result) {
            step.end(true, { method: strategy.name, selected: result });
            return true;
          }
        } catch (e) {
          this.logger.warn('Interest selection strategy failed', { error: e.message });
        }
      }
      
      // Use self-healing if all strategies fail
      const healingContext = {
        elementType: 'button',
        keywords: interests,
        purpose: 'interest selection'
      };
      
      const healed = await this.selfHealingEngine.scanDOMForSimilarElements(
        new Error('Interest selection failed'),
        { page: this.page, ...healingContext }
      );
      
      if (healed.success) {
        step.end(true, { method: 'self_healed', selector: healed.selector });
        return true;
      }
      
      step.end(false, { error: 'All interest selection strategies failed' });
      return false;
    } catch (error) {
      step.end(false, { error: error.message });
      throw error;
    }
  }

  async sendMessage(message) {
    const step = this.performanceLogger.startStep('send_message', { message });
    
    try {
      // Use Claude to enhance message if enabled
      let enhancedMessage = message;
      if (this.config.useClaudeForResponses && this.messageHistory.length > 0) {
        enhancedMessage = await this.generateClaudeResponse(message);
      }
      
      // Send the message
      const result = await super.sendMessage(enhancedMessage);
      
      step.end(result, { 
        originalMessage: message,
        sentMessage: enhancedMessage,
        enhanced: message !== enhancedMessage
      });
      
      return result;
    } catch (error) {
      step.end(false, { error: error.message });
      
      // Try self-healing for message sending
      const healed = await this.selfHealingEngine.heal(error, {
        page: this.page,
        elementType: 'input',
        purpose: 'message input',
        stepName: 'send_message'
      });
      
      if (healed.success && healed.selector) {
        // Retry with healed selector
        try {
          await this.page.fill(healed.selector, enhancedMessage);
          await this.page.keyboard.press('Enter');
          return true;
        } catch (retryError) {
          this.logger.error('Failed to send message after healing', retryError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Generate intelligent response using Claude
   */
  async generateClaudeResponse(originalMessage) {
    try {
      const lastMessages = this.messageHistory.slice(-5).map(m => 
        `${m.type === 'sent' ? 'Me' : 'Them'}: ${m.message}`
      );
      
      const context = {
        interests: this.config.interests,
        mode: this.config.chatMode,
        previousMessages: lastMessages
      };
      
      const response = await this.claudeManager.generateResponse(
        context,
        this.messageHistory[this.messageHistory.length - 1]?.message || ''
      );
      
      return response || originalMessage;
    } catch (error) {
      this.logger.error('Failed to generate Claude response', error);
      return originalMessage;
    }
  }

  /**
   * Get adaptive interests based on success rates
   */
  async getAdaptiveInterests() {
    const learningData = this.selfHealingEngine.learningData;
    const interestStats = this.claudeManager.learningData.interestSelectionPatterns;
    
    if (interestStats.length === 0) {
      return this.config.interests;
    }
    
    // Sort by success rate
    const sortedInterests = interestStats
      .filter(stat => stat.successCount + stat.failCount > 2) // Min attempts
      .map(stat => ({
        interest: stat.interest,
        successRate: stat.successCount / (stat.successCount + stat.failCount)
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5) // Top 5
      .map(item => item.interest);
    
    return sortedInterests.length > 0 ? sortedInterests : this.config.interests;
  }

  /**
   * Interest selection strategies
   */
  async selectInterestsByButton(interests) {
    const buttons = await this.page.$$('button');
    let selected = 0;
    
    for (const button of buttons) {
      const text = await button.textContent();
      if (interests.some(interest => 
        text.toLowerCase().includes(interest.toLowerCase())
      )) {
        await button.click();
        selected++;
        await this.randomDelay(500, 1000);
      }
    }
    
    return selected > 0 ? selected : null;
  }

  async selectInterestsByCheckbox(interests) {
    const checkboxes = await this.page.$$('input[type="checkbox"]');
    let selected = 0;
    
    for (const checkbox of checkboxes) {
      const label = await checkbox.evaluate(el => 
        el.nextElementSibling?.textContent || 
        el.parentElement?.textContent || ''
      );
      
      if (interests.some(interest => 
        label.toLowerCase().includes(interest.toLowerCase())
      )) {
        await checkbox.check();
        selected++;
        await this.randomDelay(300, 600);
      }
    }
    
    return selected > 0 ? selected : null;
  }

  async selectInterestsByClick(interests) {
    // Try clicking elements containing interest text
    let selected = 0;
    
    for (const interest of interests) {
      try {
        await this.page.click(`text="${interest}"`, { timeout: 2000 });
        selected++;
        await this.randomDelay(500, 1000);
      } catch (e) {
        // Continue with next interest
      }
    }
    
    return selected > 0 ? selected : null;
  }

  /**
   * Pre-step analysis for critical steps
   */
  async preStepAnalysis(stepName, context) {
    if (this.sessionData.errors.length > 0) {
      const recentErrors = this.sessionData.errors.slice(-3);
      const analysis = await this.claudeManager.analyzeStep(
        stepName,
        context,
        recentErrors.map(e => e.error)
      );
      
      if (analysis.suggestions) {
        this.logger.info('Pre-step analysis suggestions', {
          step: stepName,
          suggestions: analysis.suggestions
        });
      }
    }
  }

  /**
   * Retry with healed approach
   */
  async retryWithHealedApproach(stepName, originalFunction, healingResult) {
    this.logger.info('Retrying with healed approach', {
      step: stepName,
      method: healingResult.method
    });
    
    // Apply healing result modifications
    if (healingResult.selector) {
      // Temporarily override selector
      const originalSelector = this.config[`${stepName}Selector`];
      this.config[`${stepName}Selector`] = healingResult.selector;
      
      try {
        const result = await originalFunction();
        return result;
      } finally {
        // Restore original selector
        this.config[`${stepName}Selector`] = originalSelector;
      }
    }
    
    if (healingResult.newTimeout) {
      const originalTimeout = this.config.timeout;
      this.config.timeout = healingResult.newTimeout;
      
      try {
        const result = await originalFunction();
        return result;
      } finally {
        this.config.timeout = originalTimeout;
      }
    }
    
    return await originalFunction();
  }

  /**
   * Analyze failure with Claude
   */
  async analyzeFailureWithClaude(stepName, error, context) {
    try {
      const logs = this.performanceLogger.stepLogs.slice(-10);
      const analysis = await this.claudeManager.analyzeStep(
        stepName,
        { ...context, error: error.message },
        logs.map(log => `${log.stepName}: ${log.success ? 'SUCCESS' : 'FAILED'}`)
      );
      
      this.logger.info('Claude failure analysis', {
        step: stepName,
        analysis: analysis.suggestions
      });
      
      // Store analysis for future learning
      this.sessionData.failureAnalyses = this.sessionData.failureAnalyses || [];
      this.sessionData.failureAnalyses.push(analysis);
    } catch (analysisError) {
      this.logger.error('Failed to analyze with Claude', analysisError);
    }
  }

  /**
   * Apply optimizations suggested by Claude
   */
  applyOptimizations(optimizations) {
    this.logger.info('Applying Claude optimizations', optimizations);
    
    if (optimizations.delays) {
      Object.assign(this.config.delay, optimizations.delays);
    }
    
    if (optimizations.timeouts) {
      Object.keys(optimizations.timeouts).forEach(key => {
        this.config[key] = optimizations.timeouts[key];
      });
    }
    
    if (optimizations.interests) {
      this.config.interests = optimizations.interests;
    }
    
    if (optimizations.messages) {
      this.config.messages = [...this.config.messages, ...optimizations.messages];
    }
  }

  /**
   * Check if step is critical
   */
  isCriticalStep(stepName) {
    const criticalSteps = [
      'browser_start',
      'open_thundr',
      'interest_selection',
      'chat_start',
      'send_message'
    ];
    
    return criticalSteps.includes(stepName);
  }

  /**
   * Override run method with enhanced session management
   */
  async run() {
    this.logger.info('Starting Claude-Enhanced Bot', {
      sessionId: this.sessionData.sessionId,
      config: {
        interests: this.config.interests,
        chatMode: this.config.chatMode,
        useClaudeForResponses: this.config.useClaudeForResponses
      }
    });
    
    try {
      const result = await super.run();
      
      // Analyze session performance
      await this.analyzeSessionPerformance();
      
      return result;
    } catch (error) {
      this.logger.error('Bot run failed', error);
      
      // Generate comprehensive error report
      const errorReport = await this.generateErrorReport(error);
      this.emit('error-report', errorReport);
      
      throw error;
    } finally {
      // End performance logging session
      const finalReport = this.performanceLogger.endSession();
      
      // Learn from session
      await this.claudeManager.learnFromSession({
        sessionId: this.sessionData.sessionId,
        totalChats: this.sessionData.chats.length,
        successfulChats: this.sessionData.chats.filter(c => c.success).length,
        avgChatDuration: this.calculateAverageChatDuration(),
        commonErrors: this.getCommonErrors(),
        interestStats: this.getInterestStats()
      });
      
      this.emit('session-completed', {
        sessionData: this.sessionData,
        performanceReport: finalReport,
        healingStats: this.selfHealingEngine.getHealingStats()
      });
    }
  }

  /**
   * Analyze session performance
   */
  async analyzeSessionPerformance() {
    const performance = this.performanceLogger.analyzePerformance();
    
    if (performance.recommendations.length > 0) {
      // Get Claude's optimization suggestions
      const optimizations = await this.claudeManager.optimizeBot(
        this.performanceLogger.stepLogs
      );
      
      if (!optimizations.parseError) {
        this.applyOptimizations(optimizations);
      }
    }
  }

  /**
   * Generate comprehensive error report
   */
  async generateErrorReport(error) {
    return {
      sessionId: this.sessionData.sessionId,
      error: {
        message: error.message,
        stack: error.stack,
        type: this.selfHealingEngine.categorizeError(error)
      },
      context: {
        lastStep: this.performanceLogger.realtimeMetrics.currentStep,
        recentErrors: this.sessionData.errors.slice(-5),
        healingAttempts: this.sessionData.healingAttempts
      },
      performance: this.performanceLogger.analyzePerformance(),
      suggestions: this.sessionData.failureAnalyses || []
    };
  }

  /**
   * Calculate average chat duration
   */
  calculateAverageChatDuration() {
    if (this.sessionData.chats.length === 0) return 0;
    
    const totalDuration = this.sessionData.chats.reduce(
      (sum, chat) => sum + (chat.duration || 0), 0
    );
    
    return totalDuration / this.sessionData.chats.length;
  }

  /**
   * Get common errors
   */
  getCommonErrors() {
    const errorCounts = {};
    
    this.sessionData.errors.forEach(error => {
      const type = this.selfHealingEngine.categorizeError({ message: error.error });
      errorCounts[type] = (errorCounts[type] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Get interest statistics
   */
  getInterestStats() {
    const stats = {};
    
    this.config.interests.forEach(interest => {
      stats[interest] = {
        success: 0,
        fail: 0
      };
    });
    
    // Update stats based on session data
    // This would be populated during actual bot runs
    
    return stats;
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `claude_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = ClaudeEnhancedThundrBot;