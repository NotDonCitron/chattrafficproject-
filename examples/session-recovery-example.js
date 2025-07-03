const SessionRecoveryManager = require('../src/session-recovery/session-recovery-manager');
const ProxyPoolManager = require('../src/proxy/proxy-pool-manager');
const ConversationManager = require('../src/ai/conversation-manager');
const DashboardManager = require('../src/dashboard/dashboard-manager');
const winston = require('winston');

/**
 * Example: Advanced Session Recovery System Integration
 * Demonstrates comprehensive session recovery with state persistence,
 * proxy failover, and connection healing capabilities
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
    logger.info('Starting Advanced Session Recovery System Example...');
    
    // 1. Initialize Session Recovery Manager
    const recoveryManager = new SessionRecoveryManager({
      // State persistence configuration
      persistenceType: 'file', // 'file', 'redis', or 'memory'
      stateDirectory: './session-states',
      autoSaveInterval: 30000, // 30 seconds
      
      // Recovery engine configuration
      maxRecoveryAttempts: 5,
      recoveryDelay: 5000,
      enableProxyFailover: true,
      
      // Connection healing configuration
      maxRetryAttempts: 10,
      enableCircuitBreaker: true,
      adaptiveRetry: true,
      
      // System configuration
      enableSessionMonitoring: true,
      monitoringInterval: 60000, // 1 minute
      maxConcurrentRecoveries: 5,
      enableFailoverAlerts: true
    });
    
    // 2. Initialize supporting systems
    const proxyManager = new ProxyPoolManager({
      maxPoolSize: 50,
      healthCheckInterval: 60000,
      enableGeotargeting: true
    });
    
    const conversationManager = new ConversationManager({
      maxConcurrentConversations: 25,
      enableContextMemory: true,
      enablePersonalityEngine: true
    });
    
    const dashboardManager = new DashboardManager({
      websocketPort: 8080,
      apiPort: 3001,
      enableAuth: false
    });
    
    // 3. Setup event handlers
    setupEventHandlers(recoveryManager, proxyManager, conversationManager, dashboardManager);
    
    // 4. Initialize all systems
    await recoveryManager.initialize();
    await dashboardManager.start();
    
    // 5. Integrate systems
    recoveryManager.integrateWithProxyManager(proxyManager);
    recoveryManager.integrateWithConversationManager(conversationManager);
    recoveryManager.integrateWithDashboard(dashboardManager);
    
    // 6. Add some demo proxies
    await addDemoProxies(proxyManager);
    
    logger.info('Session Recovery System started successfully!');
    logger.info('Features enabled:');
    logger.info('  ✓ Automatic session state persistence');
    logger.info('  ✓ Intelligent proxy failover');
    logger.info('  ✓ Connection healing with circuit breakers');
    logger.info('  ✓ Adaptive retry mechanisms');
    logger.info('  ✓ Real-time health monitoring');
    logger.info('  ✓ Recovery queue management');
    logger.info(`\nDashboard: http://localhost:3001`);
    logger.info(`WebSocket: ws://localhost:8080`);
    
    // 7. Demonstrate recovery capabilities
    if (process.env.DEMO_MODE === 'true') {
      await demonstrateRecoveryFeatures(recoveryManager);
    }
    
    // 8. Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await recoveryManager.shutdown();
      await dashboardManager.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await recoveryManager.shutdown();
      await dashboardManager.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start session recovery system:', error.message);
    process.exit(1);
  }
}

/**
 * Setup event handlers for demonstration
 */
