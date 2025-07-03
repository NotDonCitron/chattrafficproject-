const DashboardManager = require('../src/dashboard/dashboard-manager');
const ProxyPoolManager = require('../src/proxy/proxy-pool-manager');
const ConversationManager = require('../src/ai/conversation-manager');
const winston = require('winston');

/**
 * Example: Complete Dashboard Integration
 * Shows how to set up and integrate the real-time dashboard system
 * with proxy management and conversation tracking
 */

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function main() {
  try {
    logger.info('Starting ChatTraffic Enterprise Dashboard Integration Example...');
    
    // 1. Initialize Dashboard Manager
    const dashboardManager = new DashboardManager({
      websocketPort: 8080,
      apiPort: 3001,
      metricsInterval: 5000,
      enableAuth: false, // Disable auth for demo
      enableCORS: true
    });
    
    // 2. Initialize Proxy Pool Manager
    const proxyPoolManager = new ProxyPoolManager({
      maxPoolSize: 100,
      healthCheckInterval: 60000,
      enableGeotargeting: true
    });
    
    // 3. Initialize Conversation Manager
    const conversationManager = new ConversationManager({
      maxConcurrentConversations: 50,
      enableContextMemory: true,
      enablePersonalityEngine: true
    });
    
    // 4. Set up event handlers
    setupEventHandlers(dashboardManager, proxyPoolManager, conversationManager);
    
    // 5. Integrate components
    dashboardManager.integrateWithProxyManager(proxyPoolManager);
    dashboardManager.integrateWithConversationManager(conversationManager);
    
    // 6. Start the dashboard system
    await dashboardManager.start();
    
    logger.info('Dashboard system started successfully!');
    logger.info(`WebSocket Server: ws://localhost:8080`);
    logger.info(`REST API: http://localhost:3001`);
    logger.info(`Dashboard UI: Open src/dashboard/public/index.html in your browser`);
    
    // 7. Simulate some activity for demonstration
    if (process.env.DEMO_MODE === 'true') {
      await simulateActivity(proxyPoolManager, conversationManager);
    }
    
    // 8. Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await dashboardManager.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await dashboardManager.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start dashboard integration:', error.message);
    process.exit(1);
  }
}

/**
 * Set up event handlers for demonstration
 */
function setupEventHandlers(dashboardManager, proxyPoolManager, conversationManager) {
  // Dashboard events
  dashboardManager.on('dashboard-started', (data) => {
    logger.info(`Dashboard started on ports: WS=${data.websocketPort}, API=${data.apiPort}`);
  });
  
  dashboardManager.on('client-connected', (data) => {
    logger.info(`Dashboard client connected: ${data.clientId}`);
  });
  
  dashboardManager.on('client-disconnected', (data) => {
    logger.info(`Dashboard client disconnected: ${data.clientId}`);
  });
  
  dashboardManager.on('component-error', (error) => {
    logger.error(`Component error in ${error.component}: ${error.error}`);
  });
  
  // Proxy manager events
  proxyPoolManager.on('proxy-added', (proxy) => {
    logger.info(`Proxy added: ${proxy.host}:${proxy.port} (${proxy.type})`);
  });
  
  proxyPoolManager.on('proxy-failed', (data) => {
    logger.warn(`Proxy failed: ${data.proxyId} - ${data.error}`);
  });
  
  proxyPoolManager.on('proxy-recovered', (data) => {
    logger.info(`Proxy recovered: ${data.proxyId}`);
  });
  
  // Conversation manager events
  conversationManager.on('conversation-started', (data) => {
    logger.info(`Conversation started: ${data.conversationId} on ${data.platform}`);
  });
  
  conversationManager.on('conversation-ended', (data) => {
    logger.info(`Conversation ended: ${data.conversationId} (Quality: ${data.finalQuality})`);
  });
}

/**
 * Simulate activity for demonstration purposes
 */
async function simulateActivity(proxyPoolManager, conversationManager) {
  logger.info('Starting activity simulation...');
  
  // Add some demo proxies
  const demoProxies = [
    { host: '203.0.113.1', port: 8080, protocol: 'http', type: 'datacenter', costPerHour: 0.2 },
    { host: '203.0.113.2', port: 8080, protocol: 'http', type: 'residential', costPerHour: 1.0 },
    { host: '203.0.113.3', port: 8080, protocol: 'http', type: 'premium', costPerHour: 0.8 },
    { host: '203.0.113.4', port: 8080, protocol: 'http', type: 'mobile', costPerHour: 2.0 },
    { host: '203.0.113.5', port: 8080, protocol: 'http', type: 'budget', costPerHour: 0.1 }
  ];
  
  for (const proxy of demoProxies) {
    try {
      await proxyPoolManager.addProxy(proxy);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    } catch (error) {
      logger.warn(`Failed to add demo proxy ${proxy.host}: ${error.message}`);
    }
  }
  
  // Simulate conversations
  const platforms = ['thundr', 'omegle', 'chatroulette', 'emeraldchat'];
  const personalities = ['friendly', 'professional', 'casual', 'humorous', 'intellectual'];
  
  for (let i = 0; i < 10; i++) {
    setTimeout(async () => {
      try {
        const platform = platforms[Math.floor(Math.random() * platforms.length)];
        const personality = personalities[Math.floor(Math.random() * personalities.length)];
        
        const conversationId = `demo_conv_${Date.now()}_${i}`;
        
        // Start conversation
        conversationManager.emit('conversation-started', {
          conversationId,
          platform,
          personality,
          timestamp: new Date()
        });
        
        // Simulate conversation updates
        setTimeout(() => {
          conversationManager.emit('conversation-updated', {
            conversationId,
            qualityScore: Math.random() * 0.4 + 0.6, // 0.6-1.0
            engagementLevel: Math.random() * 0.5 + 0.5, // 0.5-1.0
            messageCount: Math.floor(Math.random() * 20) + 5 // 5-25 messages
          });
        }, Math.random() * 10000 + 5000); // 5-15 seconds
        
        // End conversation
        setTimeout(() => {
          conversationManager.emit('conversation-ended', {
            conversationId,
            finalQuality: Math.random() * 0.4 + 0.6,
            finalEngagement: Math.random() * 0.5 + 0.5,
            totalMessages: Math.floor(Math.random() * 30) + 10
          });
        }, Math.random() * 30000 + 15000); // 15-45 seconds
        
      } catch (error) {
        logger.warn(`Failed to simulate conversation: ${error.message}`);
      }
    }, i * 2000); // Stagger conversation starts
  }
  
  // Simulate proxy health updates
  setInterval(() => {
    const proxyIds = Array.from(proxyPoolManager.getAllProxies()).map(p => p.id);
    
    if (proxyIds.length > 0) {
      const randomProxyId = proxyIds[Math.floor(Math.random() * proxyIds.length)];
      
      proxyPoolManager.emit('proxy-health-updated', {
        proxyId: randomProxyId,
        health: {
          status: Math.random() > 0.1 ? 'healthy' : 'degraded',
          score: Math.random() * 0.5 + 0.5,
          responseTime: Math.random() * 1000 + 200,
          lastCheck: new Date()
        }
      });
    }
  }, 3000); // Every 3 seconds
  
  logger.info('Activity simulation started');
}

/**
 * Health check endpoint
 */
async function healthCheck(dashboardManager) {
  try {
    const health = await dashboardManager.healthCheck();
    return health;
  } catch (error) {
    return {
      overall: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Export functions for external use
 */
module.exports = {
  main,
  healthCheck,
  setupEventHandlers,
  simulateActivity
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Application failed:', error);
    process.exit(1);
  });
}