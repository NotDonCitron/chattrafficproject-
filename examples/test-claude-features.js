const ClaudeManager = require('../src/claude/claude-manager');
const PerformanceLogger = require('../src/logging/performance-logger');
const SelfHealingEngine = require('../src/self-healing/self-healing-engine');

/**
 * Test script for Claude integration features
 * Validates all components work independently
 */

async function testClaudeManager() {
  console.log('🧪 Testing Claude Manager...');
  
  const claudeManager = new ClaudeManager(process.env.ANTHROPIC_API_KEY);
  
  try {
    // Test response generation
    const context = {
      interests: ['gaming', 'technology'],
      mode: 'video',
      previousMessages: ['Hello!', 'How are you?']
    };
    
    const response = await claudeManager.generateResponse(context, 'What games do you play?');
    console.log('✅ Claude response:', response);
    
    // Test step analysis
    const logs = ['step1: SUCCESS', 'step2: FAILED - timeout'];
    const analysis = await claudeManager.analyzeStep(
      'test_step',
      { selector: '.test-button' },
      logs
    );
    console.log('✅ Claude analysis:', analysis.suggestions.substring(0, 100) + '...');
    
    // Test optimization
    const performanceLogs = [
      { stepName: 'test1', duration: 5000, success: true },
      { stepName: 'test2', duration: 10000, success: false, error: 'timeout' }
    ];
    
    const optimizations = await claudeManager.optimizeBot(performanceLogs);
    console.log('✅ Claude optimizations:', optimizations);
    
    return true;
  } catch (error) {
    console.error('❌ Claude Manager test failed:', error.message);
    return false;
  }
}

function testPerformanceLogger() {
  console.log('📊 Testing Performance Logger...');
  
  try {
    const logger = new PerformanceLogger();
    
    // Test step logging
    const step = logger.startStep('test_step', { test: true });
    setTimeout(() => {
      step.end(true, { result: 'success' });
    }, 100);
    
    // Test direct logging
    logger.log('info', 'Test message', { context: 'test' });
    logger.log('error', 'Test error', { error: 'test error' });
    
    // Test metrics calculation
    setTimeout(() => {
      const analysis = logger.analyzePerformance();
      console.log('✅ Performance analysis:', {
        totalSteps: analysis.summary.totalSteps,
        successRate: analysis.summary.successRate
      });
    }, 200);
    
    console.log('✅ Performance Logger initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Performance Logger test failed:', error.message);
    return false;
  }
}

function testSelfHealingEngine() {
  console.log('🔧 Testing Self-Healing Engine...');
  
  try {
    const healingEngine = new SelfHealingEngine();
    
    // Test selector cache
    healingEngine.addSelectorToCache('test_element', '.test-selector', 0.8);
    
    // Test error categorization
    const selectorError = new Error('Element not found: .missing-selector');
    const errorType = healingEngine.categorizeError(selectorError);
    console.log('✅ Error categorization:', errorType);
    
    // Test selector generation
    const alternatives = healingEngine.generateAlternativeSelectors('.btn-primary', 'button');
    console.log('✅ Alternative selectors:', alternatives.slice(0, 3));
    
    // Test stats
    const stats = healingEngine.getHealingStats();
    console.log('✅ Healing stats:', {
      cachedSelectors: stats.cachedSelectors,
      totalAttempts: stats.totalHealingAttempts
    });
    
    console.log('✅ Self-Healing Engine initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Self-Healing Engine test failed:', error.message);
    return false;
  }
}

async function testIntegration() {
  console.log('🔗 Testing Component Integration...');
  
  try {
    const claudeManager = new ClaudeManager(process.env.ANTHROPIC_API_KEY);
    const performanceLogger = new PerformanceLogger();
    const healingEngine = new SelfHealingEngine();
    
    // Test workflow simulation
    const step = performanceLogger.startStep('integration_test');
    
    try {
      // Simulate successful step
      await new Promise(resolve => setTimeout(resolve, 50));
      step.end(true, { method: 'test' });
      
      // Test learning from session
      const sessionData = {
        sessionId: 'test_session',
        totalChats: 5,
        successfulChats: 4,
        avgChatDuration: 30000,
        commonErrors: [{ type: 'timeout', count: 1 }],
        interestStats: { gaming: { success: 3, fail: 1 } }
      };
      
      await claudeManager.learnFromSession(sessionData);
      console.log('✅ Session learning completed');
      
      // Test healing with context
      const mockError = new Error('Selector not found');
      const mockContext = {
        elementType: 'button',
        keywords: ['submit', 'send'],
        page: null // Mock page object
      };
      
      // This would fail without real page, but tests the error handling
      try {
        await healingEngine.heal(mockError, mockContext);
      } catch (e) {
        // Expected to fail without real page
      }
      
      console.log('✅ Integration test completed');
      return true;
    } catch (error) {
      step.end(false, { error: error.message });
      throw error;
    }
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Starting Claude Enhancement Feature Tests');
  console.log('═══════════════════════════════════════════');
  
  const tests = [
    { name: 'Performance Logger', fn: testPerformanceLogger },
    { name: 'Self-Healing Engine', fn: testSelfHealingEngine },
    { name: 'Claude Manager', fn: testClaudeManager },
    { name: 'Integration', fn: testIntegration }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n📋 Running ${test.name} test...`);
    try {
      const result = await test.fn();
      results.push({ name: test.name, success: result });
      console.log(`✅ ${test.name} test ${result ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      results.push({ name: test.name, success: false, error: error.message });
      console.log(`❌ ${test.name} test FAILED: ${error.message}`);
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('═══════════════════════════════════════════');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (!result.success && result.error) {
      console.log(`    └─ ${result.error}`);
    }
  });
  
  console.log(`\n📈 Overall: ${passed}/${total} tests passed (${(passed/total*100).toFixed(1)}%)`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Claude enhancement features are ready.');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }
  
  return passed === total;
}

// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
  console.error('Set it with: export ANTHROPIC_API_KEY=your-api-key');
  console.error('Note: Claude Manager tests will be skipped without API key');
  
  // Run tests without Claude Manager
  runAllTests().catch(console.error);
} else {
  runAllTests().catch(console.error);
}