function setupEventHandlers(recoveryManager, proxyManager, conversationManager, dashboardManager) {
  // Recovery Manager events
  recoveryManager.on('system-initialized', () => {
    logger.info('🚀 Session Recovery System initialized');
  });
  
  recoveryManager.on('session-recovered', (data) => {
    logger.info(`✅ Session recovered: ${data.sessionId} using ${data.strategy} (${data.attempts} attempts)`);
  });
  
  recoveryManager.on('session-recovery-failed', (data) => {
    logger.error(`❌ Session recovery failed: ${data.sessionId} after ${data.attempts} attempts`);
  });
  
  recoveryManager.on('connection-healed', (data) => {
    logger.info(`🔧 Connection healed: ${data.connectionId} (${data.attempts} attempts)`);
  });
  
  recoveryManager.on('circuit-breaker-opened', (data) => {
    logger.warn(`⚡ Circuit breaker opened for: ${data.connectionId}`);
  });
  
  recoveryManager.on('recovery-alert', (alert) => {
    logger.info(`🚨 Recovery alert: ${alert.type} for session ${alert.sessionId}`);
  });
  
  // Proxy Manager events
  proxyManager.on('proxy-failed', (data) => {
    logger.warn(`🔴 Proxy failed: ${data.proxyId} - ${data.error}`);
  });
  
  proxyManager.on('proxy-recovered', (data) => {
    logger.info(`🟢 Proxy recovered: ${data.proxyId}`);
  });
  
  // Dashboard events
  dashboardManager.on('dashboard-started', (data) => {
    logger.info(`📊 Dashboard started - WebSocket: ${data.websocketPort}, API: ${data.apiPort}`);
  });
}

/**
 * Add demo proxies for testing
 */
async function addDemoProxies(proxyManager) {
  const demoProxies = [
    { host: '203.0.113.10', port: 8080, protocol: 'http', type: 'premium', costPerHour: 0.8 },
    { host: '203.0.113.11', port: 8080, protocol: 'http', type: 'standard', costPerHour: 0.3 },
    { host: '203.0.113.12', port: 8080, protocol: 'http', type: 'residential', costPerHour: 1.2 },
    { host: '203.0.113.13', port: 8080, protocol: 'http', type: 'budget', costPerHour: 0.1 },
    { host: '203.0.113.14', port: 8080, protocol: 'http', type: 'mobile', costPerHour: 2.0 }
  ];
  
  for (const proxy of demoProxies) {
    try {
      await proxyManager.addProxy(proxy);
      logger.info(`Added demo proxy: ${proxy.host}:${proxy.port} (${proxy.type})`);
    } catch (error) {
      logger.warn(`Failed to add demo proxy ${proxy.host}: ${error.message}`);
    }
  }
}

/**
 * Demonstrate recovery features
 */
async function demonstrateRecoveryFeatures(recoveryManager) {
  logger.info('\n🎯 Starting Recovery Features Demonstration...');
  
  // 1. Create demo sessions
  await createDemoSessions(recoveryManager);
  
  // 2. Simulate session failures
  setTimeout(() => simulateSessionFailures(recoveryManager), 10000);
  
  // 3. Demonstrate connection healing
  setTimeout(() => demonstrateConnectionHealing(recoveryManager), 20000);
  
  // 4. Show recovery statistics
  setTimeout(() => showRecoveryStatistics(recoveryManager), 30000);
}

/**
 * Create demo sessions
 */
async function createDemoSessions(recoveryManager) {
  logger.info('📝 Creating demo sessions...');
  
  const sessions = [
    {
      sessionId: 'demo_session_1',
      platform: 'thundr',
      status: 'active',
      startTime: new Date(),
      personality: 'friendly',
      proxyId: 'proxy_1',
      conversationHistory: [
        { role: 'user', content: 'Hello!', timestamp: new Date() },
        { role: 'bot', content: 'Hi there! How are you?', timestamp: new Date() }
      ]
    },
    {
      sessionId: 'demo_session_2',
      platform: 'omegle',
      status: 'active',
      startTime: new Date(),
      personality: 'professional',
      proxyId: 'proxy_2',
      conversationHistory: [
        { role: 'user', content: 'What do you do?', timestamp: new Date() },
        { role: 'bot', content: 'I help with various tasks.', timestamp: new Date() }
      ]
    },
    {
      sessionId: 'demo_session_3',
      platform: 'chatroulette',
      status: 'active',
      startTime: new Date(),
      personality: 'casual',
      proxyId: 'proxy_3',
      failureCount: 2, // This session has had some issues
      conversationHistory: []
    }
  ];
  
  for (const session of sessions) {
    await recoveryManager.saveSessionState(session.sessionId, session);
    logger.info(`Created session: ${session.sessionId} on ${session.platform}`);
  }
}

/**
 * Simulate session failures
 */
