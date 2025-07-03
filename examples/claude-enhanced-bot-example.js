const ClaudeEnhancedThundrBot = require('../src/bots/claude-enhanced-thundr-bot');
const fs = require('fs');
const path = require('path');

/**
 * Example usage of Claude-Enhanced Thundr Bot
 * Demonstrates all features: AI responses, logging, self-healing
 */

async function runEnhancedBot() {
  // Ensure required directories exist
  const dirs = ['logs', 'cache', 'data', 'screenshots'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Bot configuration
  const config = {
    // Basic bot config
    headless: process.env.HEADLESS === 'true',
    chatMode: process.env.CHAT_MODE || 'video',
    interests: ['gaming', 'technology', 'music', 'movies', 'travel'],
    messages: [
      "Hey! How's it going?",
      "Hi there! What are you up to?",
      "Hello! Nice to meet you!",
      "Hey! Having a good day?"
    ],
    keepAlive: true,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    
    // Claude integration
    claudeApiKey: process.env.ANTHROPIC_API_KEY,
    useClaudeForResponses: true,
    claudeModel: 'claude-3-haiku-20240307',
    claudeCacheEnabled: true,
    
    // Performance optimization
    adaptiveInterests: true,
    performanceOptimization: true,
    detailedLogging: true,
    metricsInterval: 15000, // 15 seconds
    
    // Self-healing
    autoLearn: true,
    domScanningEnabled: true,
    maxHealingAttempts: 3,
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info'
  };

  // Create bot instance
  const bot = new ClaudeEnhancedThundrBot(config);

  // Event listeners for monitoring
  bot.on('browser_started', () => {
    console.log('✅ Browser started successfully');
  });

  bot.on('page_loaded', () => {
    console.log('✅ Thundr.com loaded');
  });

  bot.on('interests_selected', ({ count }) => {
    console.log(`✅ Selected ${count} interests`);
  });

  bot.on('chat_started', ({ mode }) => {
    console.log(`✅ Started ${mode} chat`);
  });

  bot.on('partner_connected', () => {
    console.log('✅ Partner connected!');
  });

  bot.on('message_sent', ({ message }) => {
    console.log(`📤 Sent: ${message}`);
  });

  bot.on('message_received', ({ message }) => {
    console.log(`📥 Received: ${message}`);
  });

  bot.on('chat_ended', () => {
    console.log('👋 Chat ended');
  });

  bot.on('error', ({ type, error }) => {
    console.error(`❌ Error (${type}): ${error}`);
  });

  // Claude manager events
  bot.claudeManager.on('response-generated', ({ userMessage, response }) => {
    console.log('🤖 Claude generated response:', response);
  });

  bot.claudeManager.on('step-analyzed', ({ stepName, suggestions }) => {
    console.log(`🔍 Claude analysis for ${stepName}:`, suggestions);
  });

  // Performance logger events
  bot.performanceLogger.on('metrics-updated', (metrics) => {
    console.log('📊 Performance Metrics:', {
      successRate: `${metrics.successRate}%`,
      avgResponseTime: `${metrics.avgResponseTime}ms`,
      memoryUsage: `${metrics.memoryUsage}MB`
    });
  });

  // Self-healing events
  bot.selfHealingEngine.on('healed', ({ error, strategy, result }) => {
    console.log(`🔧 Self-healed: ${error} using ${strategy}`);
  });

  bot.selfHealingEngine.on('healing-failed', ({ error, attempts }) => {
    console.log(`⚠️ Healing failed after ${attempts} attempts: ${error}`);
  });

  // Session completed event
  bot.on('session-completed', ({ sessionData, performanceReport, healingStats }) => {
    console.log('\n📋 Session Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Session ID: ${sessionData.sessionId}`);
    console.log(`Total Chats: ${sessionData.chats.length}`);
    console.log(`Claude Interactions: ${sessionData.claudeInteractions}`);
    console.log(`Healing Attempts: ${sessionData.healingAttempts}`);
    console.log(`Success Rate: ${performanceReport.summary.successRate}`);
    console.log(`Average Step Duration: ${performanceReport.summary.avgStepDuration}ms`);
    
    if (performanceReport.summary.mostFailedStep) {
      console.log(`Most Failed Step: ${performanceReport.summary.mostFailedStep.step} (${performanceReport.summary.mostFailedStep.failures} failures)`);
    }
    
    console.log('\n💡 Recommendations:');
    performanceReport.recommendations.forEach(rec => {
      console.log(`- [${rec.type.toUpperCase()}] ${rec.message}`);
    });
    
    console.log('\n🔧 Healing Statistics:');
    console.log(`Total Healing Attempts: ${healingStats.totalHealingAttempts}`);
    console.log(`Successful Healings: ${healingStats.successfulHealings}`);
    console.log(`Cached Selectors: ${healingStats.cachedSelectors}`);
    
    // Save detailed report
    const reportPath = path.join('logs', `enhanced-session-${sessionData.sessionId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      sessionData,
      performanceReport,
      healingStats
    }, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  });

  // Error report event
  bot.on('error-report', (report) => {
    console.error('\n❌ Error Report:');
    console.error('═══════════════════════════════════════');
    console.error(`Error: ${report.error.message}`);
    console.error(`Type: ${report.error.type}`);
    console.error(`Last Step: ${report.context.lastStep}`);
    console.error(`Healing Attempts: ${report.context.healingAttempts}`);
    
    const errorReportPath = path.join('logs', `error-report-${report.sessionId}.json`);
    fs.writeFileSync(errorReportPath, JSON.stringify(report, null, 2));
    console.error(`\n📄 Error report saved to: ${errorReportPath}`);
  });

  try {
    console.log('🚀 Starting Claude-Enhanced Thundr Bot...');
    console.log('═══════════════════════════════════════');
    console.log('Features enabled:');
    console.log('- 🤖 Claude AI for intelligent responses');
    console.log('- 📊 Comprehensive performance logging');
    console.log('- 🔧 Self-healing with DOM scanning');
    console.log('- 📈 Adaptive interest selection');
    console.log('- 💾 Selector caching and learning');
    console.log('═══════════════════════════════════════\n');

    // Run the bot
    await bot.run();
  } catch (error) {
    console.error('❌ Bot failed:', error);
  } finally {
    // Ensure browser is closed
    await bot.stop();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⏹️ Stopping bot...');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

// Check for required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
  console.error('Set it with: export ANTHROPIC_API_KEY=your-api-key');
  process.exit(1);
}

// Run the bot
runEnhancedBot().catch(console.error);