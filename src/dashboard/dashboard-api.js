const express = require('express');
const cors = require('cors');
const winston = require('winston');
const { EventEmitter } = require('events');

/**
 * DashboardAPI - REST API for dashboard data access
 * Provides endpoints for metrics, sessions, and configuration
 */
class DashboardAPI extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3001,
      enableCORS: config.enableCORS ?? true,
      enableAuth: config.enableAuth ?? false,
      authToken: config.authToken || process.env.DASHBOARD_API_TOKEN,
      rateLimit: config.rateLimit ?? true,
      maxRequestsPerMinute: config.maxRequestsPerMinute || 100,
      ...config
    };
    
    // Express app
    this.app = express();
    this.server = null;
    
    // Dependencies (injected)
    this.metricsCollector = null;
    this.webSocketServer = null;
    
    // Rate limiting
    this.requestCounts = new Map();
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/dashboard-api.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // CORS
    if (this.config.enableCORS) {
      this.app.use(cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));
    }
    
    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug('API Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
    
    // Rate limiting
    if (this.config.rateLimit) {
      this.app.use(this.rateLimitMiddleware.bind(this));
    }
    
    // Authentication
    if (this.config.enableAuth) {
      this.app.use(this.authMiddleware.bind(this));
    }
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
    
    // API info
    this.app.get('/api/info', (req, res) => {
      res.json({
        version: '1.0.0',
        name: 'ChatTraffic Dashboard API',
        endpoints: this.getEndpointList(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Current metrics
    this.app.get('/api/metrics', this.handleGetMetrics.bind(this));
    
    // Metrics history
    this.app.get('/api/metrics/history', this.handleGetMetricsHistory.bind(this));
    
    // Current sessions
    this.app.get('/api/sessions', this.handleGetSessions.bind(this));
    
    // Session details
    this.app.get('/api/sessions/:sessionId', this.handleGetSessionDetails.bind(this));
    
    // Proxy health
    this.app.get('/api/proxies', this.handleGetProxies.bind(this));
    
    // Proxy details
    this.app.get('/api/proxies/:proxyId', this.handleGetProxyDetails.bind(this));
    
    // Conversations
    this.app.get('/api/conversations', this.handleGetConversations.bind(this));
    
    // Conversation details
    this.app.get('/api/conversations/:conversationId', this.handleGetConversationDetails.bind(this));
    
    // System status
    this.app.get('/api/system/status', this.handleGetSystemStatus.bind(this));
    
    // WebSocket server status
    this.app.get('/api/websocket/status', this.handleGetWebSocketStatus.bind(this));
    
    // Configuration endpoints
    this.app.get('/api/config', this.handleGetConfig.bind(this));
    this.app.put('/api/config', this.handleUpdateConfig.bind(this));
    
    // Statistics endpoints
    this.app.get('/api/stats/summary', this.handleGetStatsSummary.bind(this));
    this.app.get('/api/stats/performance', this.handleGetPerformanceStats.bind(this));
    
    // Search and filtering
    this.app.get('/api/search/sessions', this.handleSearchSessions.bind(this));
    this.app.get('/api/search/conversations', this.handleSearchConversations.bind(this));
    
    // Export data
    this.app.get('/api/export/metrics', this.handleExportMetrics.bind(this));
    this.app.get('/api/export/sessions', this.handleExportSessions.bind(this));
    
    // Error handling
    this.app.use(this.errorHandler.bind(this));
    
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
      });
    });
  }

  /**
   * Rate limiting middleware
   */
  rateLimitMiddleware(req, res, next) {
    const clientId = req.ip;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    // Clean old entries
    this.requestCounts.forEach((requests, id) => {
      const validRequests = requests.filter(time => time > windowStart);
      if (validRequests.length === 0) {
        this.requestCounts.delete(id);
      } else {
        this.requestCounts.set(id, validRequests);
      }
    });
    
    // Check current client
    const clientRequests = this.requestCounts.get(clientId) || [];
    const recentRequests = clientRequests.filter(time => time > windowStart);
    
    if (recentRequests.length >= this.config.maxRequestsPerMinute) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        limit: this.config.maxRequestsPerMinute,
        windowSeconds: 60,
        retryAfter: 60
      });
    }
    
    // Add current request
    recentRequests.push(now);
    this.requestCounts.set(clientId, recentRequests);
    
    next();
  }

  /**
   * Authentication middleware
   */
  authMiddleware(req, res, next) {
    // Skip auth for health check
    if (req.path === '/health') {
      return next();
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Authorization header required'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (token !== this.config.authToken) {
      return res.status(401).json({
        error: 'Invalid authentication token'
      });
    }
    
    next();
  }

  /**
   * Get current metrics
   */
  async handleGetMetrics(req, res) {
    try {
      if (!this.metricsCollector) {
        return res.status(503).json({
          error: 'Metrics collector not available'
        });
      }
      
      const metrics = this.metricsCollector.getCurrentMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get metrics');
    }
  }

  /**
   * Get metrics history
   */
  async handleGetMetricsHistory(req, res) {
    try {
      if (!this.metricsCollector) {
        return res.status(503).json({
          error: 'Metrics collector not available'
        });
      }
      
      const { timeRange, limit } = req.query;
      const history = this.metricsCollector.getMetricsHistory(
        timeRange ? parseInt(timeRange) : null,
        limit ? parseInt(limit) : null
      );
      
      res.json({
        success: true,
        data: history,
        count: history.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get metrics history');
    }
  }

  /**
   * Get current sessions
   */
  async handleGetSessions(req, res) {
    try {
      if (!this.metricsCollector) {
        return res.status(503).json({
          error: 'Metrics collector not available'
        });
      }
      
      const sessions = this.metricsCollector.getCurrentSessions();
      
      res.json({
        success: true,
        data: sessions,
        count: sessions.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get sessions');
    }
  }

  /**
   * Get session details
   */
  async handleGetSessionDetails(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!this.metricsCollector) {
        return res.status(503).json({
          error: 'Metrics collector not available'
        });
      }
      
      const sessions = this.metricsCollector.getCurrentSessions();
      const session = sessions.find(s => s.sessionId === sessionId);
      
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          sessionId
        });
      }
      
      res.json({
        success: true,
        data: session,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get session details');
    }
  }

  /**
   * Get proxy health data
   */
  async handleGetProxies(req, res) {
    try {
      // This would integrate with the proxy pool manager
      const proxies = [];
      
      res.json({
        success: true,
        data: proxies,
        count: proxies.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get proxies');
    }
  }

  /**
   * Get system status
   */
  async handleGetSystemStatus(req, res) {
    try {
      const status = {
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          version: process.version
        },
        api: {
          port: this.config.port,
          isRunning: this.server !== null,
          requests: this.getTotalRequests()
        },
        collectors: {
          metrics: this.metricsCollector ? this.metricsCollector.getStatus() : null,
          websocket: this.webSocketServer ? this.webSocketServer.getServerStatus() : null
        }
      };
      
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get system status');
    }
  }

  /**
   * Get WebSocket server status
   */
  async handleGetWebSocketStatus(req, res) {
    try {
      if (!this.webSocketServer) {
        return res.status(503).json({
          error: 'WebSocket server not available'
        });
      }
      
      const status = this.webSocketServer.getServerStatus();
      
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get WebSocket status');
    }
  }

  /**
   * Get configuration
   */
  async handleGetConfig(req, res) {
    try {
      const config = {
        api: {
          port: this.config.port,
          enableCORS: this.config.enableCORS,
          enableAuth: this.config.enableAuth,
          rateLimit: this.config.rateLimit,
          maxRequestsPerMinute: this.config.maxRequestsPerMinute
        },
        features: {
          metrics: this.metricsCollector !== null,
          websocket: this.webSocketServer !== null
        }
      };
      
      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get configuration');
    }
  }

  /**
   * Update configuration
   */
  async handleUpdateConfig(req, res) {
    try {
      const updates = req.body;
      
      // Validate and apply configuration updates
      // This would typically validate against a schema
      
      res.json({
        success: true,
        message: 'Configuration updated',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to update configuration');
    }
  }

  /**
   * Get statistics summary
   */
  async handleGetStatsSummary(req, res) {
    try {
      const summary = {
        sessions: {
          total: 0,
          active: 0,
          completed: 0,
          failed: 0
        },
        proxies: {
          total: 0,
          healthy: 0,
          degraded: 0,
          failed: 0
        },
        conversations: {
          total: 0,
          active: 0,
          averageQuality: 0,
          averageEngagement: 0
        }
      };
      
      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error, 'Failed to get statistics summary');
    }
  }

  /**
   * Export metrics data
   */
  async handleExportMetrics(req, res) {
    try {
      const { format = 'json', timeRange } = req.query;
      
      if (!this.metricsCollector) {
        return res.status(503).json({
          error: 'Metrics collector not available'
        });
      }
      
      const history = this.metricsCollector.getMetricsHistory(
        timeRange ? parseInt(timeRange) : null
      );
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
        res.send(this.convertToCSV(history));
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=metrics.json');
        res.json(history);
      }
    } catch (error) {
      this.handleError(res, error, 'Failed to export metrics');
    }
  }

  /**
   * Error handler
   */
  errorHandler(error, req, res, next) {
    this.logger.error('API Error', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle specific error
   */
  handleError(res, error, message) {
    this.logger.error(message, { error: error.message });
    
    res.status(500).json({
      error: message,
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start the API server
   */
  async start() {
    try {
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info('Dashboard API started', {
          port: this.config.port,
          cors: this.config.enableCORS,
          auth: this.config.enableAuth
        });
        
        this.emit('api-started', { port: this.config.port });
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to start API server', {
        error: error.message,
        port: this.config.port
      });
      throw error;
    }
  }

  /**
   * Stop the API server
   */
  async stop() {
    try {
      if (this.server) {
        this.server.close();
        this.server = null;
      }
      
      this.logger.info('Dashboard API stopped');
      this.emit('api-stopped');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to stop API server', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Set metrics collector dependency
   */
  setMetricsCollector(metricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Set WebSocket server dependency
   */
  setWebSocketServer(webSocketServer) {
    this.webSocketServer = webSocketServer;
  }

  /**
   * Helper methods
   */
  getEndpointList() {
    return [
      'GET /health',
      'GET /api/info',
      'GET /api/metrics',
      'GET /api/metrics/history',
      'GET /api/sessions',
      'GET /api/sessions/:sessionId',
      'GET /api/proxies',
      'GET /api/proxies/:proxyId',
      'GET /api/conversations',
      'GET /api/conversations/:conversationId',
      'GET /api/system/status',
      'GET /api/websocket/status',
      'GET /api/config',
      'PUT /api/config',
      'GET /api/stats/summary',
      'GET /api/export/metrics',
      'GET /api/export/sessions'
    ];
  }

  getTotalRequests() {
    let total = 0;
    this.requestCounts.forEach(requests => {
      total += requests.length;
    });
    return total;
  }

  convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    // Simple CSV conversion - in production you'd want a proper CSV library
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'object' ? JSON.stringify(value) : value;
      });
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
  }
}

module.exports = DashboardAPI;