async function simulateSessionFailures(recoveryManager) {
  logger.info('\n💥 Simulating session failures...');
  
  // Simulate different types of failures
  const failures = [
    {
      sessionId: 'demo_session_1',
      reason: 'proxy_failure',
      context: { proxyId: 'proxy_1', error: 'Connection timeout' }
    },
    {
      sessionId: 'demo_session_2',
      reason: 'connection_failure',
      context: { error: 'Network unreachable' }
    },
    {
      sessionId: 'demo_session_3',
      reason: 'repeated_failures',
      context: { failureCount: 3 }
    }
  ];
  
  for (const failure of failures) {
    try {
      logger.info(`Triggering recovery for ${failure.sessionId}: ${failure.reason}`);
      
      const result = await recoveryManager.triggerRecovery(
        failure.sessionId,
        failure.reason,
        failure.context
      );
      
      if (result.success) {
        logger.info(`✅ Recovery successful for ${failure.sessionId} using ${result.strategy}`);
      } else {
        logger.error(`❌ Recovery failed for ${failure.sessionId}: ${result.error}`);
      }
    } catch (error) {
      logger.error(`Recovery attempt failed: ${error.message}`);
    }
    
    // Wait between recoveries
    await sleep(3000);
  }
}

/**
 * Demonstrate connection healing
 */
async function demonstrateConnectionHealing(recoveryManager) {
  logger.info('\n🔧 Demonstrating connection healing...');
  
  // Simulate connection function that sometimes fails
  const flakyConnection = async (context) => {
    const shouldFail = Math.random() < 0.6; // 60% chance of failure
    
    if (shouldFail && context.attempts < 3) {
      throw new Error('Simulated connection failure');
    }
    
    // Simulate connection time
    await sleep(100 + Math.random() * 500);
    
    return {
      connected: true,
      timestamp: new Date(),
      attempt: context.attempts
    };
  };
  
  try {
    logger.info('Attempting connection healing...');
    
    const result = await recoveryManager.healConnection(
      'demo_connection_1',
      flakyConnection,
      { timeout: 5000 }
    );
    
    logger.info(`🎉 Connection healed successfully after ${result.attempts} attempts`);
  } catch (error) {
    logger.error(`Connection healing failed: ${error.message}`);
  }
}

/**
 * Show recovery statistics
 */
async function showRecoveryStatistics(recoveryManager) {
  logger.info('\n📊 Recovery System Statistics:');
  
  const metrics = recoveryManager.getSystemMetrics();
  
  logger.info('\n🔄 Recovery Engine:');
  logger.info(`  Total Attempts: ${metrics.recoveryStats.totalAttempts}`);
  logger.info(`  Successful Recoveries: ${metrics.recoveryStats.successfulRecoveries}`);
  logger.info(`  Success Rate: ${metrics.recoveryStats.successRate.toFixed(1)}%`);
  logger.info(`  Average Recovery Time: ${metrics.recoveryStats.averageRecoveryTimeMs}ms`);
  
  logger.info('\n🔧 Connection Healer:');
  logger.info(`  Total Healing Attempts: ${metrics.healingStats.totalAttempts}`);
  logger.info(`  Successful Healings: ${metrics.healingStats.successfulHeals}`);
  logger.info(`  Success Rate: ${metrics.healingStats.successRate.toFixed(1)}%`);
  logger.info(`  Circuit Breakers Active: ${metrics.healingStats.circuitBreakersOpen}`);
  
  logger.info('\n💾 State Manager:');
  logger.info(`  Total States: ${metrics.stateStats.totalStates}`);
  logger.info(`  Active Sessions: ${metrics.stateStats.activeSessions}`);
  logger.info(`  Cache Size: ${metrics.stateStats.cacheSize}`);
  
  logger.info('\n⚡ System Status:');
  logger.info(`  Active Recoveries: ${metrics.activeRecoveries}`);
  logger.info(`  Queued Recoveries: ${metrics.queuedRecoveries}`);
  logger.info(`  Sessions Monitored: ${metrics.systemStatus.metrics.sessionsMonitored}`);
  
  // Show recovery history
  const history = recoveryManager.getRecoveryHistory(5);
  if (history.length > 0) {
    logger.info('\n📋 Recent Recovery History:');
    history.forEach((entry, index) => {
      logger.info(`  ${index + 1}. ${entry.sessionId} - ${entry.strategy} (${entry.status})`);
    });
  }
  
  // Show session summary
  const sessionsSummary = await recoveryManager.getSessionsSummary();
  logger.info('\n📈 Session Summary:');
  logger.info(`  Total Sessions: ${sessionsSummary.total}`);
  logger.info(`  Active Sessions: ${sessionsSummary.active}`);
  logger.info(`  Cached Sessions: ${sessionsSummary.cached}`);
}

