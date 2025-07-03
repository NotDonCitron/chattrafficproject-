const winston = require('winston');
const { EventEmitter } = require('events');
const SessionStateManager = require('./session-state-manager');

/**
 * RecoveryEngine - Core session recovery and failover logic
 * Handles automatic session restoration, proxy failover, and connection healing
 */
class RecoveryEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxRecoveryAttempts: config.maxRecoveryAttempts || 5,
      recoveryDelay: config.recoveryDelay || 5000, // 5 seconds
      exponentialBackoff: config.exponentialBackoff ?? true,
      maxBackoffDelay: config.maxBackoffDelay || 60000, // 1 minute
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      failoverTimeout: config.failoverTimeout || 15000, // 15 seconds
      enableProxyFailover: config.enableProxyFailover ?? true,
      enableStateValidation: config.enableStateValidation ?? true,
      recoveryStrategies: config.recoveryStrategies || [
        'restart_session',
        'proxy_failover',
        'platform_switch',
        'graceful_degradation'
      ],
      ...config
    };
    
    // Recovery tracking
    this.activeRecoveries = new Map();
    this.recoveryHistory = [];
    this.recoveryStats = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      lastRecovery: null
    };
    
    // Health monitoring
    this.sessionHealth = new Map();
    this.healthCheckTimer = null;
    
    // External dependencies (injected)
    this.stateManager = null;
    this.proxyManager = null;
    this.conversationManager = null;
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/recovery-engine.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.initialize();
  }

  /**
   * Initialize the recovery engine
   */
  async initialize() {
    try {
      // Initialize state manager if not injected
      if (!this.stateManager) {
        this.stateManager = new SessionStateManager(this.config.stateManager);
      }
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.logger.info('Recovery engine initialized', {
        maxRecoveryAttempts: this.config.maxRecoveryAttempts,
        healthCheckInterval: this.config.healthCheckInterval,
        strategies: this.config.recoveryStrategies
      });
      
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize recovery engine', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // State manager events
    this.stateManager.on('state-saved', (data) => {
      this.updateSessionHealth(data.sessionId, { lastStateSave: new Date() });
    });
    
    this.stateManager.on('state-loaded', (data) => {
      this.logger.debug('Session state loaded for recovery', {
        sessionId: data.sessionId
      });
    });
  }

  /**
   * Initiate session recovery
   */
  async recoverSession(sessionId, reason = 'unknown', context = {}) {
    try {
      this.logger.info('Starting session recovery', {
        sessionId,
        reason,
        context
      });
      
      // Check if recovery is already in progress
      if (this.activeRecoveries.has(sessionId)) {
        this.logger.warn('Recovery already in progress', { sessionId });
        return this.activeRecoveries.get(sessionId);
      }
      
      // Create recovery context
      const recoveryContext = {
        sessionId,
        reason,
        context,
        startTime: new Date(),
        attempts: 0,
        strategies: [...this.config.recoveryStrategies],
        lastError: null,
        currentStrategy: null
      };
      
      // Track active recovery
      const recoveryPromise = this.performRecovery(recoveryContext);
      this.activeRecoveries.set(sessionId, recoveryPromise);
      
      // Update stats
      this.recoveryStats.totalAttempts++;
      
      // Cleanup when done
      recoveryPromise.finally(() => {
        this.activeRecoveries.delete(sessionId);
      });
      
      return await recoveryPromise;
    } catch (error) {
      this.logger.error('Failed to initiate session recovery', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Perform the actual recovery process
   */
  async performRecovery(recoveryContext) {
    const { sessionId } = recoveryContext;
    
    try {
      // Load session state
      const sessionState = await this.stateManager.loadSessionState(sessionId);
      
      if (!sessionState) {
        throw new Error('No session state found for recovery');
      }
      
      // Validate state if enabled
      if (this.config.enableStateValidation) {
        await this.validateSessionState(sessionState);
      }
      
      // Try each recovery strategy
      for (const strategy of recoveryContext.strategies) {
        recoveryContext.attempts++;
        recoveryContext.currentStrategy = strategy;
        
        this.logger.info('Attempting recovery strategy', {
          sessionId,
          strategy,
          attempt: recoveryContext.attempts
        });
        
        try {
          const result = await this.executeRecoveryStrategy(
            strategy,
            sessionState,
            recoveryContext
          );
          
          if (result.success) {
            // Recovery successful
            await this.completeRecovery(recoveryContext, result);
            return result;
          } else {
            // Strategy failed, try next one
            recoveryContext.lastError = result.error;
            this.logger.warn('Recovery strategy failed', {
              sessionId,
              strategy,
              error: result.error
            });
          }
        } catch (error) {
          recoveryContext.lastError = error.message;
          this.logger.error('Recovery strategy threw error', {
            sessionId,
            strategy,
            error: error.message
          });
        }
        
        // Wait before next attempt (with exponential backoff)
        if (this.config.exponentialBackoff) {
          const delay = Math.min(
            this.config.recoveryDelay * Math.pow(2, recoveryContext.attempts - 1),
            this.config.maxBackoffDelay
          );
          await this.sleep(delay);
        } else {
          await this.sleep(this.config.recoveryDelay);
        }
        
        // Check if we've exceeded max attempts
        if (recoveryContext.attempts >= this.config.maxRecoveryAttempts) {
          break;
        }
      }
      
      // All strategies failed
      await this.failRecovery(recoveryContext);
      
      return {
        success: false,
        error: 'All recovery strategies failed',
        attempts: recoveryContext.attempts,
        lastError: recoveryContext.lastError
      };
      
    } catch (error) {
      await this.failRecovery(recoveryContext, error.message);
      throw error;
    }
  }

  /**
   * Execute a specific recovery strategy
   */
  async executeRecoveryStrategy(strategy, sessionState, recoveryContext) {
    switch (strategy) {
      case 'restart_session':
        return await this.restartSession(sessionState, recoveryContext);
        
      case 'proxy_failover':
        return await this.performProxyFailover(sessionState, recoveryContext);
        
      case 'platform_switch':
        return await this.switchPlatform(sessionState, recoveryContext);
        
      case 'graceful_degradation':
        return await this.performGracefulDegradation(sessionState, recoveryContext);
        
      default:
        return {
          success: false,
          error: `Unknown recovery strategy: ${strategy}`
        };
    }
  }

  /**
   * Restart session recovery strategy
   */
  async restartSession(sessionState, recoveryContext) {
    try {
      this.logger.info('Executing restart session strategy', {
        sessionId: recoveryContext.sessionId
      });
      
      // Preserve important session data
      const preservedData = {
        conversationHistory: sessionState.conversationHistory,
        userPreferences: sessionState.userPreferences,
        personality: sessionState.personality,
        platform: sessionState.platform,
        qualityScore: sessionState.qualityScore
      };
      
      // Create new session with preserved data
      const newSessionData = {
        ...preservedData,
        sessionId: recoveryContext.sessionId,
        status: 'recovering',
        recoveredAt: new Date(),
        recoveryReason: recoveryContext.reason,
        originalStartTime: sessionState.startTime,
        restartCount: (sessionState.restartCount || 0) + 1
      };
      
      // Save updated state
      await this.stateManager.saveSessionState(
        recoveryContext.sessionId,
        newSessionData
      );
      
      // Restart conversation if manager is available
      if (this.conversationManager) {
        await this.conversationManager.restartConversation(
          recoveryContext.sessionId,
          newSessionData
        );
      }
      
      return {
        success: true,
        strategy: 'restart_session',
        sessionData: newSessionData,
        message: 'Session successfully restarted'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Proxy failover recovery strategy
   */
  async performProxyFailover(sessionState, recoveryContext) {
    try {
      if (!this.config.enableProxyFailover || !this.proxyManager) {
        return {
          success: false,
          error: 'Proxy failover not enabled or proxy manager not available'
        };
      }
      
      this.logger.info('Executing proxy failover strategy', {
        sessionId: recoveryContext.sessionId,
        currentProxy: sessionState.proxyId
      });
      
      // Get current proxy info
      const currentProxyId = sessionState.proxyId;
      
      // Find alternative proxy
      const alternativeProxy = await this.proxyManager.getOptimalProxy({
        excludeProxies: [currentProxyId],
        location: sessionState.location,
        platform: sessionState.platform,
        reliability: 0.7 // Higher reliability requirement
      });
      
      if (!alternativeProxy) {
        return {
          success: false,
          error: 'No alternative proxy available'
        };
      }
      
      // Update session state with new proxy
      const updatedState = {
        ...sessionState,
        proxyId: alternativeProxy.proxy.id,
        assignmentId: alternativeProxy.assignment,
        failoverAt: new Date(),
        failoverReason: recoveryContext.reason,
        previousProxyId: currentProxyId
      };
      
      // Save updated state
      await this.stateManager.saveSessionState(
        recoveryContext.sessionId,
        updatedState
      );
      
      // Release old proxy assignment
      if (currentProxyId) {
        try {
          await this.proxyManager.releaseProxy(sessionState.assignmentId, {
            reason: 'failover',
            success: false
          });
        } catch (error) {
          this.logger.warn('Failed to release old proxy', {
            proxyId: currentProxyId,
            error: error.message
          });
        }
      }
      
      // Update conversation manager if available
      if (this.conversationManager) {
        await this.conversationManager.updateSessionProxy(
          recoveryContext.sessionId,
          alternativeProxy.proxy
        );
      }
      
      return {
        success: true,
        strategy: 'proxy_failover',
        sessionData: updatedState,
        newProxy: alternativeProxy.proxy,
        message: 'Successfully failed over to new proxy'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Platform switch recovery strategy
   */
  async switchPlatform(sessionState, recoveryContext) {
    try {
      this.logger.info('Executing platform switch strategy', {
        sessionId: recoveryContext.sessionId,
        currentPlatform: sessionState.platform
      });
      
      // Get available platforms (this would be configurable)
      const availablePlatforms = ['thundr', 'omegle', 'chatroulette', 'emeraldchat'];
      const currentPlatform = sessionState.platform;
      const alternatePlatforms = availablePlatforms.filter(p => p !== currentPlatform);
      
      if (alternatePlatforms.length === 0) {
        return {
          success: false,
          error: 'No alternative platforms available'
        };
      }
      
      // Choose best alternative platform
      const newPlatform = alternatePlatforms[0]; // Simple selection for now
      
      // Update session state
      const updatedState = {
        ...sessionState,
        platform: newPlatform,
        platformSwitchedAt: new Date(),
        platformSwitchReason: recoveryContext.reason,
        originalPlatform: currentPlatform,
        switchCount: (sessionState.switchCount || 0) + 1
      };
      
      // Save updated state
      await this.stateManager.saveSessionState(
        recoveryContext.sessionId,
        updatedState
      );
      
      // Update conversation manager if available
      if (this.conversationManager) {
        await this.conversationManager.switchPlatform(
          recoveryContext.sessionId,
          newPlatform,
          updatedState
        );
      }
      
      return {
        success: true,
        strategy: 'platform_switch',
        sessionData: updatedState,
        newPlatform,
        message: `Successfully switched from ${currentPlatform} to ${newPlatform}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Graceful degradation recovery strategy
   */
  async performGracefulDegradation(sessionState, recoveryContext) {
    try {
      this.logger.info('Executing graceful degradation strategy', {
        sessionId: recoveryContext.sessionId
      });
      
      // Reduce session complexity for better stability
      const degradedState = {
        ...sessionState,
        degradationMode: true,
        degradedAt: new Date(),
        degradationReason: recoveryContext.reason,
        originalQualityTarget: sessionState.qualityTarget,
        qualityTarget: Math.max((sessionState.qualityTarget || 0.8) - 0.2, 0.3),
        complexityLevel: 'basic',
        advancedFeaturesDisabled: true
      };
      
      // Save degraded state
      await this.stateManager.saveSessionState(
        recoveryContext.sessionId,
        degradedState
      );
      
      // Update conversation manager if available
      if (this.conversationManager) {
        await this.conversationManager.enableDegradationMode(
          recoveryContext.sessionId,
          degradedState
        );
      }
      
      return {
        success: true,
        strategy: 'graceful_degradation',
        sessionData: degradedState,
        message: 'Session running in degraded mode for stability'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete successful recovery
   */
  async completeRecovery(recoveryContext, result) {
    const duration = Date.now() - recoveryContext.startTime.getTime();
    
    // Update stats
    this.recoveryStats.successfulRecoveries++;
    this.recoveryStats.lastRecovery = new Date();
    this.updateAverageRecoveryTime(duration);
    
    // Record in history
    this.recordRecoveryHistory(recoveryContext, result, 'success');
    
    // Update session health
    this.updateSessionHealth(recoveryContext.sessionId, {
      lastRecovery: new Date(),
      recoverySuccess: true,
      recoveryDuration: duration,
      strategy: recoveryContext.currentStrategy
    });
    
    this.logger.info('Session recovery completed successfully', {
      sessionId: recoveryContext.sessionId,
      strategy: recoveryContext.currentStrategy,
      attempts: recoveryContext.attempts,
      duration
    });
    
    this.emit('recovery-success', {
      sessionId: recoveryContext.sessionId,
      strategy: recoveryContext.currentStrategy,
      attempts: recoveryContext.attempts,
      duration,
      result
    });
  }

  /**
   * Handle failed recovery
   */
  async failRecovery(recoveryContext, error = null) {
    const duration = Date.now() - recoveryContext.startTime.getTime();
    
    // Update stats
    this.recoveryStats.failedRecoveries++;
    
    // Record in history
    this.recordRecoveryHistory(recoveryContext, null, 'failed', error);
    
    // Update session health
    this.updateSessionHealth(recoveryContext.sessionId, {
      lastRecoveryFailed: new Date(),
      recoverySuccess: false,
      lastError: error || recoveryContext.lastError
    });
    
    this.logger.error('Session recovery failed', {
      sessionId: recoveryContext.sessionId,
      attempts: recoveryContext.attempts,
      duration,
      lastError: error || recoveryContext.lastError
    });
    
    this.emit('recovery-failed', {
      sessionId: recoveryContext.sessionId,
      attempts: recoveryContext.attempts,
      duration,
      error: error || recoveryContext.lastError
    });
  }

  /**
   * Validate session state
   */
  async validateSessionState(sessionState) {
    if (!sessionState.sessionId) {
      throw new Error('Session state missing sessionId');
    }
    
    if (!sessionState.platform) {
      throw new Error('Session state missing platform');
    }
    
    // Additional validation logic can be added here
    return true;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on all sessions
   */
  async performHealthCheck() {
    try {
      const sessionIds = await this.stateManager.getAllSessionIds();
      
      for (const sessionId of sessionIds) {
        await this.checkSessionHealth(sessionId);
      }
      
      this.logger.debug('Health check completed', {
        sessionsChecked: sessionIds.length
      });
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error.message
      });
    }
  }

  /**
   * Check health of individual session
   */
  async checkSessionHealth(sessionId) {
    try {
      const sessionState = await this.stateManager.loadSessionState(sessionId);
      
      if (!sessionState) {
        return;
      }
      
      const health = this.sessionHealth.get(sessionId) || {};
      const now = Date.now();
      
      // Check for stale sessions
      const lastActivity = new Date(sessionState.lastActivity || sessionState.lastSaved);
      const timeSinceActivity = now - lastActivity.getTime();
      
      if (timeSinceActivity > 30 * 60 * 1000) { // 30 minutes
        health.status = 'stale';
        health.lastCheck = new Date();
        
        // Consider recovery if session should be active
        if (sessionState.status === 'active') {
          this.logger.warn('Detected stale active session', {
            sessionId,
            timeSinceActivity: Math.round(timeSinceActivity / 1000 / 60)
          });
          
          // Initiate recovery
          setImmediate(() => {
            this.recoverSession(sessionId, 'stale_session', {
              timeSinceActivity,
              lastActivity
            }).catch(error => {
              this.logger.error('Failed to recover stale session', {
                sessionId,
                error: error.message
              });
            });
          });
        }
      } else {
        health.status = 'healthy';
        health.lastCheck = new Date();
      }
      
      this.sessionHealth.set(sessionId, health);
    } catch (error) {
      this.logger.error('Failed to check session health', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * Update session health data
   */
  updateSessionHealth(sessionId, healthData) {
    const currentHealth = this.sessionHealth.get(sessionId) || {};
    
    this.sessionHealth.set(sessionId, {
      ...currentHealth,
      ...healthData,
      lastUpdated: new Date()
    });
  }

  /**
   * Record recovery in history
   */
  recordRecoveryHistory(recoveryContext, result, status, error = null) {
    const historyEntry = {
      sessionId: recoveryContext.sessionId,
      reason: recoveryContext.reason,
      strategy: recoveryContext.currentStrategy,
      attempts: recoveryContext.attempts,
      status,
      duration: Date.now() - recoveryContext.startTime.getTime(),
      timestamp: new Date(),
      error,
      result
    };
    
    this.recoveryHistory.push(historyEntry);
    
    // Keep only last 1000 entries
    if (this.recoveryHistory.length > 1000) {
      this.recoveryHistory = this.recoveryHistory.slice(-1000);
    }
  }

  /**
   * Update average recovery time
   */
  updateAverageRecoveryTime(duration) {
    const currentAvg = this.recoveryStats.averageRecoveryTime;
    const successCount = this.recoveryStats.successfulRecoveries;
    
    this.recoveryStats.averageRecoveryTime = 
      ((currentAvg * (successCount - 1)) + duration) / successCount;
  }

  /**
   * Set external dependencies
   */
  setStateManager(stateManager) {
    this.stateManager = stateManager;
  }

  setProxyManager(proxyManager) {
    this.proxyManager = proxyManager;
  }

  setConversationManager(conversationManager) {
    this.conversationManager = conversationManager;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    return {
      ...this.recoveryStats,
      activeRecoveries: this.activeRecoveries.size,
      monitoredSessions: this.sessionHealth.size,
      successRate: this.recoveryStats.totalAttempts > 0 
        ? (this.recoveryStats.successfulRecoveries / this.recoveryStats.totalAttempts) * 100
        : 0,
      averageRecoveryTimeMs: Math.round(this.recoveryStats.averageRecoveryTime)
    };
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(limit = 100) {
    return this.recoveryHistory.slice(-limit);
  }

  /**
   * Get session health summary
   */
  getSessionHealthSummary() {
    const summary = {
      total: this.sessionHealth.size,
      healthy: 0,
      stale: 0,
      recovering: 0,
      failed: 0
    };
    
    for (const health of this.sessionHealth.values()) {
      switch (health.status) {
        case 'healthy':
          summary.healthy++;
          break;
        case 'stale':
          summary.stale++;
          break;
        case 'recovering':
          summary.recovering++;
          break;
        case 'failed':
          summary.failed++;
          break;
      }
    }
    
    return summary;
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the recovery engine
   */
  async shutdown() {
    try {
      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
      
      // Wait for active recoveries to complete
      if (this.activeRecoveries.size > 0) {
        this.logger.info('Waiting for active recoveries to complete', {
          activeRecoveries: this.activeRecoveries.size
        });
        
        await Promise.allSettled(Array.from(this.activeRecoveries.values()));
      }
      
      // Shutdown state manager
      if (this.stateManager) {
        await this.stateManager.shutdown();
      }
      
      this.logger.info('Recovery engine shutdown complete');
      
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during recovery engine shutdown', {
        error: error.message
      });
    }
  }
}

module.exports = RecoveryEngine;