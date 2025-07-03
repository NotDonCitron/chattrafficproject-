const winston = require('winston');
const { EventEmitter } = require('events');

/**
 * ConnectionHealer - Handles connection healing and retry mechanisms
 * Provides intelligent retry logic, connection validation, and adaptive healing
 */
class ConnectionHealer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxRetryAttempts: config.maxRetryAttempts || 10,
      baseRetryDelay: config.baseRetryDelay || 1000, // 1 second
      maxRetryDelay: config.maxRetryDelay || 30000, // 30 seconds
      exponentialBackoff: config.exponentialBackoff ?? true,
      jitterEnabled: config.jitterEnabled ?? true,
      maxJitterMs: config.maxJitterMs || 1000,
      connectionTimeout: config.connectionTimeout || 30000, // 30 seconds
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000, // 1 minute
      adaptiveRetry: config.adaptiveRetry ?? true,
      ...config
    };
    
    // Connection tracking
    this.activeConnections = new Map();
    this.connectionHistory = new Map();
    
    // Circuit breaker state
    this.circuitBreakers = new Map();
    
    // Healing statistics
    this.healingStats = {
      totalAttempts: 0,
      successfulHeals: 0,
      failedHeals: 0,
      averageHealTime: 0,
      circuitBreakerTrips: 0,
      adaptiveAdjustments: 0
    };
    
    // Health monitoring
    this.healthCheckTimer = null;
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/connection-healer.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.initialize();
  }

  /**
   * Initialize the connection healer
   */
  initialize() {
    // Start health monitoring
    this.startHealthMonitoring();
    
    this.logger.info('Connection healer initialized', {
      maxRetryAttempts: this.config.maxRetryAttempts,
      circuitBreakerEnabled: this.config.enableCircuitBreaker,
      adaptiveRetry: this.config.adaptiveRetry
    });
    
    this.emit('initialized');
  }

  /**
   * Heal connection with intelligent retry logic
   */
  async healConnection(connectionId, connectionFunc, options = {}) {
    try {
      this.logger.info('Starting connection healing', {
        connectionId,
        options
      });
      
      // Check circuit breaker
      if (this.config.enableCircuitBreaker && this.isCircuitBreakerOpen(connectionId)) {
        throw new Error('Circuit breaker is open for connection');
      }
      
      // Create healing context
      const healingContext = {
        connectionId,
        startTime: new Date(),
        attempts: 0,
        lastError: null,
        options,
        adaptive: {
          successRate: this.getConnectionSuccessRate(connectionId),
          averageTime: this.getAverageConnectionTime(connectionId),
          lastSuccess: this.getLastSuccessTime(connectionId)
        }
      };
      
      // Track active healing
      this.activeConnections.set(connectionId, healingContext);
      
      // Update stats
      this.healingStats.totalAttempts++;
      
      try {
        const result = await this.performHealing(connectionFunc, healingContext);
        
        // Healing successful
        await this.completeHealing(healingContext, result);
        
        return result;
      } catch (error) {
        // Healing failed
        await this.failHealing(healingContext, error);
        throw error;
      } finally {
        // Cleanup
        this.activeConnections.delete(connectionId);
      }
    } catch (error) {
      this.logger.error('Connection healing failed', {
        connectionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Perform the actual healing process
   */
  async performHealing(connectionFunc, healingContext) {
    const { connectionId } = healingContext;
    
    while (healingContext.attempts < this.config.maxRetryAttempts) {
      healingContext.attempts++;
      
      this.logger.debug('Connection healing attempt', {
        connectionId,
        attempt: healingContext.attempts,
        maxAttempts: this.config.maxRetryAttempts
      });
      
      try {
        // Calculate retry delay
        const delay = this.calculateRetryDelay(
          healingContext.attempts,
          healingContext.adaptive
        );
        
        // Wait before attempt (except first)
        if (healingContext.attempts > 1) {
          await this.sleep(delay);
        }
        
        // Attempt connection
        const startTime = Date.now();
        const result = await this.executeConnectionAttempt(
          connectionFunc,
          healingContext
        );
        const duration = Date.now() - startTime;
        
        // Record successful attempt
        this.recordConnectionAttempt(connectionId, true, duration);
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker(connectionId);
        
        return {
          success: true,
          result,
          attempts: healingContext.attempts,
          duration: Date.now() - healingContext.startTime.getTime(),
          connectionTime: duration
        };
        
      } catch (error) {
        healingContext.lastError = error.message;
        
        // Record failed attempt
        this.recordConnectionAttempt(connectionId, false, null, error.message);
        
        // Check if we should trigger circuit breaker
        if (this.config.enableCircuitBreaker) {
          this.checkCircuitBreaker(connectionId);
        }
        
        this.logger.warn('Connection attempt failed', {
          connectionId,
          attempt: healingContext.attempts,
          error: error.message
        });
        
        // Check if this is a permanent failure
        if (this.isPermanentFailure(error)) {
          this.logger.error('Permanent failure detected, stopping healing', {
            connectionId,
            error: error.message
          });
          throw error;
        }
        
        // Continue to next attempt unless we've exhausted all attempts
        if (healingContext.attempts >= this.config.maxRetryAttempts) {
          throw new Error(
            `Connection healing failed after ${healingContext.attempts} attempts. Last error: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Execute connection attempt with timeout
   */
  async executeConnectionAttempt(connectionFunc, healingContext) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection attempt timed out'));
      }, this.config.connectionTimeout);
      
      Promise.resolve(connectionFunc(healingContext))
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Calculate retry delay with adaptive logic
   */
  calculateRetryDelay(attempt, adaptive) {
    let delay = this.config.baseRetryDelay;
    
    // Exponential backoff
    if (this.config.exponentialBackoff) {
      delay = this.config.baseRetryDelay * Math.pow(2, attempt - 1);
    }
    
    // Adaptive adjustment based on success rate
    if (this.config.adaptiveRetry && adaptive.successRate !== null) {
      if (adaptive.successRate < 0.3) {
        // Low success rate - increase delay
        delay *= 2;
        this.healingStats.adaptiveAdjustments++;
      } else if (adaptive.successRate > 0.8) {
        // High success rate - decrease delay
        delay *= 0.5;
        this.healingStats.adaptiveAdjustments++;
      }
    }
    
    // Cap at max delay
    delay = Math.min(delay, this.config.maxRetryDelay);
    
    // Add jitter if enabled
    if (this.config.jitterEnabled) {
      const jitter = Math.random() * this.config.maxJitterMs;
      delay += jitter;
    }
    
    return Math.round(delay);
  }

  /**
   * Check if error represents a permanent failure
   */
  isPermanentFailure(error) {
    const permanentErrors = [
      'ENOTFOUND',
      'ECONNREFUSED',
      'Invalid credentials',
      'Authentication failed',
      'Access denied',
      'Forbidden'
    ];
    
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    
    return permanentErrors.some(permanent => 
      errorMessage.includes(permanent) || errorCode === permanent
    );
  }

  /**
   * Record connection attempt for analytics
   */
  recordConnectionAttempt(connectionId, success, duration = null, error = null) {
    const history = this.connectionHistory.get(connectionId) || {
      attempts: [],
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      lastSuccess: null,
      lastFailure: null
    };
    
    const attempt = {
      timestamp: new Date(),
      success,
      duration,
      error
    };
    
    history.attempts.push(attempt);
    
    if (success) {
      history.successCount++;
      history.lastSuccess = attempt.timestamp;
      if (duration) {
        history.totalDuration += duration;
      }
    } else {
      history.failureCount++;
      history.lastFailure = attempt.timestamp;
    }
    
    // Keep only last 100 attempts
    if (history.attempts.length > 100) {
      const removed = history.attempts.shift();
      if (removed.success && removed.duration) {
        history.totalDuration -= removed.duration;
      }
    }
    
    this.connectionHistory.set(connectionId, history);
  }

  /**
   * Get connection success rate
   */
  getConnectionSuccessRate(connectionId) {
    const history = this.connectionHistory.get(connectionId);
    
    if (!history || history.attempts.length === 0) {
      return null;
    }
    
    return history.successCount / (history.successCount + history.failureCount);
  }

  /**
   * Get average connection time
   */
  getAverageConnectionTime(connectionId) {
    const history = this.connectionHistory.get(connectionId);
    
    if (!history || history.successCount === 0) {
      return null;
    }
    
    return history.totalDuration / history.successCount;
  }

  /**
   * Get last success time
   */
  getLastSuccessTime(connectionId) {
    const history = this.connectionHistory.get(connectionId);
    return history ? history.lastSuccess : null;
  }

  /**
   * Circuit breaker management
   */
  isCircuitBreakerOpen(connectionId) {
    const breaker = this.circuitBreakers.get(connectionId);
    
    if (!breaker) {
      return false;
    }
    
    if (breaker.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - breaker.openedAt > this.config.circuitBreakerTimeout) {
        breaker.state = 'half-open';
        this.logger.info('Circuit breaker moved to half-open', { connectionId });
        return false;
      }
      return true;
    }
    
    return false;
  }

  checkCircuitBreaker(connectionId) {
    const history = this.connectionHistory.get(connectionId);
    
    if (!history) {
      return;
    }
    
    // Check recent failures
    const recentAttempts = history.attempts.slice(-this.config.circuitBreakerThreshold);
    const recentFailures = recentAttempts.filter(attempt => !attempt.success).length;
    
    if (recentFailures >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker(connectionId);
    }
  }

  openCircuitBreaker(connectionId) {
    this.circuitBreakers.set(connectionId, {
      state: 'open',
      openedAt: Date.now(),
      failureCount: this.config.circuitBreakerThreshold
    });
    
    this.healingStats.circuitBreakerTrips++;
    
    this.logger.warn('Circuit breaker opened', {
      connectionId,
      threshold: this.config.circuitBreakerThreshold
    });
    
    this.emit('circuit-breaker-opened', { connectionId });
  }

  resetCircuitBreaker(connectionId) {
    const breaker = this.circuitBreakers.get(connectionId);
    
    if (breaker) {
      this.circuitBreakers.delete(connectionId);
      
      this.logger.info('Circuit breaker reset', { connectionId });
      
      this.emit('circuit-breaker-reset', { connectionId });
    }
  }

  /**
   * Complete successful healing
   */
  async completeHealing(healingContext, result) {
    const duration = Date.now() - healingContext.startTime.getTime();
    
    // Update stats
    this.healingStats.successfulHeals++;
    this.updateAverageHealTime(duration);
    
    this.logger.info('Connection healing completed successfully', {
      connectionId: healingContext.connectionId,
      attempts: healingContext.attempts,
      duration
    });
    
    this.emit('healing-success', {
      connectionId: healingContext.connectionId,
      attempts: healingContext.attempts,
      duration,
      result
    });
  }

  /**
   * Handle failed healing
   */
  async failHealing(healingContext, error) {
    const duration = Date.now() - healingContext.startTime.getTime();
    
    // Update stats
    this.healingStats.failedHeals++;
    
    this.logger.error('Connection healing failed', {
      connectionId: healingContext.connectionId,
      attempts: healingContext.attempts,
      duration,
      error: error.message
    });
    
    this.emit('healing-failed', {
      connectionId: healingContext.connectionId,
      attempts: healingContext.attempts,
      duration,
      error: error.message
    });
  }

  /**
   * Update average heal time
   */
  updateAverageHealTime(duration) {
    const currentAvg = this.healingStats.averageHealTime;
    const successCount = this.healingStats.successfulHeals;
    
    this.healingStats.averageHealTime = 
      ((currentAvg * (successCount - 1)) + duration) / successCount;
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
   * Perform health check
   */
  async performHealthCheck() {
    try {
      // Check circuit breakers
      for (const [connectionId, breaker] of this.circuitBreakers.entries()) {
        if (breaker.state === 'open') {
          const openDuration = Date.now() - breaker.openedAt;
          
          if (openDuration > this.config.circuitBreakerTimeout) {
            breaker.state = 'half-open';
            this.logger.info('Circuit breaker transitioned to half-open', {
              connectionId,
              openDuration
            });
          }
        }
      }
      
      // Cleanup old connection history
      this.cleanupConnectionHistory();
      
      this.logger.debug('Health check completed', {
        activeConnections: this.activeConnections.size,
        circuitBreakers: this.circuitBreakers.size,
        connectionHistories: this.connectionHistory.size
      });
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error.message
      });
    }
  }

  /**
   * Cleanup old connection history
   */
  cleanupConnectionHistory() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [connectionId, history] of this.connectionHistory.entries()) {
      // Remove old attempts
      history.attempts = history.attempts.filter(
        attempt => attempt.timestamp.getTime() > cutoffTime
      );
      
      // Remove history if no recent attempts
      if (history.attempts.length === 0) {
        this.connectionHistory.delete(connectionId);
      }
    }
  }

  /**
   * Get healing statistics
   */
  getHealingStats() {
    return {
      ...this.healingStats,
      activeHealings: this.activeConnections.size,
      circuitBreakersOpen: Array.from(this.circuitBreakers.values())
        .filter(breaker => breaker.state === 'open').length,
      trackedConnections: this.connectionHistory.size,
      successRate: this.healingStats.totalAttempts > 0
        ? (this.healingStats.successfulHeals / this.healingStats.totalAttempts) * 100
        : 0,
      averageHealTimeMs: Math.round(this.healingStats.averageHealTime)
    };
  }

  /**
   * Get connection analytics
   */
  getConnectionAnalytics(connectionId) {
    const history = this.connectionHistory.get(connectionId);
    const breaker = this.circuitBreakers.get(connectionId);
    
    if (!history) {
      return null;
    }
    
    return {
      connectionId,
      totalAttempts: history.attempts.length,
      successCount: history.successCount,
      failureCount: history.failureCount,
      successRate: this.getConnectionSuccessRate(connectionId),
      averageConnectionTime: this.getAverageConnectionTime(connectionId),
      lastSuccess: history.lastSuccess,
      lastFailure: history.lastFailure,
      circuitBreaker: breaker ? {
        state: breaker.state,
        openedAt: breaker.openedAt
      } : null
    };
  }

  /**
   * Force reset circuit breaker
   */
  forceResetCircuitBreaker(connectionId) {
    this.resetCircuitBreaker(connectionId);
    
    this.logger.info('Circuit breaker force reset', { connectionId });
  }

  /**
   * Get all connection analytics
   */
  getAllConnectionAnalytics() {
    const analytics = [];
    
    for (const connectionId of this.connectionHistory.keys()) {
      const connectionAnalytics = this.getConnectionAnalytics(connectionId);
      if (connectionAnalytics) {
        analytics.push(connectionAnalytics);
      }
    }
    
    return analytics;
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the connection healer
   */
  async shutdown() {
    try {
      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
      
      // Wait for active healings to complete
      if (this.activeConnections.size > 0) {
        this.logger.info('Waiting for active healings to complete', {
          activeHealings: this.activeConnections.size
        });
        
        // Give active healings time to complete
        await this.sleep(5000);
      }
      
      this.logger.info('Connection healer shutdown complete');
      
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during connection healer shutdown', {
        error: error.message
      });
    }
  }
}

module.exports = ConnectionHealer;