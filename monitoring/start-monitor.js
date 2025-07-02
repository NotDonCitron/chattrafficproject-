#!/usr/bin/env node

const IntelligentBotMonitor = require('./intelligent-monitor');
const path = require('path');

// Configuration - Use environment variable for security
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'your-api-key-here';

async function startMonitoring() {
    console.log('🚀 Starting Ultra-Intelligent Bot Monitoring System...');
    console.log('🧠 Powered by Anthropic Claude AI');
    console.log('=' .repeat(60));

    if (ANTHROPIC_API_KEY === 'your-api-key-here') {
        console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set!');
        console.log('💡 Please set your API key:');
        console.log('   Windows: set ANTHROPIC_API_KEY=your-key-here');
        console.log('   Linux/Mac: export ANTHROPIC_API_KEY=your-key-here');
        process.exit(1);
    }

    try {
        // Initialize the intelligent monitor
        const monitor = new IntelligentBotMonitor(ANTHROPIC_API_KEY);
        
        // Start monitoring the Python bot
        const botProcess = await monitor.startMonitoring('enhanced_thundr_bot.py');
        
        console.log('✅ Monitoring system active!');
        console.log('📊 Real-time analysis enabled');
        console.log('🔧 Auto-healing activated');
        console.log('📋 Watching for patterns...\n');

        // Status updates every 30 seconds
        setInterval(() => {
            const status = monitor.getStatus();
            console.log(`\n📊 MONITOR STATUS:`);
            console.log(`   Session: ${status.currentSession}`);
            console.log(`   Uptime: ${Math.round(status.uptime / 1000)}s`);
            console.log(`   Errors: ${status.totalErrors}`);
            console.log(`   Success Rate: ${status.successRate.toFixed(1)}%`);
            console.log('=' .repeat(40));
        }, 30000);

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutting down monitoring system...');
            if (botProcess) {
                botProcess.kill();
            }
            process.exit(0);
        });

        // Keep process alive
        process.stdin.resume();

    } catch (error) {
        console.error('❌ Failed to start monitoring system:', error.message);
        process.exit(1);
    }
}

// Display help information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🤖 Ultra-Intelligent Bot Monitoring System

USAGE:
  node monitoring/start-monitor.js [options]

OPTIONS:
  --help, -h     Show this help message
  --status       Show current monitoring status
  --config       Show configuration details

FEATURES:
  ✅ Real-time log analysis
  ✅ AI-powered error detection  
  ✅ Automatic fix generation
  ✅ Performance monitoring
  ✅ Intelligent healing strategies

MONITORING CAPABILITIES:
  🎯 Interest selection failures
  ⏰ Chat timeout optimization
  🔄 Browser restart management
  📊 Session performance analysis
  🧠 Pattern learning & prediction

The system will automatically:
  • Detect when interests fail to select
  • Analyze chat timeout patterns
  • Generate improved selectors using AI
  • Optimize bot strategies in real-time
  • Provide detailed performance reports

Press Ctrl+C to stop monitoring.
`);
    process.exit(0);
}

// Start the monitoring system
startMonitoring(); 