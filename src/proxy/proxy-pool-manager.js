const winston = require('winston');
const { EventEmitter } = require('events');
const ProxyHealthMonitor = require('./proxy-health-monitor');
const GeoTargetingService = require('./geo-targeting-service');

/**
 * ProxyPoolManager - Advanced proxy management with health monitoring and intelligent selection
 * Supports multiple proxy types and implements cost optimization algorithms
 */
class ProxyPoolManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxPoolSize: config.maxPoolSize || 1000,
      minHealthyProxies: config.minHealthyProxies || 50,
      rotationStrategy: config.rotationStrategy || 'performance_based',
      rotationInterval: config.rotationInterval || 300000, // 5 minutes
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      costOptimization: config.costOptimization ?? true,
      enableGeotargeting: config.enableGeotargeting ?? true,
      retryFailedProxies: config.retryFailedProxies ?? true,
      blacklistDuration: config.blacklistDuration || 3600000, // 1 hour
      ...config
    };
    
    // Proxy pools organized by type
    this.proxyPools = {
      premium: new Map(),     // High-cost, high-reliability
      standard: new Map(),    // Medium-cost, good reliability
      budget: new Map(),      // Low-cost, basic reliability
      residential: new Map(), // Residential IPs
      datacenter: new Map(),  // Datacenter IPs
      mobile: new Map()       // Mobile carrier IPs
    };
    
    // Active proxy assignments
    this.activeAssignments = new Map();
    
    // Blacklisted proxies (temporary failures)
    this.blacklist = new Map();
    
    // Performance metrics per proxy
    this.proxyMetrics = new Map();
    
    // Cost tracking
    this.costMetrics = {
      totalCost: 0,
      costPerHour: 0,
      costPerSuccessfulRequest: 0,
      costByType: {}
    };
    
    // Initialize services
    this.healthMonitor = new ProxyHealthMonitor({
      checkInterval: this.config.healthCheckInterval,
      timeout: 10000,
      maxConcurrentChecks: 20
    });
    
    this.geoTargeting = new GeoTargetingService({
      enabled: this.config.enableGeotargeting
    });
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/proxy-pool-manager.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.initializeEventHandlers();
    this.startRotationScheduler();
    this.startCostTracking();
  }

  /**
   * Initialize event handlers
   */
  initializeEventHandlers() {
    // Health monitor events
    this.healthMonitor.on('health-updated', (proxyId, healthData) => {
      this.updateProxyHealth(proxyId, healthData);
    });
    
    this.healthMonitor.on('proxy-failed', (proxyId, error) => {
      this.handleProxyFailure(proxyId, error);
    });
    
    this.healthMonitor.on('proxy-recovered', (proxyId) => {
      this.handleProxyRecovery(proxyId);
    });
  }

  /**
   * Add proxy to pool
   */
  async addProxy(proxyConfig) {
    try {
      const proxy = this.normalizeProxyConfig(proxyConfig);
      
      // Validate proxy configuration
      if (!this.validateProxyConfig(proxy)) {
        throw new Error('Invalid proxy configuration');
      }
      
      // Determine proxy type if not specified
      if (!proxy.type) {
        proxy.type = this.detectProxyType(proxy);
      }
      
      // Initialize proxy metadata
      const proxyData = {
        ...proxy,
        id: proxy.id || this.generateProxyId(proxy),
        addedAt: new Date(),
        lastUsed: null,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        health: {
          score: 0.5,
          lastCheck: null,
          status: 'unknown',
          responseTime: null,
          reliability: 0.5
        },
        cost: {
          perHour: proxy.costPerHour || this.getDefaultCost(proxy.type),
          totalCost: 0,
          costPerRequest: 0
        },
        geolocation: null,
        isActive: false,
        isBlacklisted: false
      };
      
      // Add to appropriate pool
      this.proxyPools[proxy.type].set(proxyData.id, proxyData);
      
      // Initialize metrics
      this.proxyMetrics.set(proxyData.id, {
        requests: 0,
        successes: 0,
        failures: 0,
        averageResponseTime: 0,
        lastSuccessTime: null,
        platformPerformance: {},
        geoPerformance: {}
      });
      
      // Start health monitoring
      await this.healthMonitor.addProxy(proxyData);
      
      // Get geolocation data
      if (this.config.enableGeotargeting) {
        try {
          const geoData = await this.geoTargeting.getLocation(proxy.host);
          proxyData.geolocation = geoData;
        } catch (geoError) {
          this.logger.warn('Failed to get geolocation for proxy', {
            proxyId: proxyData.id,
            error: geoError.message
          });
        }
      }
      
      this.emit('proxy-added', proxyData);
      
      this.logger.info('Proxy added to pool', {
        proxyId: proxyData.id,
        type: proxyData.type,
        host: proxyData.host,
        port: proxyData.port
      });
      
      return proxyData.id;
    } catch (error) {
      this.logger.error('Failed to add proxy', {
        error: error.message,
        proxyConfig
      });
      throw error;
    }
  }

  /**
   * Get optimal proxy based on requirements
   */
  async getOptimalProxy(requirements = {}) {
    try {
      const filters = this.parseRequirements(requirements);
      const candidates = await this.findCandidateProxies(filters);
      
      if (candidates.length === 0) {
        throw new Error('No suitable proxies available');
      }
      
      // Score and rank candidates
      const scoredCandidates = await this.scoreProxies(candidates, requirements);
      
      // Select best proxy based on strategy
      const selectedProxy = this.selectByStrategy(scoredCandidates, this.config.rotationStrategy);
      
      // Assign proxy
      const assignment = await this.assignProxy(selectedProxy, requirements);
      
      this.emit('proxy-assigned', {
        proxyId: selectedProxy.id,
        assignment: assignment.id,
        requirements,
        score: scoredCandidates.find(c => c.proxy.id === selectedProxy.id)?.score
      });
      
      return {
        proxy: selectedProxy,
        assignment: assignment.id
      };
    } catch (error) {
      this.logger.error('Failed to get optimal proxy', {
        error: error.message,
        requirements
      });
      throw error;
    }
  }

  /**
   * Release proxy assignment
   */
  async releaseProxy(assignmentId, metrics = {}) {
    try {
      const assignment = this.activeAssignments.get(assignmentId);
      
      if (!assignment) {
        throw new Error('Assignment not found');
      }
      
      const proxy = this.getProxyById(assignment.proxyId);
      
      if (proxy) {
        // Update proxy metrics
        this.updateProxyMetrics(proxy.id, metrics);
        
        // Update cost tracking
        this.updateCostMetrics(proxy, assignment, metrics);
        
        // Mark as inactive
        proxy.isActive = false;
        proxy.lastUsed = new Date();
      }
      
      // Remove assignment
      this.activeAssignments.delete(assignmentId);
      
      this.emit('proxy-released', {
        assignmentId,
        proxyId: assignment.proxyId,
        duration: Date.now() - assignment.startTime.getTime(),
        metrics
      });
      
      this.logger.info('Proxy released', {
        assignmentId,
        proxyId: assignment.proxyId,
        duration: Date.now() - assignment.startTime.getTime()
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to release proxy', {
        assignmentId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Remove proxy from pool
   */
  async removeProxy(proxyId, reason = 'manual') {
    try {
      const proxy = this.getProxyById(proxyId);
      
      if (!proxy) {
        return false;
      }
      
      // Release any active assignments
      for (const [assignmentId, assignment] of this.activeAssignments.entries()) {
        if (assignment.proxyId === proxyId) {
          await this.releaseProxy(assignmentId);
        }
      }
      
      // Remove from health monitoring
      await this.healthMonitor.removeProxy(proxyId);
      
      // Remove from pool
      this.proxyPools[proxy.type].delete(proxyId);
      
      // Clean up metrics
      this.proxyMetrics.delete(proxyId);
      this.blacklist.delete(proxyId);
      
      this.emit('proxy-removed', {
        proxyId,
        reason,
        type: proxy.type
      });
      
      this.logger.info('Proxy removed from pool', {
        proxyId,
        reason,
        type: proxy.type
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to remove proxy', {
        proxyId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Schedule automatic proxy rotation
   */
  async scheduleRotation(options = {}) {
    const strategy = options.strategy || this.config.rotationStrategy;
    const interval = options.interval || this.config.rotationInterval;
    
    try {
      // Get proxies that need rotation
      const proxiesForRotation = this.getProxiesForRotation(strategy);
      
      if (proxiesForRotation.length === 0) {
        this.logger.debug('No proxies need rotation');
        return;
      }
      
      this.logger.info('Starting scheduled rotation', {
        strategy,
        proxiesCount: proxiesForRotation.length
      });
      
      // Rotate proxies
      for (const proxy of proxiesForRotation) {
        await this.rotateProxy(proxy.id, strategy);
      }
      
      this.emit('rotation-completed', {
        strategy,
        proxiesRotated: proxiesForRotation.length
      });
      
    } catch (error) {
      this.logger.error('Rotation failed', {
        error: error.message,
        strategy
      });
    }
  }

  /**
   * Get proxies that need rotation
   */
  getProxiesForRotation(strategy) {
    const proxiesNeedingRotation = [];
    const now = Date.now();
    
    // Check all active proxies
    for (const [assignmentId, assignment] of this.activeAssignments.entries()) {
      const proxy = this.getProxyById(assignment.proxyId);
      
      if (!proxy) continue;
      
      let shouldRotate = false;
      
      switch (strategy) {
        case 'time_based':
          shouldRotate = now - assignment.startTime.getTime() > this.config.rotationInterval;
          break;
          
        case 'performance_based':
          const metrics = this.proxyMetrics.get(proxy.id);
          shouldRotate = metrics && (
            metrics.failures > metrics.successes ||
            proxy.health.score < 0.6
          );
          break;
          
        case 'cost_optimized':
          shouldRotate = this.shouldRotateForCostOptimization(proxy, assignment);
          break;
          
        case 'adaptive':
          shouldRotate = this.shouldRotateAdaptive(proxy, assignment);
          break;
      }
      
      if (shouldRotate) {
        proxiesNeedingRotation.push(proxy);
      }
    }
    
    return proxiesNeedingRotation;
  }

  /**
   * Rotate specific proxy
   */
  async rotateProxy(proxyId, reason = 'scheduled') {
    try {
      // Find active assignments for this proxy
      const assignments = Array.from(this.activeAssignments.entries())
        .filter(([, assignment]) => assignment.proxyId === proxyId);
      
      for (const [assignmentId, assignment] of assignments) {
        // Get replacement proxy
        const replacement = await this.getOptimalProxy(assignment.requirements);
        
        // Update assignment
        assignment.proxyId = replacement.proxy.id;
        assignment.rotatedAt = new Date();
        assignment.rotationReason = reason;
        
        this.emit('proxy-rotated', {
          oldProxyId: proxyId,
          newProxyId: replacement.proxy.id,
          assignmentId,
          reason
        });
      }
      
      this.logger.info('Proxy rotated', {
        proxyId,
        assignmentsUpdated: assignments.length,
        reason
      });
      
    } catch (error) {
      this.logger.error('Failed to rotate proxy', {
        proxyId,
        error: error.message
      });
    }
  }

  /**
   * Parse requirements into filters
   */
  parseRequirements(requirements) {
    return {
      location: requirements.location || null,
      speed: requirements.speed || 'any',
      reliability: requirements.reliability || 0.5,
      anonymity: requirements.anonymity || 'any',
      platform: requirements.platform || null,
      costLimit: requirements.costLimit || null,
      type: requirements.type || null,
      excludeProxies: requirements.excludeProxies || []
    };
  }

  /**
   * Find candidate proxies based on filters
   */
  async findCandidateProxies(filters) {
    const candidates = [];
    
    // Get all available proxies
    for (const poolType of Object.keys(this.proxyPools)) {
      const pool = this.proxyPools[poolType];
      
      for (const [proxyId, proxy] of pool.entries()) {
        // Skip if excluded
        if (filters.excludeProxies.includes(proxyId)) continue;
        
        // Skip blacklisted proxies
        if (this.blacklist.has(proxyId)) continue;
        
        // Skip unhealthy proxies
        if (proxy.health.score < 0.3) continue;
        
        // Skip if already at max usage
        if (proxy.isActive && this.isProxyOverloaded(proxy)) continue;
        
        // Apply filters
        if (this.passesFilters(proxy, filters)) {
          candidates.push(proxy);
        }
      }
    }
    
    return candidates;
  }

  /**
   * Check if proxy passes filters
   */
  passesFilters(proxy, filters) {
    // Type filter
    if (filters.type && proxy.type !== filters.type) return false;
    
    // Reliability filter
    if (proxy.health.score < filters.reliability) return false;
    
    // Cost filter
    if (filters.costLimit && proxy.cost.perHour > filters.costLimit) return false;
    
    // Location filter
    if (filters.location && proxy.geolocation) {
      if (!this.geoTargeting.matchesLocation(proxy.geolocation, filters.location)) {
        return false;
      }
    }
    
    // Speed filter
    if (filters.speed !== 'any') {
      const speedRequirement = this.getSpeedRequirement(filters.speed);
      if (proxy.health.responseTime > speedRequirement) return false;
    }
    
    return true;
  }

  /**
   * Score proxies based on multiple criteria
   */
  async scoreProxies(candidates, requirements) {
    const scoredCandidates = [];
    
    for (const proxy of candidates) {
      const score = this.calculateProxyScore(proxy, requirements);
      scoredCandidates.push({ proxy, score });
    }
    
    // Sort by score (highest first)
    return scoredCandidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate proxy score
   */
  calculateProxyScore(proxy, requirements) {
    let score = 0;
    
    // Health score (40% weight)
    score += proxy.health.score * 0.4;
    
    // Reliability score (25% weight)
    const metrics = this.proxyMetrics.get(proxy.id);
    const reliability = metrics && metrics.requests > 0 
      ? metrics.successes / metrics.requests 
      : 0.5;
    score += reliability * 0.25;
    
    // Performance score (20% weight)
    const performanceScore = this.calculatePerformanceScore(proxy, requirements);
    score += performanceScore * 0.2;
    
    // Cost efficiency score (10% weight)
    const costScore = this.calculateCostScore(proxy);
    score += costScore * 0.1;
    
    // Usage balance score (5% weight)
    const usageScore = this.calculateUsageScore(proxy);
    score += usageScore * 0.05;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(proxy, requirements) {
    let score = 0.5;
    
    // Response time score
    if (proxy.health.responseTime) {
      const targetTime = this.getSpeedRequirement(requirements.speed || 'medium');
      score += Math.max(0, 1 - (proxy.health.responseTime / targetTime)) * 0.5;
    }
    
    // Platform-specific performance
    if (requirements.platform) {
      const metrics = this.proxyMetrics.get(proxy.id);
      const platformPerf = metrics?.platformPerformance[requirements.platform];
      
      if (platformPerf) {
        score += (platformPerf.successRate / 100) * 0.3;
      }
    }
    
    // Geographic performance
    if (requirements.location && proxy.geolocation) {
      const geoScore = this.geoTargeting.calculateGeoScore(
        proxy.geolocation, 
        requirements.location
      );
      score += geoScore * 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate cost efficiency score
   */
  calculateCostScore(proxy) {
    const metrics = this.proxyMetrics.get(proxy.id);
    
    if (!metrics || metrics.requests === 0) {
      return 0.5; // Neutral score for unused proxies
    }
    
    const costPerSuccess = proxy.cost.totalCost / metrics.successes;
    const avgCostPerSuccess = this.getAverageCostPerSuccess();
    
    if (avgCostPerSuccess === 0) return 0.5;
    
    // Better (lower) cost gets higher score
    return Math.max(0, 1 - (costPerSuccess / avgCostPerSuccess));
  }

  /**
   * Calculate usage balance score
   */
  calculateUsageScore(proxy) {
    const avgUsage = this.getAverageUsage();
    
    if (avgUsage === 0) return 0.5;
    
    // Prefer less-used proxies for better load distribution
    const usageRatio = proxy.usageCount / avgUsage;
    return Math.max(0, 1 - usageRatio);
  }

  /**
   * Select proxy by strategy
   */
  selectByStrategy(scoredCandidates, strategy) {
    if (scoredCandidates.length === 0) {
      throw new Error('No candidates available');
    }
    
    switch (strategy) {
      case 'best_score':
        return scoredCandidates[0].proxy;
        
      case 'weighted_random':
        return this.selectWeightedRandom(scoredCandidates);
        
      case 'round_robin':
        return this.selectRoundRobin(scoredCandidates);
        
      case 'performance_based':
      default:
        // Select from top 3 candidates randomly for some variety
        const topCandidates = scoredCandidates.slice(0, 3);
        const randomIndex = Math.floor(Math.random() * topCandidates.length);
        return topCandidates[randomIndex].proxy;
    }
  }

  /**
   * Assign proxy to use
   */
  async assignProxy(proxy, requirements) {
    const assignmentId = this.generateAssignmentId();
    
    const assignment = {
      id: assignmentId,
      proxyId: proxy.id,
      startTime: new Date(),
      requirements,
      isActive: true
    };
    
    // Mark proxy as active
    proxy.isActive = true;
    proxy.usageCount++;
    
    // Store assignment
    this.activeAssignments.set(assignmentId, assignment);
    
    return assignment;
  }

  /**
   * Update proxy health from health monitor
   */
  updateProxyHealth(proxyId, healthData) {
    const proxy = this.getProxyById(proxyId);
    
    if (proxy) {
      proxy.health = {
        ...proxy.health,
        ...healthData,
        lastCheck: new Date()
      };
      
      this.emit('proxy-health-updated', {
        proxyId,
        health: proxy.health
      });
    }
  }

  /**
   * Handle proxy failure
   */
  handleProxyFailure(proxyId, error) {
    const proxy = this.getProxyById(proxyId);
    
    if (proxy) {
      proxy.failureCount++;
      
      // Add to blacklist if too many failures
      const metrics = this.proxyMetrics.get(proxyId);
      if (metrics && metrics.failures > 5) {
        this.blacklistProxy(proxyId, error);
      }
      
      this.emit('proxy-failed', {
        proxyId,
        error: error.message,
        failureCount: proxy.failureCount
      });
    }
  }

  /**
   * Handle proxy recovery
   */
  handleProxyRecovery(proxyId) {
    if (this.blacklist.has(proxyId)) {
      this.blacklist.delete(proxyId);
      
      this.emit('proxy-recovered', { proxyId });
      
      this.logger.info('Proxy recovered from blacklist', { proxyId });
    }
  }

  /**
   * Blacklist proxy temporarily
   */
  blacklistProxy(proxyId, reason) {
    const blacklistEntry = {
      reason,
      blacklistedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.blacklistDuration)
    };
    
    this.blacklist.set(proxyId, blacklistEntry);
    
    // Release any active assignments
    for (const [assignmentId, assignment] of this.activeAssignments.entries()) {
      if (assignment.proxyId === proxyId) {
        this.releaseProxy(assignmentId, { reason: 'blacklisted' });
      }
    }
    
    this.emit('proxy-blacklisted', {
      proxyId,
      reason,
      duration: this.config.blacklistDuration
    });
    
    this.logger.warn('Proxy blacklisted', {
      proxyId,
      reason,
      duration: this.config.blacklistDuration
    });
  }

  /**
   * Update proxy metrics after use
   */
  updateProxyMetrics(proxyId, metrics) {
    const proxyMetrics = this.proxyMetrics.get(proxyId);
    const proxy = this.getProxyById(proxyId);
    
    if (!proxyMetrics || !proxy) return;
    
    // Update basic metrics
    proxyMetrics.requests++;
    
    if (metrics.success) {
      proxyMetrics.successes++;
      proxy.successCount++;
      proxyMetrics.lastSuccessTime = new Date();
    } else {
      proxyMetrics.failures++;
      proxy.failureCount++;
    }
    
    // Update response time
    if (metrics.responseTime) {
      const currentAvg = proxyMetrics.averageResponseTime;
      proxyMetrics.averageResponseTime = 
        ((currentAvg * (proxyMetrics.requests - 1)) + metrics.responseTime) / proxyMetrics.requests;
    }
    
    // Update platform performance
    if (metrics.platform) {
      if (!proxyMetrics.platformPerformance[metrics.platform]) {
        proxyMetrics.platformPerformance[metrics.platform] = {
          requests: 0,
          successes: 0,
          successRate: 0
        };
      }
      
      const platformMetrics = proxyMetrics.platformPerformance[metrics.platform];
      platformMetrics.requests++;
      
      if (metrics.success) {
        platformMetrics.successes++;
      }
      
      platformMetrics.successRate = (platformMetrics.successes / platformMetrics.requests) * 100;
    }
  }

  /**
   * Update cost metrics
   */
  updateCostMetrics(proxy, assignment, metrics) {
    const duration = Date.now() - assignment.startTime.getTime();
    const hours = duration / (1000 * 60 * 60);
    const cost = proxy.cost.perHour * hours;
    
    // Update proxy cost
    proxy.cost.totalCost += cost;
    
    if (metrics.requests) {
      proxy.cost.costPerRequest = proxy.cost.totalCost / metrics.requests;
    }
    
    // Update global cost metrics
    this.costMetrics.totalCost += cost;
    
    if (!this.costMetrics.costByType[proxy.type]) {
      this.costMetrics.costByType[proxy.type] = 0;
    }
    this.costMetrics.costByType[proxy.type] += cost;
  }

  /**
   * Get proxy by ID from any pool
   */
  getProxyById(proxyId) {
    for (const pool of Object.values(this.proxyPools)) {
      if (pool.has(proxyId)) {
        return pool.get(proxyId);
      }
    }
    return null;
  }

  /**
   * Get pool statistics
   */
  getPoolStatus() {
    const status = {
      totalProxies: 0,
      healthyProxies: 0,
      activeProxies: 0,
      blacklistedProxies: this.blacklist.size,
      byType: {},
      byLocation: {},
      averageHealth: 0,
      costMetrics: this.costMetrics
    };
    
    let totalHealth = 0;
    
    for (const [poolType, pool] of Object.entries(this.proxyPools)) {
      status.byType[poolType] = {
        total: pool.size,
        healthy: 0,
        active: 0,
        averageHealth: 0
      };
      
      let typeHealth = 0;
      
      for (const proxy of pool.values()) {
        status.totalProxies++;
        totalHealth += proxy.health.score;
        typeHealth += proxy.health.score;
        
        if (proxy.health.score > 0.6) {
          status.healthyProxies++;
          status.byType[poolType].healthy++;
        }
        
        if (proxy.isActive) {
          status.activeProxies++;
          status.byType[poolType].active++;
        }
        
        // Location stats
        if (proxy.geolocation?.country) {
          const country = proxy.geolocation.country;
          if (!status.byLocation[country]) {
            status.byLocation[country] = 0;
          }
          status.byLocation[country]++;
        }
      }
      
      status.byType[poolType].averageHealth = pool.size > 0 
        ? Math.round((typeHealth / pool.size) * 100) / 100 
        : 0;
    }
    
    status.averageHealth = status.totalProxies > 0 
      ? Math.round((totalHealth / status.totalProxies) * 100) / 100 
      : 0;
    
    return status;
  }

  /**
   * Helper methods
   */
  normalizeProxyConfig(config) {
    return {
      host: config.host,
      port: config.port,
      protocol: config.protocol || 'http',
      username: config.username || null,
      password: config.password || null,
      type: config.type || null,
      costPerHour: config.costPerHour || null,
      id: config.id || null
    };
  }

  validateProxyConfig(proxy) {
    return proxy.host && proxy.port && proxy.protocol;
  }

  generateProxyId(proxy) {
    return `${proxy.protocol}_${proxy.host}_${proxy.port}`;
  }

  detectProxyType(proxy) {
    // Simple type detection based on cost or other indicators
    if (proxy.costPerHour > 0.5) return 'premium';
    if (proxy.costPerHour > 0.2) return 'standard';
    return 'budget';
  }

  getDefaultCost(type) {
    const costs = {
      premium: 0.8,
      standard: 0.3,
      budget: 0.1,
      residential: 1.2,
      datacenter: 0.2,
      mobile: 2.0
    };
    return costs[type] || 0.3;
  }

  getSpeedRequirement(speed) {
    const requirements = {
      slow: 3000,
      medium: 1500,
      fast: 800,
      very_fast: 400
    };
    return requirements[speed] || 1500;
  }

  isProxyOverloaded(proxy) {
    // Simple overload check - can be made more sophisticated
    return proxy.usageCount > 100;
  }

  shouldRotateForCostOptimization(proxy, assignment) {
    const duration = Date.now() - assignment.startTime.getTime();
    const cost = (duration / (1000 * 60 * 60)) * proxy.cost.perHour;
    
    // Rotate if cost exceeds threshold
    return cost > 1.0; // $1 per assignment
  }

  shouldRotateAdaptive(proxy, assignment) {
    const metrics = this.proxyMetrics.get(proxy.id);
    const duration = Date.now() - assignment.startTime.getTime();
    
    // Multiple factors for adaptive rotation
    return (
      proxy.health.score < 0.7 ||
      (metrics && metrics.failures > metrics.successes) ||
      duration > this.config.rotationInterval * 2
    );
  }

  selectWeightedRandom(scoredCandidates) {
    const totalScore = scoredCandidates.reduce((sum, candidate) => sum + candidate.score, 0);
    let random = Math.random() * totalScore;
    
    for (const candidate of scoredCandidates) {
      random -= candidate.score;
      if (random <= 0) {
        return candidate.proxy;
      }
    }
    
    return scoredCandidates[0].proxy; // fallback
  }

  selectRoundRobin(scoredCandidates) {
    // Simple round-robin based on usage count
    return scoredCandidates.sort((a, b) => a.proxy.usageCount - b.proxy.usageCount)[0].proxy;
  }

  getAverageCostPerSuccess() {
    let totalCost = 0;
    let totalSuccesses = 0;
    
    for (const proxy of this.getAllProxies()) {
      totalCost += proxy.cost.totalCost;
      totalSuccesses += proxy.successCount;
    }
    
    return totalSuccesses > 0 ? totalCost / totalSuccesses : 0;
  }

  getAverageUsage() {
    const allProxies = this.getAllProxies();
    const totalUsage = allProxies.reduce((sum, proxy) => sum + proxy.usageCount, 0);
    return allProxies.length > 0 ? totalUsage / allProxies.length : 0;
  }

  getAllProxies() {
    const allProxies = [];
    for (const pool of Object.values(this.proxyPools)) {
      allProxies.push(...pool.values());
    }
    return allProxies;
  }

  generateAssignmentId() {
    return `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startRotationScheduler() {
    setInterval(() => {
      this.scheduleRotation();
    }, this.config.rotationInterval);
  }

  startCostTracking() {
    setInterval(() => {
      this.updateGlobalCostMetrics();
    }, 60000); // Update every minute
  }

  updateGlobalCostMetrics() {
    const activeProxies = this.getAllProxies().filter(p => p.isActive);
    
    this.costMetrics.costPerHour = activeProxies.reduce(
      (sum, proxy) => sum + proxy.cost.perHour, 0
    );
    
    // Calculate cost per successful request
    const totalSuccesses = activeProxies.reduce(
      (sum, proxy) => sum + proxy.successCount, 0
    );
    
    this.costMetrics.costPerSuccessfulRequest = totalSuccesses > 0 
      ? this.costMetrics.totalCost / totalSuccesses 
      : 0;
  }
}

module.exports = ProxyPoolManager;