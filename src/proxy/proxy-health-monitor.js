const axios = require('axios');
const winston = require('winston');
const { EventEmitter } = require('events');

/**
 * ProxyHealthMonitor - Real-time proxy health checking and performance monitoring
 * Implements concurrent health checks with performance scoring
 */
class ProxyHealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      checkInterval: config.checkInterval || 60000, // 1 minute
      timeout: config.timeout || 10000, // 10 seconds
      maxConcurrentChecks: config.maxConcurrentChecks || 20,
      retryAttempts: config.retryAttempts || 3,
      healthThreshold: config.healthThreshold || 0.6,
      testUrls: config.testUrls || [
        'http://httpbin.org/ip',
        'https://ipapi.co/json',
        'http://ip-api.com/json'
      ],
      performanceWeights: {
        responseTime: 0.4,
        reliability: 0.3,
        successRate: 0.2,
        consistency: 0.1
      },
      ...config
    };
    
    // Monitored proxies
    this.monitoredProxies = new Map();
    
    // Health check queue
    this.checkQueue = [];
    this.activeChecks = 0;
    
    // Performance history
    this.performanceHistory = new Map();
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/proxy-health-monitor.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.startHealthChecking();
  }

  /**
   * Add proxy to monitoring
   */
  async addProxy(proxy) {
    try {
      const proxyData = {
        id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        username: proxy.username,
        password: proxy.password,
        addedAt: new Date(),
        health: {
          score: 0,
          status: 'unknown',
          lastCheck: null,
          responseTime: null,
          reliability: 0,
          successRate: 0,
          consistency: 0,
          errors: []
        },
        checks: {
          total: 0,
          successful: 0,
          failed: 0,
          consecutive_failures: 0,
          last_success: null,
          last_failure: null
        }
      };
      
      this.monitoredProxies.set(proxy.id, proxyData);
      
      // Initialize performance history
      this.performanceHistory.set(proxy.id, {
        responseTimes: [],
        successRates: [],
        availabilityWindows: [],
        maxHistorySize: 100
      });
      
      this.logger.info('Proxy added to health monitoring', {
        proxyId: proxy.id,
        host: proxy.host,
        port: proxy.port
      });
      
      // Perform initial health check
      await this.performHealthCheck(proxy.id);
      
      this.emit('proxy-added-to-monitoring', { proxyId: proxy.id });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to add proxy to monitoring', {
        proxyId: proxy.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Remove proxy from monitoring
   */
  async removeProxy(proxyId) {
    try {
      if (this.monitoredProxies.has(proxyId)) {
        this.monitoredProxies.delete(proxyId);
        this.performanceHistory.delete(proxyId);
        
        // Remove from check queue
        this.checkQueue = this.checkQueue.filter(id => id !== proxyId);
        
        this.logger.info('Proxy removed from health monitoring', { proxyId });
        
        this.emit('proxy-removed-from-monitoring', { proxyId });
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to remove proxy from monitoring', {
        proxyId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Perform health check for specific proxy
   */
  async performHealthCheck(proxyId) {
    const proxy = this.monitoredProxies.get(proxyId);
    
    if (!proxy) {
      this.logger.warn('Proxy not found for health check', { proxyId });
      return null;
    }
    
    const startTime = Date.now();
    let healthData = {
      timestamp: new Date(),
      responseTime: null,
      success: false,
      error: null,
      testResults: []
    };
    
    try {
      // Perform multiple test requests
      const testResults = await this.runHealthTests(proxy);
      
      healthData.testResults = testResults;
      healthData.success = testResults.some(result => result.success);
      
      if (healthData.success) {
        const successfulTests = testResults.filter(result => result.success);
        healthData.responseTime = successfulTests.reduce(
          (sum, test) => sum + test.responseTime, 0
        ) / successfulTests.length;
      }
      
      // Update proxy health data
      this.updateProxyHealth(proxyId, healthData);
      
      this.emit('health-check-completed', {
        proxyId,
        success: healthData.success,
        responseTime: healthData.responseTime
      });
      
    } catch (error) {
      healthData.error = error.message;
      this.updateProxyHealth(proxyId, healthData);
      
      this.emit('health-check-failed', {
        proxyId,
        error: error.message
      });
    }
    
    return healthData;
  }

  /**
   * Run multiple health tests for proxy
   */
  async runHealthTests(proxy) {
    const testResults = [];
    const proxyConfig = this.buildProxyConfig(proxy);
    
    for (const testUrl of this.config.testUrls) {
      const testResult = await this.runSingleTest(testUrl, proxyConfig, proxy.id);
      testResults.push(testResult);
      
      // Stop if we get a successful result and we're in fast mode
      if (testResult.success && this.config.fastMode) {
        break;
      }
    }
    
    return testResults;
  }

  /**
   * Run single health test
   */
  async runSingleTest(testUrl, proxyConfig, proxyId) {
    const startTime = Date.now();
    let attempts = 0;
    
    while (attempts < this.config.retryAttempts) {
      attempts++;
      
      try {
        const response = await axios.get(testUrl, {
          proxy: proxyConfig,
          timeout: this.config.timeout,
          validateStatus: () => true, // Accept any status code
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const responseTime = Date.now() - startTime;
        
        // Check if response is valid
        const isValid = this.validateTestResponse(response, testUrl);
        
        return {
          url: testUrl,
          success: isValid && response.status >= 200 && response.status < 300,
          responseTime,
          status: response.status,
          dataReceived: response.data ? JSON.stringify(response.data).length : 0,
          attempt: attempts,
          valid: isValid
        };
        
      } catch (error) {
        // If this is the last attempt, return the error
        if (attempts === this.config.retryAttempts) {
          return {
            url: testUrl,
            success: false,
            responseTime: Date.now() - startTime,
            error: error.message,
            errorCode: error.code,
            attempt: attempts,
            valid: false
          };
        }
        
        // Wait before retry
        await this.sleep(1000 * attempts);
      }
    }
  }

  /**
   * Validate test response
   */
  validateTestResponse(response, testUrl) {
    try {
      // Basic validation - response should contain data
      if (!response.data) return false;
      
      // URL-specific validation
      if (testUrl.includes('httpbin.org')) {
        return response.data.origin && response.data.origin.length > 0;
      }
      
      if (testUrl.includes('ipapi.co')) {
        return response.data.ip && response.data.ip.length > 0;
      }
      
      if (testUrl.includes('ip-api.com')) {
        return response.data.query && response.data.query.length > 0;
      }
      
      // Generic validation
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Build proxy configuration for axios
   */
  buildProxyConfig(proxy) {
    const config = {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol
    };
    
    if (proxy.username && proxy.password) {
      config.auth = {
        username: proxy.username,
        password: proxy.password
      };
    }
    
    return config;
  }

  /**
   * Update proxy health data
   */
  updateProxyHealth(proxyId, healthData) {
    const proxy = this.monitoredProxies.get(proxyId);
    
    if (!proxy) return;
    
    // Update check statistics
    proxy.checks.total++;
    proxy.checks.last_check = healthData.timestamp;
    
    if (healthData.success) {
      proxy.checks.successful++;
      proxy.checks.last_success = healthData.timestamp;
      proxy.checks.consecutive_failures = 0;
    } else {
      proxy.checks.failed++;
      proxy.checks.last_failure = healthData.timestamp;
      proxy.checks.consecutive_failures++;
    }
    
    // Update performance history
    this.updatePerformanceHistory(proxyId, healthData);
    
    // Calculate new health metrics
    const newHealth = this.calculateHealthMetrics(proxyId);
    proxy.health = { ...proxy.health, ...newHealth };
    
    // Update response time if available
    if (healthData.responseTime) {
      proxy.health.responseTime = healthData.responseTime;
    }
    
    // Store recent errors
    if (healthData.error) {
      proxy.health.errors.unshift({
        error: healthData.error,
        timestamp: healthData.timestamp
      });
      
      // Keep only last 10 errors
      proxy.health.errors = proxy.health.errors.slice(0, 10);
    }
    
    // Update last check time
    proxy.health.lastCheck = healthData.timestamp;
    
    // Determine status
    proxy.health.status = this.determineProxyStatus(proxy);
    
    // Check for failure threshold
    if (proxy.checks.consecutive_failures >= 3) {
      this.handleProxyFailure(proxyId);
    }
    
    // Check for recovery
    if (proxy.health.status === 'healthy' && proxy.checks.consecutive_failures === 0) {
      this.handleProxyRecovery(proxyId);
    }
    
    this.emit('health-updated', proxyId, proxy.health);
  }

  /**
   * Update performance history
   */
  updatePerformanceHistory(proxyId, healthData) {
    const history = this.performanceHistory.get(proxyId);
    
    if (!history) return;
    
    // Add response time if successful
    if (healthData.success && healthData.responseTime) {
      history.responseTimes.push({
        time: healthData.responseTime,
        timestamp: healthData.timestamp
      });
      
      // Keep only recent data
      if (history.responseTimes.length > history.maxHistorySize) {
        history.responseTimes.shift();
      }
    }
    
    // Update availability windows (5-minute windows)
    const windowTime = Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000);
    const existingWindow = history.availabilityWindows.find(w => w.window === windowTime);
    
    if (existingWindow) {
      existingWindow.total++;
      if (healthData.success) existingWindow.successful++;
    } else {
      history.availabilityWindows.push({
        window: windowTime,
        total: 1,
        successful: healthData.success ? 1 : 0
      });
      
      // Keep only last 12 windows (1 hour)
      if (history.availabilityWindows.length > 12) {
        history.availabilityWindows.shift();
      }
    }
  }

  /**
   * Calculate comprehensive health metrics
   */
  calculateHealthMetrics(proxyId) {
    const proxy = this.monitoredProxies.get(proxyId);
    const history = this.performanceHistory.get(proxyId);
    
    if (!proxy || !history) return {};
    
    // Calculate success rate
    const successRate = proxy.checks.total > 0 
      ? proxy.checks.successful / proxy.checks.total 
      : 0;
    
    // Calculate reliability (consistency over time)
    const reliability = this.calculateReliability(history);
    
    // Calculate response time score
    const responseTimeScore = this.calculateResponseTimeScore(history);
    
    // Calculate consistency score
    const consistency = this.calculateConsistency(history);
    
    // Calculate overall health score
    const weights = this.config.performanceWeights;
    const healthScore = (
      responseTimeScore * weights.responseTime +
      reliability * weights.reliability +
      successRate * weights.successRate +
      consistency * weights.consistency
    );
    
    return {
      score: Math.max(0, Math.min(1, healthScore)),
      successRate: Math.round(successRate * 100) / 100,
      reliability: Math.round(reliability * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      responseTimeScore: Math.round(responseTimeScore * 100) / 100
    };
  }

  /**
   * Calculate reliability based on availability windows
   */
  calculateReliability(history) {
    if (history.availabilityWindows.length === 0) return 0;
    
    const totalRequests = history.availabilityWindows.reduce(
      (sum, window) => sum + window.total, 0
    );
    const totalSuccesses = history.availabilityWindows.reduce(
      (sum, window) => sum + window.successful, 0
    );
    
    return totalRequests > 0 ? totalSuccesses / totalRequests : 0;
  }

  /**
   * Calculate response time score (lower is better)
   */
  calculateResponseTimeScore(history) {
    if (history.responseTimes.length === 0) return 0;
    
    const recent = history.responseTimes.slice(-10); // Last 10 measurements
    const avgResponseTime = recent.reduce(
      (sum, item) => sum + item.time, 0
    ) / recent.length;
    
    // Score based on response time (exponential decay)
    // 500ms = 1.0, 1000ms = 0.5, 2000ms = 0.25, etc.
    return Math.max(0, Math.min(1, 500 / avgResponseTime));
  }

  /**
   * Calculate consistency score (variance in performance)
   */
  calculateConsistency(history) {
    if (history.responseTimes.length < 3) return 0.5;
    
    const recent = history.responseTimes.slice(-10);
    const times = recent.map(item => item.time);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    
    // Calculate coefficient of variation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 1;
    
    // Lower CV (more consistent) = higher score
    return Math.max(0, Math.min(1, 1 - cv));
  }

  /**
   * Determine proxy status
   */
  determineProxyStatus(proxy) {
    const health = proxy.health;
    const checks = proxy.checks;
    
    // Failed if too many consecutive failures
    if (checks.consecutive_failures >= 5) {
      return 'failed';
    }
    
    // Degraded if health score is low
    if (health.score < 0.3) {
      return 'degraded';
    }
    
    // Warning if moderate issues
    if (health.score < this.config.healthThreshold) {
      return 'warning';
    }
    
    // Healthy if good performance
    if (health.score >= this.config.healthThreshold) {
      return 'healthy';
    }
    
    return 'unknown';
  }

  /**
   * Handle proxy failure
   */
  handleProxyFailure(proxyId) {
    const proxy = this.monitoredProxies.get(proxyId);
    
    if (proxy) {
      this.logger.warn('Proxy marked as failed', {
        proxyId,
        consecutiveFailures: proxy.checks.consecutive_failures,
        totalChecks: proxy.checks.total,
        successRate: proxy.health.successRate
      });
      
      this.emit('proxy-failed', proxyId, {
        consecutiveFailures: proxy.checks.consecutive_failures,
        lastError: proxy.health.errors[0]?.error
      });
    }
  }

  /**
   * Handle proxy recovery
   */
  handleProxyRecovery(proxyId) {
    const proxy = this.monitoredProxies.get(proxyId);
    
    if (proxy && proxy.checks.last_success) {
      this.logger.info('Proxy recovered', {
        proxyId,
        healthScore: proxy.health.score,
        successRate: proxy.health.successRate
      });
      
      this.emit('proxy-recovered', proxyId);
    }
  }

  /**
   * Start health checking scheduler
   */
  startHealthChecking() {
    setInterval(() => {
      this.scheduleHealthChecks();
    }, this.config.checkInterval);
    
    // Process check queue
    setInterval(() => {
      this.processCheckQueue();
    }, 1000);
  }

  /**
   * Schedule health checks for all monitored proxies
   */
  scheduleHealthChecks() {
    for (const proxyId of this.monitoredProxies.keys()) {
      if (!this.checkQueue.includes(proxyId)) {
        this.checkQueue.push(proxyId);
      }
    }
    
    this.logger.debug('Health checks scheduled', {
      queueSize: this.checkQueue.length,
      activeChecks: this.activeChecks
    });
  }

  /**
   * Process health check queue with concurrency control
   */
  async processCheckQueue() {
    while (this.checkQueue.length > 0 && this.activeChecks < this.config.maxConcurrentChecks) {
      const proxyId = this.checkQueue.shift();
      this.activeChecks++;
      
      // Run check asynchronously
      this.performHealthCheck(proxyId)
        .finally(() => {
          this.activeChecks--;
        });
    }
  }

  /**
   * Get health status for all monitored proxies
   */
  getHealthStatus() {
    const status = {
      totalProxies: this.monitoredProxies.size,
      healthyProxies: 0,
      degradedProxies: 0,
      failedProxies: 0,
      averageHealth: 0,
      averageResponseTime: 0,
      checkQueueSize: this.checkQueue.length,
      activeChecks: this.activeChecks,
      byStatus: {
        healthy: [],
        warning: [],
        degraded: [],
        failed: [],
        unknown: []
      }
    };
    
    let totalHealth = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    
    for (const [proxyId, proxy] of this.monitoredProxies.entries()) {
      totalHealth += proxy.health.score;
      
      if (proxy.health.responseTime) {
        totalResponseTime += proxy.health.responseTime;
        responseTimeCount++;
      }
      
      // Count by status
      switch (proxy.health.status) {
        case 'healthy':
          status.healthyProxies++;
          break;
        case 'degraded':
          status.degradedProxies++;
          break;
        case 'failed':
          status.failedProxies++;
          break;
      }
      
      // Add to status groups
      status.byStatus[proxy.health.status].push({
        id: proxyId,
        host: proxy.host,
        port: proxy.port,
        health: proxy.health,
        checks: proxy.checks
      });
    }
    
    // Calculate averages
    status.averageHealth = this.monitoredProxies.size > 0 
      ? Math.round((totalHealth / this.monitoredProxies.size) * 100) / 100 
      : 0;
    
    status.averageResponseTime = responseTimeCount > 0 
      ? Math.round(totalResponseTime / responseTimeCount) 
      : 0;
    
    return status;
  }

  /**
   * Get detailed health report for specific proxy
   */
  getProxyHealthReport(proxyId) {
    const proxy = this.monitoredProxies.get(proxyId);
    const history = this.performanceHistory.get(proxyId);
    
    if (!proxy || !history) {
      return null;
    }
    
    return {
      proxyId,
      host: proxy.host,
      port: proxy.port,
      addedAt: proxy.addedAt,
      health: proxy.health,
      checks: proxy.checks,
      performance: {
        recentResponseTimes: history.responseTimes.slice(-10),
        availabilityWindows: history.availabilityWindows,
        trends: this.calculatePerformanceTrends(history)
      }
    };
  }

  /**
   * Calculate performance trends
   */
  calculatePerformanceTrends(history) {
    const trends = {
      responseTime: 'stable',
      availability: 'stable',
      direction: 'neutral'
    };
    
    // Response time trend
    if (history.responseTimes.length >= 5) {
      const recent = history.responseTimes.slice(-5);
      const older = history.responseTimes.slice(-10, -5);
      
      if (recent.length === 5 && older.length === 5) {
        const recentAvg = recent.reduce((sum, item) => sum + item.time, 0) / 5;
        const olderAvg = older.reduce((sum, item) => sum + item.time, 0) / 5;
        
        const change = (recentAvg - olderAvg) / olderAvg;
        
        if (change > 0.2) trends.responseTime = 'degrading';
        else if (change < -0.2) trends.responseTime = 'improving';
      }
    }
    
    // Availability trend
    if (history.availabilityWindows.length >= 4) {
      const recent = history.availabilityWindows.slice(-2);
      const older = history.availabilityWindows.slice(-4, -2);
      
      const recentAvailability = recent.reduce(
        (sum, window) => sum + (window.successful / window.total), 0
      ) / recent.length;
      
      const olderAvailability = older.reduce(
        (sum, window) => sum + (window.successful / window.total), 0
      ) / older.length;
      
      const change = recentAvailability - olderAvailability;
      
      if (change > 0.1) trends.availability = 'improving';
      else if (change < -0.1) trends.availability = 'degrading';
    }
    
    // Overall direction
    if (trends.responseTime === 'improving' && trends.availability === 'improving') {
      trends.direction = 'improving';
    } else if (trends.responseTime === 'degrading' || trends.availability === 'degrading') {
      trends.direction = 'degrading';
    }
    
    return trends;
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ProxyHealthMonitor;