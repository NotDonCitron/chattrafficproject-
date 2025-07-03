const WebSocket = require('ws');
const winston = require('winston');
const { EventEmitter } = require('events');
const MetricsCollector = require('./metrics-collector');

/**
 * WebSocketServer - Real-time dashboard with live metrics broadcasting
 * Provides real-time updates for session monitoring and performance metrics
 */
class WebSocketServer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 8080,
      enableAuth: config.enableAuth ?? false,
      authToken: config.authToken || process.env.DASHBOARD_AUTH_TOKEN,
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      metricsUpdateInterval: config.metricsUpdateInterval || 5000, // 5 seconds
      maxConnections: config.maxConnections || 100,
      enableCompression: config.enableCompression ?? true,
      enableCORS: config.enableCORS ?? true,
      ...config
    };
    
    // WebSocket server instance
    this.wss = null;
    
    // Connected clients
    this.clients = new Map();
    
    // Metrics collector
    this.metricsCollector = new MetricsCollector({
      collectInterval: this.config.metricsUpdateInterval
    });
    
    // Connection statistics
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      peakConnections: 0,
      connectionErrors: 0,
      dataTransferred: 0
    };
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/websocket-server.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    // Initialize metrics collection
    this.initializeMetricsCollection();
  }

  /**
   * Start the WebSocket server
   */
  async start() {
    try {
      this.wss = new WebSocket.Server({
        port: this.config.port,
        perMessageDeflate: this.config.enableCompression,
        maxPayload: 1024 * 1024, // 1MB max payload
        clientTracking: true
      });
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Start metrics collection
      await this.metricsCollector.start();
      
      // Start heartbeat
      this.startHeartbeat();
      
      this.logger.info('WebSocket server started', {
        port: this.config.port,
        compression: this.config.enableCompression,
        auth: this.config.enableAuth
      });
      
      this.emit('server-started', { port: this.config.port });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to start WebSocket server', {
        error: error.message,
        port: this.config.port
      });
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop() {
    try {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      // Close all client connections
      this.clients.forEach((client, ws) => {
        this.disconnectClient(ws, 'server_shutdown');
      });
      
      // Stop metrics collector
      if (this.metricsCollector) {
        await this.metricsCollector.stop();
      }
      
      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
      }
      
      this.logger.info('WebSocket server stopped');
      this.emit('server-stopped');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to stop WebSocket server', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
    
    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error', { error: error.message });
      this.connectionStats.connectionErrors++;
      this.emit('server-error', error);
    });
    
    this.wss.on('close', () => {
      this.logger.info('WebSocket server closed');
      this.emit('server-closed');
    });
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, request) {
    try {
      // Check connection limit
      if (this.clients.size >= this.config.maxConnections) {
        ws.close(1013, 'Server overloaded');
        return;
      }
      
      // Extract client info
      const clientInfo = this.extractClientInfo(request);
      
      // Authenticate if required
      if (this.config.enableAuth && !this.authenticateClient(clientInfo, request)) {
        ws.close(1008, 'Authentication failed');
        return;
      }
      
      // Add client
      const client = {
        id: this.generateClientId(),
        ws,
        info: clientInfo,
        connectedAt: new Date(),
        lastPing: new Date(),
        subscriptions: new Set(),
        dataTransferred: 0,
        isAlive: true
      };
      
      this.clients.set(ws, client);
      
      // Update connection stats
      this.connectionStats.totalConnections++;
      this.connectionStats.activeConnections++;
      this.connectionStats.peakConnections = Math.max(
        this.connectionStats.peakConnections,
        this.connectionStats.activeConnections
      );
      
      // Setup client event handlers
      this.setupClientHandlers(ws, client);
      
      // Send welcome message
      this.sendToClient(ws, {
        type: 'welcome',
        clientId: client.id,
        serverTime: new Date().toISOString(),
        availableStreams: this.getAvailableStreams()
      });
      
      // Send initial metrics
      this.sendInitialMetrics(ws);
      
      this.logger.info('Client connected', {
        clientId: client.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      
      this.emit('client-connected', {
        clientId: client.id,
        clientInfo: clientInfo
      });
      
    } catch (error) {
      this.logger.error('Failed to handle connection', {
        error: error.message,
        ip: request.socket.remoteAddress
      });
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Setup event handlers for individual client
   */
  setupClientHandlers(ws, client) {
    ws.on('message', (data) => {
      this.handleClientMessage(ws, client, data);
    });
    
    ws.on('close', (code, reason) => {
      this.handleClientDisconnect(ws, client, code, reason);
    });
    
    ws.on('error', (error) => {
      this.logger.error('Client WebSocket error', {
        clientId: client.id,
        error: error.message
      });
    });
    
    ws.on('pong', () => {
      client.isAlive = true;
      client.lastPing = new Date();
    });
  }

  /**
   * Handle client message
   */
  handleClientMessage(ws, client, data) {
    try {
      const message = JSON.parse(data.toString());
      client.dataTransferred += data.length;
      this.connectionStats.dataTransferred += data.length;
      
      this.logger.debug('Client message received', {
        clientId: client.id,
        type: message.type,
        size: data.length
      });
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(ws, client, message);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(ws, client, message);
          break;
          
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;
          
        case 'get_metrics':
          this.sendCurrentMetrics(ws);
          break;
          
        case 'get_sessions':
          this.sendCurrentSessions(ws);
          break;
          
        default:
          this.logger.warn('Unknown message type', {
            clientId: client.id,
            type: message.type
          });
      }
      
    } catch (error) {
      this.logger.error('Failed to handle client message', {
        clientId: client.id,
        error: error.message
      });
      
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  /**
   * Handle client subscription to data streams
   */
  handleSubscription(ws, client, message) {
    const { streams } = message;
    
    if (!Array.isArray(streams)) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Streams must be an array'
      });
      return;
    }
    
    const validStreams = this.getAvailableStreams();
    
    streams.forEach(stream => {
      if (validStreams.includes(stream)) {
        client.subscriptions.add(stream);
      } else {
        this.logger.warn('Invalid subscription stream', {
          clientId: client.id,
          stream
        });
      }
    });
    
    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      subscriptions: Array.from(client.subscriptions)
    });
    
    this.logger.debug('Client subscribed to streams', {
      clientId: client.id,
      subscriptions: Array.from(client.subscriptions)
    });
  }

  /**
   * Handle client unsubscription
   */
  handleUnsubscription(ws, client, message) {
    const { streams } = message;
    
    if (Array.isArray(streams)) {
      streams.forEach(stream => client.subscriptions.delete(stream));
    } else {
      client.subscriptions.clear();
    }
    
    this.sendToClient(ws, {
      type: 'unsubscription_confirmed',
      subscriptions: Array.from(client.subscriptions)
    });
  }

  /**
   * Handle client disconnect
   */
  handleClientDisconnect(ws, client, code, reason) {
    this.clients.delete(ws);
    this.connectionStats.activeConnections--;
    
    this.logger.info('Client disconnected', {
      clientId: client.id,
      code,
      reason: reason.toString(),
      duration: Date.now() - client.connectedAt.getTime(),
      dataTransferred: client.dataTransferred
    });
    
    this.emit('client-disconnected', {
      clientId: client.id,
      code,
      reason: reason.toString()
    });
  }

  /**
   * Disconnect client
   */
  disconnectClient(ws, reason = 'server_request') {
    const client = this.clients.get(ws);
    
    if (client) {
      ws.close(1000, reason);
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, data) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify(data);
        ws.send(message);
        
        const client = this.clients.get(ws);
        if (client) {
          client.dataTransferred += message.length;
          this.connectionStats.dataTransferred += message.length;
        }
        
        return true;
      }
    } catch (error) {
      this.logger.error('Failed to send message to client', {
        error: error.message
      });
    }
    return false;
  }

  /**
   * Broadcast message to all subscribed clients
   */
  broadcast(streamType, data) {
    const message = {
      type: 'stream_data',
      stream: streamType,
      data,
      timestamp: new Date().toISOString()
    };
    
    let sentCount = 0;
    
    this.clients.forEach((client, ws) => {
      if (client.subscriptions.has(streamType)) {
        if (this.sendToClient(ws, message)) {
          sentCount++;
        }
      }
    });
    
    this.logger.debug('Broadcast sent', {
      stream: streamType,
      clients: sentCount,
      dataSize: JSON.stringify(data).length
    });
    
    return sentCount;
  }

  /**
   * Initialize metrics collection and broadcasting
   */
  initializeMetricsCollection() {
    // Setup metrics collector event handlers
    this.metricsCollector.on('metrics-updated', (metrics) => {
      this.broadcast('metrics', metrics);
    });
    
    this.metricsCollector.on('session-update', (sessionData) => {
      this.broadcast('sessions', sessionData);
    });
    
    this.metricsCollector.on('proxy-health-update', (proxyData) => {
      this.broadcast('proxy_health', proxyData);
    });
    
    this.metricsCollector.on('conversation-update', (conversationData) => {
      this.broadcast('conversations', conversationData);
    });
    
    // Start periodic metrics broadcast
    this.metricsInterval = setInterval(() => {
      this.broadcastPeriodicMetrics();
    }, this.config.metricsUpdateInterval);
  }

  /**
   * Broadcast periodic metrics
   */
  broadcastPeriodicMetrics() {
    const metrics = this.metricsCollector.getCurrentMetrics();
    
    if (metrics) {
      this.broadcast('metrics', metrics);
    }
    
    // Broadcast server stats
    this.broadcast('server_stats', {
      connections: this.connectionStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start heartbeat to keep connections alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, ws) => {
        if (!client.isAlive) {
          this.disconnectClient(ws, 'heartbeat_timeout');
          return;
        }
        
        client.isAlive = false;
        
        try {
          ws.ping();
        } catch (error) {
          this.logger.error('Failed to ping client', {
            clientId: client.id,
            error: error.message
          });
        }
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Send initial metrics to new client
   */
  sendInitialMetrics(ws) {
    const metrics = this.metricsCollector.getCurrentMetrics();
    
    if (metrics) {
      this.sendToClient(ws, {
        type: 'initial_metrics',
        data: metrics
      });
    }
  }

  /**
   * Send current metrics to client
   */
  sendCurrentMetrics(ws) {
    const metrics = this.metricsCollector.getCurrentMetrics();
    
    this.sendToClient(ws, {
      type: 'metrics_response',
      data: metrics
    });
  }

  /**
   * Send current sessions to client
   */
  sendCurrentSessions(ws) {
    const sessions = this.metricsCollector.getCurrentSessions();
    
    this.sendToClient(ws, {
      type: 'sessions_response',
      data: sessions
    });
  }

  /**
   * Get available data streams
   */
  getAvailableStreams() {
    return [
      'metrics',
      'sessions', 
      'proxy_health',
      'conversations',
      'server_stats',
      'alerts'
    ];
  }

  /**
   * Extract client information from request
   */
  extractClientInfo(request) {
    return {
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'] || 'Unknown',
      origin: request.headers.origin || null,
      forwarded: request.headers['x-forwarded-for'] || null
    };
  }

  /**
   * Authenticate client (if auth is enabled)
   */
  authenticateClient(clientInfo, request) {
    if (!this.config.enableAuth) return true;
    
    const authHeader = request.headers.authorization;
    
    if (!authHeader) return false;
    
    const token = authHeader.replace('Bearer ', '');
    
    return token === this.config.authToken;
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server status
   */
  getServerStatus() {
    return {
      isRunning: this.wss !== null,
      port: this.config.port,
      connections: this.connectionStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      subscriptions: this.getSubscriptionStats()
    };
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats() {
    const stats = {};
    const streams = this.getAvailableStreams();
    
    streams.forEach(stream => {
      stats[stream] = 0;
    });
    
    this.clients.forEach(client => {
      client.subscriptions.forEach(stream => {
        if (stats[stream] !== undefined) {
          stats[stream]++;
        }
      });
    });
    
    return stats;
  }
}

module.exports = WebSocketServer;