const winston = require('winston');
const { EventEmitter } = require('events');
const os = require('os');

/**
 * MetricsCollector - Collects and aggregates performance metrics
 * Provides comprehensive system and application metrics for dashboard
 */
class MetricsCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      collectInterval: config.collectInterval || 5000, // 5 seconds
      historyRetention: config.historyRetention || 24 * 60 * 60 * 1000, // 24 hours
      maxHistoryPoints: config.maxHistoryPoints || 1000,
      enableSystemMetrics: config.enableSystemMetrics ?? true,
      enableApplicationMetrics: config.enableApplicationMetrics ?? true,
      ...config
    };
    
    // Metric storage
    this.currentMetrics = {
      system: {},
      application: {},
      sessions: {},
      proxies: {},
      conversations: {},
      timestamp: new Date()
    };
    
    // Historical data
    this.metricsHistory = [];
    
    // Active sessions tracking
    this.activeSessions = new Map();
    
    // Proxy health tracking
    this.proxyHealth = new Map();
    
    // Conversation tracking
    this.activeConversations = new Map();
    
    // Collection interval
    this.collectionInterval = null;
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/metrics-collector.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
  }

  /**
   * Start metrics collection
   */
  async start() {
    try {
      // Perform initial collection
      await this.collectMetrics();
      
      // Start periodic collection
      this.collectionInterval = setInterval(() => {
        this.collectMetrics();
      }, this.config.collectInterval);
      
      this.logger.info('Metrics collection started', {
        interval: this.config.collectInterval
      });
      
      this.emit('collection-started');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to start metrics collection', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Stop metrics collection
   */
  async stop() {
    try {
      if (this.collectionInterval) {
        clearInterval(this.collectionInterval);
        this.collectionInterval = null;
      }
      
      this.logger.info('Metrics collection stopped');
      this.emit('collection-stopped');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to stop metrics collection', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Collect all metrics
   */
  async collectMetrics() {
    try {
      const metrics = {
        timestamp: new Date(),
        system: {},
        application: {},
        sessions: {},
        proxies: {},
        conversations: {}
      };
      
      // Collect system metrics
      if (this.config.enableSystemMetrics) {
        metrics.system = await this.collectSystemMetrics();
      }
      
      // Collect application metrics
      if (this.config.enableApplicationMetrics) {
        metrics.application = await this.collectApplicationMetrics();
      }
      
      // Collect session metrics
      metrics.sessions = this.collectSessionMetrics();
      
      // Collect proxy metrics
      metrics.proxies = this.collectProxyMetrics();
      
      // Collect conversation metrics
      metrics.conversations = this.collectConversationMetrics();
      
      // Update current metrics
      this.currentMetrics = metrics;
      
      // Add to history
      this.addToHistory(metrics);
      
      // Emit update event
      this.emit('metrics-updated', metrics);
      
      return metrics;
    } catch (error) {
      this.logger.error('Failed to collect metrics', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    const metrics = {
      cpu: {},
      memory: {},
      disk: {},
      network: {},
      os: {}
    };
    
    try {
      // CPU metrics
      const cpus = os.cpus();
      metrics.cpu = {
        count: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        usage: await this.getCpuUsage(),
        loadAverage: os.loadavg()
      };
      
      // Memory metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      
      metrics.memory = {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usage: (usedMem / totalMem) * 100
      };
      
      // Process memory
      const processMemory = process.memoryUsage();
      metrics.memory.process = {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external
      };
      
      // OS info
      metrics.os = {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime()
      };
      
      // Network interfaces
      const networkInterfaces = os.networkInterfaces();
      metrics.network = {
        interfaces: Object.keys(networkInterfaces).length,
        details: this.summarizeNetworkInterfaces(networkInterfaces)
      };
      
    } catch (error) {
      this.logger.error('Failed to collect system metrics', {
        error: error.message
      });
    }
    
    return metrics;
  }

  /**
   * Get CPU usage percentage
   */
  getCpuUsage() {
    return new Promise((resolve) => {
      const startMeasure = process.cpuUsage();
      
      setTimeout(() => {
        const endMeasure = process.cpuUsage(startMeasure);
        const totalUsage = endMeasure.user + endMeasure.system;
        const usage = (totalUsage / 1000000) * 100; // Convert to percentage
        resolve(Math.min(usage, 100));
      }, 100);
    });
  }

  /**
   * Collect application-specific metrics
   */
  async collectApplicationMetrics() {
    const metrics = {
      process: {},
      performance: {},
      errors: {},
      requests: {}
    };
    
    try {
      // Process metrics
      metrics.process = {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        title: process.title
      };
      
      // Performance metrics
      metrics.performance = {
        eventLoopDelay: this.measureEventLoopDelay(),
        gc: this.getGCMetrics()
      };
      
      // Error tracking (if available)
      metrics.errors = {
        total: 0,
        recent: 0,
        rate: 0
      };
      
      // Request metrics (if available)
      metrics.requests = {
        total: 0,
        active: 0,
        rate: 0,
        averageResponseTime: 0
      };
      
    } catch (error) {
      this.logger.error('Failed to collect application metrics', {
        error: error.message
      });
    }
    
    return metrics;
  }

  /**
   * Collect session metrics
   */
  collectSessionMetrics() {
    const metrics = {
      total: this.activeSessions.size,
      active: 0,
      byPlatform: {},
      byStatus: {},
      averageDuration: 0,
      successRate: 0
    };
    
    let totalDuration = 0;
    let successfulSessions = 0;
    
    this.activeSessions.forEach((session, sessionId) => {
      // Count active sessions
      if (session.status === 'active') {
        metrics.active++;
      }
      
      // Group by platform
      const platform = session.platform || 'unknown';
      metrics.byPlatform[platform] = (metrics.byPlatform[platform] || 0) + 1;
      
      // Group by status
      const status = session.status || 'unknown';
      metrics.byStatus[status] = (metrics.byStatus[status] || 0) + 1;
      
      // Calculate duration
      if (session.startTime) {
        const duration = Date.now() - new Date(session.startTime).getTime();
        totalDuration += duration;
      }
      
      // Count successful sessions
      if (session.status === 'completed' && session.success) {
        successfulSessions++;
      }
    });
    
    // Calculate averages
    if (this.activeSessions.size > 0) {
      metrics.averageDuration = totalDuration / this.activeSessions.size;
      metrics.successRate = (successfulSessions / this.activeSessions.size) * 100;
    }
    
    return metrics;
  }

  /**
   * Collect proxy metrics
   */
  collectProxyMetrics() {
    const metrics = {
      total: this.proxyHealth.size,
      healthy: 0,
      degraded: 0,
      failed: 0,
      averageHealth: 0,
      averageResponseTime: 0,
      byType: {},
      byLocation: {}
    };
    
    let totalHealth = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    
    this.proxyHealth.forEach((proxy, proxyId) => {
      // Count by status
      switch (proxy.status) {
        case 'healthy':
          metrics.healthy++;
          break;
        case 'degraded':
          metrics.degraded++;
          break;
        case 'failed':
          metrics.failed++;
          break;
      }
      
      // Accumulate health scores
      if (proxy.healthScore !== undefined) {
        totalHealth += proxy.healthScore;
      }
      
      // Accumulate response times
      if (proxy.responseTime) {
        totalResponseTime += proxy.responseTime;
        responseTimeCount++;
      }
      
      // Group by type
      const type = proxy.type || 'unknown';
      metrics.byType[type] = (metrics.byType[type] || 0) + 1;
      
      // Group by location
      const location = proxy.location || 'unknown';
      metrics.byLocation[location] = (metrics.byLocation[location] || 0) + 1;
    });
    
    // Calculate averages
    if (this.proxyHealth.size > 0) {
      metrics.averageHealth = totalHealth / this.proxyHealth.size;
    }
    
    if (responseTimeCount > 0) {
      metrics.averageResponseTime = totalResponseTime / responseTimeCount;
    }
    
    return metrics;
  }

  /**
   * Collect conversation metrics
   */
  collectConversationMetrics() {
    const metrics = {
      total: this.activeConversations.size,
      active: 0,
      byPersonality: {},
      byPlatform: {},
      averageQuality: 0,
      averageEngagement: 0,
      averageMessageCount: 0
    };
    
    let totalQuality = 0;
    let totalEngagement = 0;
    let totalMessages = 0;
    let qualityCount = 0;
    let engagementCount = 0;
    
    this.activeConversations.forEach((conversation, conversationId) => {
      // Count active conversations
      if (conversation.status === 'active') {
        metrics.active++;
      }
      
      // Group by personality
      const personality = conversation.personality || 'unknown';
      metrics.byPersonality[personality] = (metrics.byPersonality[personality] || 0) + 1;
      
      // Group by platform
      const platform = conversation.platform || 'unknown';
      metrics.byPlatform[platform] = (metrics.byPlatform[platform] || 0) + 1;
      
      // Accumulate quality scores
      if (conversation.qualityScore !== undefined) {
        totalQuality += conversation.qualityScore;
        qualityCount++;
      }
      
      // Accumulate engagement scores
      if (conversation.engagementLevel !== undefined) {
        totalEngagement += conversation.engagementLevel;
        engagementCount++;
      }
      
      // Count messages
      if (conversation.messageCount) {
        totalMessages += conversation.messageCount;
      }
    });
    
    // Calculate averages
    if (qualityCount > 0) {
      metrics.averageQuality = totalQuality / qualityCount;
    }
    
    if (engagementCount > 0) {
      metrics.averageEngagement = totalEngagement / engagementCount;
    }
    
    if (this.activeConversations.size > 0) {
      metrics.averageMessageCount = totalMessages / this.activeConversations.size;
    }
    
    return metrics;
  }

  /**
   * Update session data
   */
  updateSession(sessionId, sessionData) {
    this.activeSessions.set(sessionId, {
      ...this.activeSessions.get(sessionId),
      ...sessionData,
      lastUpdated: new Date()
    });
    
    this.emit('session-update', {
      sessionId,
      data: this.activeSessions.get(sessionId)
    });
  }

  /**
   * Remove session
   */
  removeSession(sessionId) {
    if (this.activeSessions.has(sessionId)) {
      this.activeSessions.delete(sessionId);
      this.emit('session-removed', { sessionId });
    }
  }

  /**
   * Update proxy health data
   */
  updateProxyHealth(proxyId, healthData) {
    this.proxyHealth.set(proxyId, {
      ...this.proxyHealth.get(proxyId),
      ...healthData,
      lastUpdated: new Date()
    });
    
    this.emit('proxy-health-update', {
      proxyId,
      data: this.proxyHealth.get(proxyId)
    });
  }

  /**
   * Remove proxy health data
   */
  removeProxyHealth(proxyId) {
    if (this.proxyHealth.has(proxyId)) {
      this.proxyHealth.delete(proxyId);
      this.emit('proxy-health-removed', { proxyId });
    }
  }

  /**
   * Update conversation data
   */
  updateConversation(conversationId, conversationData) {
    this.activeConversations.set(conversationId, {
      ...this.activeConversations.get(conversationId),
      ...conversationData,
      lastUpdated: new Date()
    });
    
    this.emit('conversation-update', {
      conversationId,
      data: this.activeConversations.get(conversationId)
    });
  }

  /**
   * Remove conversation data
   */
  removeConversation(conversationId) {
    if (this.activeConversations.has(conversationId)) {
      this.activeConversations.delete(conversationId);
      this.emit('conversation-removed', { conversationId });
    }
  }

  /**
   * Add metrics to history
   */
  addToHistory(metrics) {
    this.metricsHistory.push({
      ...metrics,
      id: `metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    // Cleanup old history
    this.cleanupHistory();
  }

  /**
   * Cleanup old history entries
   */
  cleanupHistory() {
    const now = Date.now();
    const cutoffTime = now - this.config.historyRetention;
    
    // Remove entries older than retention period
    this.metricsHistory = this.metricsHistory.filter(entry => {
      return new Date(entry.timestamp).getTime() > cutoffTime;
    });
    
    // Limit to max points
    if (this.metricsHistory.length > this.config.maxHistoryPoints) {
      this.metricsHistory = this.metricsHistory.slice(-this.config.maxHistoryPoints);
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    return this.currentMetrics;
  }

  /**
   * Get current sessions
   */
  getCurrentSessions() {
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      ...session
    }));
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(timeRange = null, limit = null) {
    let history = [...this.metricsHistory];
    
    // Filter by time range if specified
    if (timeRange) {
      const cutoffTime = Date.now() - timeRange;
      history = history.filter(entry => {
        return new Date(entry.timestamp).getTime() > cutoffTime;
      });
    }
    
    // Limit results if specified
    if (limit) {
      history = history.slice(-limit);
    }
    
    return history;
  }

  /**
   * Helper methods
   */
  summarizeNetworkInterfaces(interfaces) {
    const summary = {};
    
    Object.entries(interfaces).forEach(([name, addresses]) => {
      summary[name] = {
        addresses: addresses.length,
        ipv4: addresses.filter(addr => addr.family === 'IPv4').length,
        ipv6: addresses.filter(addr => addr.family === 'IPv6').length
      };
    });
    
    return summary;
  }

  measureEventLoopDelay() {
    // Simple event loop delay measurement
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      return Math.round(delay * 100) / 100;
    });
    return 0; // Return 0 as placeholder since this is async
  }

  getGCMetrics() {
    // Placeholder for GC metrics
    // In production, you might use perf_hooks or v8 module
    return {
      collections: 0,
      duration: 0,
      freed: 0
    };
  }

  /**
   * Get collector status
   */
  getStatus() {
    return {
      isCollecting: this.collectionInterval !== null,
      interval: this.config.collectInterval,
      lastCollection: this.currentMetrics.timestamp,
      historySize: this.metricsHistory.length,
      activeSessions: this.activeSessions.size,
      trackedProxies: this.proxyHealth.size,
      activeConversations: this.activeConversations.size
    };
  }
}

module.exports = MetricsCollector;