/**
 * Test specific recovery scenarios
 */
async function testRecoveryScenarios(recoveryManager) {
  logger.info('\n🧪 Testing Recovery Scenarios...');
  
  // Test 1: Proxy failover
  logger.info('\nTest 1: Proxy Failover');
  await testProxyFailover(recoveryManager);
  
  // Test 2: Platform switch
  logger.info('\nTest 2: Platform Switch');
  await testPlatformSwitch(recoveryManager);
  
  // Test 3: Graceful degradation
  logger.info('\nTest 3: Graceful Degradation');
  await testGracefulDegradation(recoveryManager);
}

async function testProxyFailover(recoveryManager) {
  const sessionId = 'test_proxy_failover';
  
  // Create session with specific proxy
  await recoveryManager.saveSessionState(sessionId, {
    sessionId,
    platform: 'thundr',
    status: 'active',
    proxyId: 'failing_proxy',
    assignmentId: 'assignment_1'
  });
  
  // Trigger proxy failover recovery
  try {
    const result = await recoveryManager.triggerRecovery(
      sessionId,
      'proxy_failure',
      { proxyId: 'failing_proxy', error: 'Connection timeout' }
    );
    
    logger.info(`Proxy failover result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    logger.error(`Proxy failover test failed: ${error.message}`);
  }
}

async function testPlatformSwitch(recoveryManager) {
  const sessionId = 'test_platform_switch';
  
  // Create session on specific platform
  await recoveryManager.saveSessionState(sessionId, {
    sessionId,
    platform: 'omegle',
    status: 'active',
    failureCount: 5 // Many failures
  });
  
  // Trigger platform switch recovery
  try {
    const result = await recoveryManager.triggerRecovery(
      sessionId,
      'repeated_failures',
      { failureCount: 5 }
    );
    
    logger.info(`Platform switch result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    logger.error(`Platform switch test failed: ${error.message}`);
  }
}

async function testGracefulDegradation(recoveryManager) {
  const sessionId = 'test_degradation';
  
  // Create session with quality issues
  await recoveryManager.saveSessionState(sessionId, {
    sessionId,
    platform: 'chatroulette',
    status: 'active',
    qualityScore: 0.3, // Low quality
    stabilityIssues: true
  });
  
  // Trigger graceful degradation
  try {
    const result = await recoveryManager.triggerRecovery(
      sessionId,
      'quality_degradation',
      { qualityScore: 0.3 }
    );
    
    logger.info(`Graceful degradation result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    logger.error(`Graceful degradation test failed: ${error.message}`);
  }
}

/**
 * Utility sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Health check for the recovery system
 */
async function performHealthCheck(recoveryManager) {
  try {
    const metrics = recoveryManager.getSystemMetrics();
    
    const health = {
      overall: 'healthy',
      components: {
        stateManager: metrics.systemStatus.components.stateManager ? 'healthy' : 'unhealthy',
        recoveryEngine: metrics.systemStatus.components.recoveryEngine ? 'healthy' : 'unhealthy',
        connectionHealer: metrics.systemStatus.components.connectionHealer ? 'healthy' : 'unhealthy'
      },
      metrics: {
        recoverySuccessRate: metrics.recoveryStats.successRate,
        healingSuccessRate: metrics.healingStats.successRate,
        activeSessions: metrics.stateStats.activeSessions,
        activeRecoveries: metrics.activeRecoveries
      },
      timestamp: new Date()
    };
    
    // Determine overall health
    if (health.metrics.recoverySuccessRate < 70 || health.metrics.healingSuccessRate < 70) {
      health.overall = 'degraded';
    }
    
    const unhealthyComponents = Object.values(health.components).filter(status => status === 'unhealthy');
    if (unhealthyComponents.length > 0) {
      health.overall = 'unhealthy';
    }
    
    return health;
  } catch (error) {
    return {
      overall: 'error',
      error: error.message,
      timestamp: new Date()
    };
  }
}

/**
 * Export functions for external use
 */
module.exports = {
  main,
  testRecoveryScenarios,
  performHealthCheck,
  demonstrateRecoveryFeatures
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Application failed:', error);
    process.exit(1);
  });
}