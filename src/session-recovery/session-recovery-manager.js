const winston = require('winston');
const { EventEmitter } = require('events');
const SessionStateManager = require('./session-state-manager');
const RecoveryEngine = require('./recovery-engine');
const ConnectionHealer = require('./connection-healer');

/**
 * SessionRecoveryManager - Main orchestrator for session recovery system
 * Integrates state management, recovery engine, and connection healing
 */
class SessionRecoveryManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      stateManager: {
        persistenceType: config.persistenceType || 'file',
        stateDirectory: config.stateDirectory || './session-states',
        autoSaveInterval: config.autoSaveInterval || 30000,
        ...config.stateManager
      },
      recoveryEngine: {
        maxRecoveryAttempts: config.maxRecoveryAttempts || 5,
        recoveryDelay: config.recoveryDelay || 5000,
        enableProxyFailover: config.enableProxyFailover ?? true,
        ...config.recoveryEngine
      },
      connectionHealer: {
        maxRetryAttempts: config.maxRetryAttempts || 10,
        enableCircuitBreaker: config.enableCircuitBreaker ?? true,
        adaptiveRetry: config.adaptiveRetry ?? true,
        ...config.connectionHealer
      },
      enableSessionMonitoring: config.enableSessionMonitoring ?? true,
      monitoringInterval: config.monitoringInterval || 60000, // 1 minute
      enableFailoverAlerts: config.enableFailoverAlerts ?? true,
      maxConcurrentRecoveries: config.maxConcurrentRecoveries || 10,
      autoStart: config.autoStart ?? true,
      ...config
    };
    
    // Component instances
    this.stateManager = null;
    this.recoveryEngine = null;
    this.connectionHealer = null;
    
    // External integrations
    this.proxyManager = null;
    this.conversationManager = null;
    this.dashboardManager = null;
    
    // Recovery tracking
    this.activeRecoveries = new Set();
    this.recoveryQueue = [];
    this.processingQueue = false;
    
    // System status
    this.systemStatus = {
      isRunning: false,
      startTime: null,
      components: {
        stateManager: false,
        recoveryEngine: false,
        connectionHealer: false
      },
      metrics: {
        sessionsMonitored: 0,
        recoveriesPerformed: 0,
        successRate: 0,
        averageRecoveryTime: 0
      }
    };
    
    // Monitoring
    this.monitoringTimer = null;
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/session-recovery-manager.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    // Initialize if auto-start is enabled
    if (this.config.autoStart) {
      this.initialize().catch(error => {
        this.logger.error('Auto-initialization failed', {
          error: error.message
        });
      });
    }
  }

  /**
   * Initialize the session recovery system
   */
  async initialize() {
    try {
      this.logger.info('Initializing session recovery system...');
      
      // Initialize components
      await this.initializeComponents();
      
      // Setup integrations
      this.setupIntegrations();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Start monitoring if enabled
      if (this.config.enableSessionMonitoring) {
        this.startSessionMonitoring();
      }
      
      // Update system status
      this.systemStatus.isRunning = true;
      this.systemStatus.startTime = new Date();
      
      this.logger.info('Session recovery system initialized successfully', {
        persistence: this.config.stateManager.persistenceType,
        monitoring: this.config.enableSessionMonitoring,
        maxConcurrentRecoveries: this.config.maxConcurrentRecoveries
      });
      
      this.emit('system-initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize session recovery system', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize system components
   */
  async initializeComponents() {
    try {
      // Initialize State Manager
      this.stateManager = new SessionStateManager(this.config.stateManager);
      await this.stateManager.initialize();
      this.systemStatus.components.stateManager = true;
      this.logger.info('State manager initialized');
      
      // Initialize Recovery Engine
      this.recoveryEngine = new RecoveryEngine(this.config.recoveryEngine);
      this.recoveryEngine.setStateManager(this.stateManager);
      await this.recoveryEngine.initialize();
      this.systemStatus.components.recoveryEngine = true;
      this.logger.info('Recovery engine initialized');
      
      // Initialize Connection Healer
      this.connectionHealer = new ConnectionHealer(this.config.connectionHealer);
      this.connectionHealer.initialize();
      this.systemStatus.components.connectionHealer = true;
      this.logger.info('Connection healer initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize components', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Setup component integrations
   */
  setupIntegrations() {
    // Set dependencies between components
    if (this.proxyManager) {
      this.recoveryEngine.setProxyManager(this.proxyManager);
    }
    
    if (this.conversationManager) {
      this.recoveryEngine.setConversationManager(this.conversationManager);
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // State Manager events
    this.stateManager.on('state-saved', (data) => {
      this.emit('session-state-saved', data);
    });
    
    this.stateManager.on('state-loaded', (data) => {
      this.emit('session-state-loaded', data);
    });
    
    // Recovery Engine events
    this.recoveryEngine.on('recovery-success', (data) => {
      this.activeRecoveries.delete(data.sessionId);
      this.updateRecoveryMetrics('success', data);
      this.emit('session-recovered', data);
      
      // Send alert if enabled
      if (this.config.enableFailoverAlerts) {
        this.sendRecoveryAlert('success', data);
      }
    });
    
    this.recoveryEngine.on('recovery-failed', (data) => {
      this.activeRecoveries.delete(data.sessionId);
      this.updateRecoveryMetrics('failed', data);
      this.emit('session-recovery-failed', data);
      
      // Send alert if enabled
      if (this.config.enableFailoverAlerts) {
        this.sendRecoveryAlert('failed', data);
      }
    });
    
    // Connection Healer events
    this.connectionHealer.on('healing-success', (data) => {
      this.emit('connection-healed', data);
    });
    
    this.connectionHealer.on('healing-failed', (data) => {
      this.emit('connection-healing-failed', data);
    });
    
    this.connectionHealer.on('circuit-breaker-opened', (data) => {
      this.emit('circuit-breaker-opened', data);
      
      // Consider session recovery if circuit breaker opens
      this.considerSessionRecovery(data.connectionId, 'circuit_breaker_opened');
    });
  }

  /**
   * Start session monitoring
   */
  startSessionMonitoring() {
    this.monitoringTimer = setInterval(() => {
      this.performSessionMonitoring();
    }, this.config.monitoringInterval);
    
    this.logger.info('Session monitoring started', {
      interval: this.config.monitoringInterval
    });
  }

  /**
   * Perform session monitoring
   */
  async performSessionMonitoring() {
    try {
      // Get all sessions from state manager
      const sessionIds = await this.stateManager.getAllSessionIds();
      this.systemStatus.metrics.sessionsMonitored = sessionIds.length;
      
      // Check each session for potential issues
      for (const sessionId of sessionIds) {
        await this.checkSessionHealth(sessionId);
      }
      
      // Process recovery queue
      await this.processRecoveryQueue();
      
      this.logger.debug('Session monitoring completed', {
        sessionsChecked: sessionIds.length,
        activeRecoveries: this.activeRecoveries.size,
        queuedRecoveries: this.recoveryQueue.length
      });
    } catch (error) {
      this.logger.error('Session monitoring failed', {
        error: error.message
      });
    }
  }

  /**
   * Check individual session health
   */
  async checkSessionHealth(sessionId) {
    try {
      const sessionState = await this.stateManager.loadSessionState(sessionId);
      
      if (!sessionState) {
        return;
      }
      
      // Check for various health issues
      const healthIssues = [];
      
      // Check for stale sessions
      const now = Date.now();
      const lastActivity = new Date(sessionState.lastActivity || sessionState.lastSaved);
      const timeSinceActivity = now - lastActivity.getTime();
      
      if (timeSinceActivity > 10 * 60 * 1000 && sessionState.status === 'active') {
        healthIssues.push({
          type: 'stale_session',
          severity: 'medium',
          message: 'Session has been inactive for over 10 minutes',
          timeSinceActivity
        });
      }
      
      // Check for repeated failures
      if (sessionState.failureCount > 3) {
        healthIssues.push({
          type: 'repeated_failures',
          severity: 'high',
          message: 'Session has experienced multiple failures',
          failureCount: sessionState.failureCount
        });
      }
      
      // Check proxy health if available
      if (sessionState.proxyId && this.proxyManager) {
        const proxyHealth = await this.checkProxyHealth(sessionState.proxyId);
        if (proxyHealth && proxyHealth.score < 0.3) {
          healthIssues.push({
            type: 'unhealthy_proxy',
            severity: 'high',
            message: 'Assigned proxy is unhealthy',
            proxyHealth
          });
        }
      }
      
      // Check degradation mode
      if (sessionState.degradationMode) {
        const degradationTime = now - new Date(sessionState.degradedAt).getTime();
        if (degradationTime > 30 * 60 * 1000) { // 30 minutes
          healthIssues.push({
            type: 'prolonged_degradation',
            severity: 'medium',
            message: 'Session has been in degradation mode for extended period',
            degradationTime
          });
        }
      }
      
      // Queue recovery if critical issues found
      const criticalIssues = healthIssues.filter(issue => issue.severity === 'high');
      if (criticalIssues.length > 0) {
        this.queueSessionRecovery(sessionId, 'health_check', {
          issues: criticalIssues
        });
      }
      
    } catch (error) {
      this.logger.error('Failed to check session health', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * Queue session for recovery
   */
  queueSessionRecovery(sessionId, reason, context = {}) {
    // Check if already in queue or being recovered
    if (this.activeRecoveries.has(sessionId) ||
        this.recoveryQueue.some(item => item.sessionId === sessionId)) {
      return;
    }
    
    this.recoveryQueue.push({
      sessionId,
      reason,
      context,
      queuedAt: new Date(),
      priority: this.calculateRecoveryPriority(reason, context)
    });
    
    // Sort queue by priority
    this.recoveryQueue.sort((a, b) => b.priority - a.priority);
    
    this.logger.info('Session queued for recovery', {
      sessionId,
      reason,
      queuePosition: this.recoveryQueue.findIndex(item => item.sessionId === sessionId) + 1
    });
  }

  /**
   * Calculate recovery priority
   */
  calculateRecoveryPriority(reason, context) {
    let priority = 50; // Base priority
    
    switch (reason) {
      case 'circuit_breaker_opened':
        priority = 90;
        break;
      case 'proxy_failure':
        priority = 85;
        break;
      case 'connection_failure':
        priority = 80;
        break;
      case 'repeated_failures':
        priority = 75;
        break;
      case 'health_check':
        priority = 60;
        break;
      case 'stale_session':
        priority = 40;
        break;
      default:
        priority = 50;
    }
    
    // Adjust based on context
    if (context.issues) {
      const highSeverityIssues = context.issues.filter(issue => issue.severity === 'high');
      priority += highSeverityIssues.length * 10;
    }
    
    return priority;
  }

  /**
   * Process recovery queue
   */
  async processRecoveryQueue() {
    if (this.processingQueue || this.recoveryQueue.length === 0) {
      return;
    }
    
    if (this.activeRecoveries.size >= this.config.maxConcurrentRecoveries) {
      this.logger.debug('Max concurrent recoveries reached, waiting', {
        active: this.activeRecoveries.size,
        max: this.config.maxConcurrentRecoveries
      });
      return;
    }
    
    this.processingQueue = true;
    
    try {
      while (this.recoveryQueue.length > 0 && 
             this.activeRecoveries.size < this.config.maxConcurrentRecoveries) {
        
        const recoveryItem = this.recoveryQueue.shift();
        
        // Check if session still needs recovery
        if (await this.shouldSkipRecovery(recoveryItem)) {
          continue;
        }
        
        // Start recovery
        this.activeRecoveries.add(recoveryItem.sessionId);
        
        // Execute recovery asynchronously
        this.executeSessionRecovery(recoveryItem).catch(error => {
          this.logger.error('Recovery execution failed', {
            sessionId: recoveryItem.sessionId,
            error: error.message
          });
          this.activeRecoveries.delete(recoveryItem.sessionId);
        });
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Check if recovery should be skipped
   */
  async shouldSkipRecovery(recoveryItem) {
    try {
      const sessionState = await this.stateManager.loadSessionState(recoveryItem.sessionId);
      
      if (!sessionState) {
        this.logger.debug('Skipping recovery for non-existent session', {
          sessionId: recoveryItem.sessionId
        });
        return true;
      }
      
      // Skip if session is no longer active
      if (sessionState.status !== 'active') {
        this.logger.debug('Skipping recovery for inactive session', {
          sessionId: recoveryItem.sessionId,
          status: sessionState.status
        });
        return true;
      }
      
      // Skip if recently recovered
      if (sessionState.lastRecovery) {
        const timeSinceRecovery = Date.now() - new Date(sessionState.lastRecovery).getTime();
        if (timeSinceRecovery < 5 * 60 * 1000) { // 5 minutes
          this.logger.debug('Skipping recovery for recently recovered session', {
            sessionId: recoveryItem.sessionId,
            timeSinceRecovery
          });
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to check if recovery should be skipped', {
        sessionId: recoveryItem.sessionId,
        error: error.message
      });
      return true; // Skip on error
    }
  }

  /**
   * Execute session recovery
   */
  async executeSessionRecovery(recoveryItem) {
    try {
      this.logger.info('Executing session recovery', {
        sessionId: recoveryItem.sessionId,
        reason: recoveryItem.reason,
        priority: recoveryItem.priority
      });
      
      // Perform recovery using recovery engine
      const result = await this.recoveryEngine.recoverSession(
        recoveryItem.sessionId,
        recoveryItem.reason,
        recoveryItem.context
      );
      
      // Update session state with recovery info
      await this.updateSessionAfterRecovery(recoveryItem.sessionId, result);
      
      this.logger.info('Session recovery completed', {
        sessionId: recoveryItem.sessionId,
        success: result.success,
        strategy: result.strategy
      });
      
    } catch (error) {
      this.logger.error('Session recovery execution failed', {
        sessionId: recoveryItem.sessionId,
        error: error.message
      });
    }
  }

  /**
   * Update session state after recovery
   */
  async updateSessionAfterRecovery(sessionId, recoveryResult) {
    try {
      const sessionState = await this.stateManager.loadSessionState(sessionId);
      
      if (sessionState) {
        const updatedState = {
          ...sessionState,
          lastRecovery: new Date(),
          recoveryCount: (sessionState.recoveryCount || 0) + 1,
          lastRecoveryResult: {
            success: recoveryResult.success,
            strategy: recoveryResult.strategy,
            attempts: recoveryResult.attempts,
            timestamp: new Date()
          }
        };
        
        await this.stateManager.saveSessionState(sessionId, updatedState);
      }
    } catch (error) {
      this.logger.error('Failed to update session after recovery', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * Consider session recovery based on external trigger
   */
  considerSessionRecovery(connectionId, reason) {
    // This method can be called by external systems to suggest recovery
    // Implementation would map connectionId to sessionId if applicable
    this.logger.debug('Considering session recovery', {
      connectionId,
      reason
    });
  }

  /**
   * Check proxy health
   */
  async checkProxyHealth(proxyId) {
    if (!this.proxyManager) {
      return null;
    }
    
    try {
      // This would call the proxy manager to get health info
      // Implementation depends on proxy manager interface
      return { score: 0.8 }; // Placeholder
    } catch (error) {
      return null;
    }
  }

  /**
   * Update recovery metrics
   */
  updateRecoveryMetrics(type, data) {
    this.systemStatus.metrics.recoveriesPerformed++;
    
    if (type === 'success') {
      // Update success rate
      const successCount = this.systemStatus.metrics.recoveriesPerformed;
      const newSuccessRate = (this.systemStatus.metrics.successRate * (successCount - 1) + 100) / successCount;
      this.systemStatus.metrics.successRate = newSuccessRate;
      
      // Update average recovery time
      if (data.duration) {
        const currentAvg = this.systemStatus.metrics.averageRecoveryTime;
        this.systemStatus.metrics.averageRecoveryTime = 
          ((currentAvg * (successCount - 1)) + data.duration) / successCount;
      }
    } else {
      // Update success rate for failure
      const totalCount = this.systemStatus.metrics.recoveriesPerformed;
      const newSuccessRate = (this.systemStatus.metrics.successRate * (totalCount - 1)) / totalCount;
      this.systemStatus.metrics.successRate = newSuccessRate;
    }
  }

  /**
   * Send recovery alert
   */
  sendRecoveryAlert(type, data) {
    const alert = {
      type: `session_recovery_${type}`,
      sessionId: data.sessionId,
      timestamp: new Date(),
      data
    };
    
    // Send to dashboard if available
    if (this.dashboardManager) {
      this.dashboardManager.sendAlert(alert);
    }
    
    this.emit('recovery-alert', alert);
  }

  /**
   * Integration methods
   */
  integrateWithProxyManager(proxyManager) {
    this.proxyManager = proxyManager;
    this.recoveryEngine.setProxyManager(proxyManager);
    
    // Setup proxy event handlers
    proxyManager.on('proxy-failed', (data) => {
      this.queueSessionRecovery(data.sessionId, 'proxy_failure', {
        proxyId: data.proxyId,
        error: data.error
      });
    });
    
    this.logger.info('Integrated with proxy manager');
  }

  integrateWithConversationManager(conversationManager) {
    this.conversationManager = conversationManager;
    this.recoveryEngine.setConversationManager(conversationManager);
    
    // Setup conversation event handlers
    conversationManager.on('conversation-error', (data) => {
      this.queueSessionRecovery(data.conversationId, 'conversation_error', {
        error: data.error
      });
    });
    
    this.logger.info('Integrated with conversation manager');
  }

  integrateWithDashboard(dashboardManager) {
    this.dashboardManager = dashboardManager;
    
    // Send recovery system metrics to dashboard
    setInterval(() => {
      if (this.dashboardManager) {
        this.dashboardManager.updateRecoveryMetrics(this.getSystemMetrics());
      }
    }, 30000); // Every 30 seconds
    
    this.logger.info('Integrated with dashboard manager');
  }

  /**
   * Public API methods
   */
  
  /**
   * Manually trigger session recovery
   */
  async triggerRecovery(sessionId, reason = 'manual', context = {}) {
    try {
      this.logger.info('Manual recovery triggered', {
        sessionId,
        reason,
        context
      });
      
      return await this.recoveryEngine.recoverSession(sessionId, reason, context);
    } catch (error) {
      this.logger.error('Manual recovery failed', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Save session state
   */
  async saveSessionState(sessionId, state) {
    return await this.stateManager.saveSessionState(sessionId, state);
  }

  /**
   * Load session state
   */
  async loadSessionState(sessionId) {
    return await this.stateManager.loadSessionState(sessionId);
  }

  /**
   * Heal connection
   */
  async healConnection(connectionId, connectionFunc, options = {}) {
    return await this.connectionHealer.healConnection(connectionId, connectionFunc, options);
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    return {
      systemStatus: this.systemStatus,
      recoveryStats: this.recoveryEngine.getRecoveryStats(),
      healingStats: this.connectionHealer.getHealingStats(),
      stateStats: this.stateManager.getStats(),
      activeRecoveries: this.activeRecoveries.size,
      queuedRecoveries: this.recoveryQueue.length
    };
  }

  /**
   * Get session summary
   */
  async getSessionsSummary() {
    return await this.stateManager.getSessionsSummary();
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(limit = 100) {
    return this.recoveryEngine.getRecoveryHistory(limit);
  }

  /**
   * Force reset circuit breaker
   */
  resetCircuitBreaker(connectionId) {
    this.connectionHealer.forceResetCircuitBreaker(connectionId);
  }

  /**
   * Shutdown the system
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down session recovery system...');
      
      // Stop monitoring
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
        this.monitoringTimer = null;
      }
      
      // Wait for active recoveries
      if (this.activeRecoveries.size > 0) {
        this.logger.info('Waiting for active recoveries to complete', {
          activeRecoveries: this.activeRecoveries.size
        });
        
        await this.sleep(10000); // Give recoveries time to complete
      }
      
      // Shutdown components
      if (this.recoveryEngine) {
        await this.recoveryEngine.shutdown();
      }
      
      if (this.connectionHealer) {
        await this.connectionHealer.shutdown();
      }
      
      if (this.stateManager) {
        await this.stateManager.shutdown();
      }
      
      // Update system status
      this.systemStatus.isRunning = false;
      
      this.logger.info('Session recovery system shutdown complete');
      
      this.emit('system-shutdown');
    } catch (error) {
      this.logger.error('Error during system shutdown', {
        error: error.message
      });
    }
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SessionRecoveryManager;