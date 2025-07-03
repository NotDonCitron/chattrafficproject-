const winston = require('winston');
const { EventEmitter } = require('events');
const WebSocketServer = require('./websocket-server');
const MetricsCollector = require('./metrics-collector');
const DashboardAPI = require('./dashboard-api');

/**
 * DashboardManager - Orchestrates the complete real-time dashboard system
 * Manages WebSocket server, metrics collection, and REST API
 */
class DashboardManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      websocket: {
        port: config.websocketPort || 8080,
        enableAuth: config.enableAuth ?? false,
        authToken: config.authToken || process.env.DASHBOARD_AUTH_TOKEN,
        ...config.websocket
      },
      api: {
        port: config.apiPort || 3001,
        enableCORS: config.enableCORS ?? true,
        enableAuth: config.enableAuth ?? false,
        authToken: config.authToken || process.env.DASHBOARD_API_TOKEN,
        ...config.api
      },
      metrics: {
        collectInterval: config.metricsInterval || 5000,
        historyRetention: config.historyRetention || 24 * 60 * 60 * 1000,
        ...config.metrics
      },
      autoStart: config.autoStart ?? true,
      ...config
    };
    
    // Component instances
    this.webSocketServer = null;
    this.metricsCollector = null;
    this.dashboardAPI = null;
    
    // External integrations
    this.proxyPoolManager = null;
    this.conversationManager = null;
    
    // Status tracking
    this.status = {
      isStarted: false,
      components: {
        websocket: false,
        metrics: false,
        api: false
      },
      startTime: null,
      errors: []
    };
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/dashboard-manager.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    // Initialize components
    this.initializeComponents();
    
    // Auto-start if enabled
    if (this.config.autoStart) {
      this.start().catch(error => {
        this.logger.error('Auto-start failed', { error: error.message });
      });
    }
  }

  /**
   * Initialize dashboard components
   */
  initializeComponents() {
    try {
      // Initialize metrics collector
      this.metricsCollector = new MetricsCollector(this.config.metrics);
      
      // Initialize WebSocket server
      this.webSocketServer = new WebSocketServer(this.config.websocket);
      
      // Initialize REST API
      this.dashboardAPI = new DashboardAPI(this.config.api);
      
      // Set up component relationships
      this.dashboardAPI.setMetricsCollector(this.metricsCollector);
      this.dashboardAPI.setWebSocketServer(this.webSocketServer);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      this.logger.info('Dashboard components initialized');
    } catch (error) {
      this.logger.error('Failed to initialize components', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Setup event handlers for all components
   */
  setupEventHandlers() {
    // Metrics collector events
    this.metricsCollector.on('collection-started', () => {
      this.status.components.metrics = true;
      this.emit('metrics-started');
    });
    
    this.metricsCollector.on('collection-stopped', () => {
      this.status.components.metrics = false;
      this.emit('metrics-stopped');
    });
    
    this.metricsCollector.on('metrics-updated', (metrics) => {
      this.emit('metrics-updated', metrics);
    });
    
    // WebSocket server events
    this.webSocketServer.on('server-started', (data) => {
      this.status.components.websocket = true;
      this.emit('websocket-started', data);
    });
    
    this.webSocketServer.on('server-stopped', () => {
      this.status.components.websocket = false;
      this.emit('websocket-stopped');
    });
    
    this.webSocketServer.on('client-connected', (data) => {
      this.emit('client-connected', data);
    });
    
    this.webSocketServer.on('client-disconnected', (data) => {
      this.emit('client-disconnected', data);
    });
    
    // API server events
    this.dashboardAPI.on('api-started', (data) => {
      this.status.components.api = true;
      this.emit('api-started', data);
    });
    
    this.dashboardAPI.on('api-stopped', () => {
      this.status.components.api = false;
      this.emit('api-stopped');
    });
    
    // Error handling
    [this.metricsCollector, this.webSocketServer, this.dashboardAPI].forEach(component => {
      if (component) {
        component.on('error', (error) => {
          this.handleComponentError(component.constructor.name, error);
        });
      }
    });
  }

  /**
   * Start the complete dashboard system
   */
  async start() {
    try {
      this.logger.info('Starting dashboard system...');
      
      // Start metrics collector first
      await this.metricsCollector.start();
      this.logger.info('Metrics collector started');
      
      // Start WebSocket server
      await this.webSocketServer.start();
      this.logger.info('WebSocket server started');
      
      // Start REST API
      await this.dashboardAPI.start();
      this.logger.info('REST API started');
      
      // Update status
      this.status.isStarted = true;
      this.status.startTime = new Date();
      
      this.logger.info('Dashboard system started successfully', {
        websocketPort: this.config.websocket.port,
        apiPort: this.config.api.port,
        metricsInterval: this.config.metrics.collectInterval
      });
      
      this.emit('dashboard-started', {
        websocketPort: this.config.websocket.port,
        apiPort: this.config.api.port
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to start dashboard system', {
        error: error.message
      });
      
      // Cleanup on failure
      await this.stop();
      
      throw error;
    }
  }

  /**
   * Stop the complete dashboard system
   */
  async stop() {
    try {
      this.logger.info('Stopping dashboard system...');
      
      // Stop components in reverse order
      if (this.dashboardAPI) {
        await this.dashboardAPI.stop();
        this.logger.info('REST API stopped');
      }
      
      if (this.webSocketServer) {
        await this.webSocketServer.stop();
        this.logger.info('WebSocket server stopped');
      }
      
      if (this.metricsCollector) {
        await this.metricsCollector.stop();
        this.logger.info('Metrics collector stopped');
      }
      
      // Update status
      this.status.isStarted = false;
      this.status.components = {
        websocket: false,
        metrics: false,
        api: false
      };
      
      this.logger.info('Dashboard system stopped successfully');
      
      this.emit('dashboard-stopped');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to stop dashboard system', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Restart the dashboard system
   */
  async restart() {
    try {
      this.logger.info('Restarting dashboard system...');
      
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      await this.start();
      
      this.logger.info('Dashboard system restarted successfully');
      
      this.emit('dashboard-restarted');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to restart dashboard system', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Integrate with proxy pool manager
   */
  integrateWithProxyManager(proxyPoolManager) {
    this.proxyPoolManager = proxyPoolManager;
    
    // Listen to proxy events and update metrics
    proxyPoolManager.on('proxy-health-updated', (data) => {
      if (this.metricsCollector) {
        this.metricsCollector.updateProxyHealth(data.proxyId, {
          status: data.health.status,
          healthScore: data.health.score,
          responseTime: data.health.responseTime,
          lastCheck: data.health.lastCheck
        });
      }
    });
    
    proxyPoolManager.on('proxy-assigned', (data) => {
      if (this.metricsCollector) {
        this.metricsCollector.updateSession(data.assignment, {
          proxyId: data.proxyId,
          status: 'active',
          platform: data.requirements?.platform
        });
      }
    });
    
    proxyPoolManager.on('proxy-released', (data) => {
      if (this.metricsCollector) {
        this.metricsCollector.updateSession(data.assignmentId, {
          status: 'completed',
          endTime: new Date(),
          success: data.metrics?.success,
          duration: data.duration
        });
      }
    });
    
    this.logger.info('Integrated with proxy pool manager');
  }

  /**
   * Integrate with conversation manager
   */
  integrateWithConversationManager(conversationManager) {
    this.conversationManager = conversationManager;
    
    // Listen to conversation events and update metrics
    conversationManager.on('conversation-started', (data) => {
      if (this.metricsCollector) {
        this.metricsCollector.updateConversation(data.conversationId, {
          status: 'active',
          platform: data.platform,
          personality: data.personality,
          startTime: new Date(),
          messageCount: 0
        });
      }
    });
    
    conversationManager.on('conversation-updated', (data) => {
      if (this.metricsCollector) {
        this.metricsCollector.updateConversation(data.conversationId, {
          qualityScore: data.qualityScore,
          engagementLevel: data.engagementLevel,
          messageCount: data.messageCount,
          lastActivity: new Date()
        });
      }
    });
    
    conversationManager.on('conversation-ended', (data) => {
      if (this.metricsCollector) {
        this.metricsCollector.updateConversation(data.conversationId, {
          status: 'completed',
          endTime: new Date(),
          finalQuality: data.finalQuality,
          finalEngagement: data.finalEngagement,
          totalMessages: data.totalMessages
        });
      }
    });
    
    this.logger.info('Integrated with conversation manager');
  }

  /**
   * Handle component errors
   */
  handleComponentError(componentName, error) {
    const errorInfo = {
      component: componentName,
      error: error.message,
      timestamp: new Date(),
      stack: error.stack
    };
    
    this.status.errors.push(errorInfo);
    
    // Keep only last 100 errors
    if (this.status.errors.length > 100) {
      this.status.errors = this.status.errors.slice(-100);
    }
    
    this.logger.error('Component error', errorInfo);
    
    this.emit('component-error', errorInfo);
  }

  /**
   * Update configuration for specific component
   */
  async updateComponentConfig(component, config) {
    try {
      switch (component) {
        case 'websocket':
          Object.assign(this.config.websocket, config);
          if (this.status.components.websocket) {
            await this.webSocketServer.stop();
            this.webSocketServer = new WebSocketServer(this.config.websocket);
            await this.webSocketServer.start();
          }
          break;
          
        case 'api':
          Object.assign(this.config.api, config);
          if (this.status.components.api) {
            await this.dashboardAPI.stop();
            this.dashboardAPI = new DashboardAPI(this.config.api);
            this.dashboardAPI.setMetricsCollector(this.metricsCollector);
            this.dashboardAPI.setWebSocketServer(this.webSocketServer);
            await this.dashboardAPI.start();
          }
          break;
          
        case 'metrics':
          Object.assign(this.config.metrics, config);
          if (this.status.components.metrics) {
            await this.metricsCollector.stop();
            this.metricsCollector = new MetricsCollector(this.config.metrics);
            await this.metricsCollector.start();
          }
          break;
          
        default:
          throw new Error(`Unknown component: ${component}`);
      }
      
      this.logger.info('Component configuration updated', {
        component,
        config
      });
      
      this.emit('config-updated', { component, config });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to update component configuration', {
        component,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard status
   */
  getStatus() {
    const uptime = this.status.startTime 
      ? Date.now() - this.status.startTime.getTime()
      : 0;
    
    return {
      ...this.status,
      uptime,
      configuration: {
        websocket: this.config.websocket,
        api: this.config.api,
        metrics: this.config.metrics
      },
      integrations: {
        proxyManager: this.proxyPoolManager !== null,
        conversationManager: this.conversationManager !== null
      },
      performance: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      }
    };
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      websocket: {
        connections: 0,
        subscriptions: {},
        dataTransferred: 0
      },
      metrics: {
        collections: 0,
        activeSessions: 0,
        trackedProxies: 0,
        activeConversations: 0
      },
      api: {
        requests: 0,
        errors: 0
      }
    };
    
    // Get WebSocket stats
    if (this.webSocketServer) {
      const wsStatus = this.webSocketServer.getServerStatus();
      stats.websocket = {
        connections: wsStatus.connections?.activeConnections || 0,
        subscriptions: wsStatus.subscriptions || {},
        dataTransferred: wsStatus.connections?.dataTransferred || 0
      };
    }
    
    // Get metrics stats
    if (this.metricsCollector) {
      const metricsStatus = this.metricsCollector.getStatus();
      stats.metrics = {
        collections: metricsStatus.historySize || 0,
        activeSessions: metricsStatus.activeSessions || 0,
        trackedProxies: metricsStatus.trackedProxies || 0,
        activeConversations: metricsStatus.activeConversations || 0
      };
    }
    
    return stats;
  }

  /**
   * Export dashboard data
   */
  async exportData(options = {}) {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        configuration: this.config,
        status: this.getStatus(),
        metrics: null,
        sessions: null,
        errors: this.status.errors
      };
      
      // Include metrics if requested
      if (options.includeMetrics && this.metricsCollector) {
        exportData.metrics = this.metricsCollector.getMetricsHistory(
          options.timeRange,
          options.limit
        );
      }
      
      // Include sessions if requested
      if (options.includeSessions && this.metricsCollector) {
        exportData.sessions = this.metricsCollector.getCurrentSessions();
      }
      
      return exportData;
    } catch (error) {
      this.logger.error('Failed to export data', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Health check for all components
   */
  async healthCheck() {
    const health = {
      overall: 'healthy',
      components: {},
      timestamp: new Date().toISOString()
    };
    
    try {
      // Check each component
      health.components.metrics = this.status.components.metrics ? 'healthy' : 'stopped';
      health.components.websocket = this.status.components.websocket ? 'healthy' : 'stopped';
      health.components.api = this.status.components.api ? 'healthy' : 'stopped';
      
      // Check for recent errors
      const recentErrors = this.status.errors.filter(error => {
        return Date.now() - new Date(error.timestamp).getTime() < 300000; // 5 minutes
      });
      
      if (recentErrors.length > 0) {
        health.overall = 'degraded';
        health.recentErrors = recentErrors.length;
      }
      
      // Check if any critical component is down
      const criticalComponents = ['metrics', 'websocket', 'api'];
      const downComponents = criticalComponents.filter(comp => !this.status.components[comp]);
      
      if (downComponents.length > 0) {
        health.overall = 'unhealthy';
        health.downComponents = downComponents;
      }
      
    } catch (error) {
      health.overall = 'error';
      health.error = error.message;
    }
    
    return health;
  }
}

module.exports = DashboardManager;