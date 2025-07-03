# Claude Integration for Thundr Bot

## 🚀 Overview

This enhancement adds comprehensive Claude AI integration to your Thundr Bot project, providing:

- **🤖 Intelligent Decision Making**: Claude-powered chat responses and bot optimizations
- **📊 Performance Logging**: Detailed step-by-step logging with metrics and analytics
- **🔧 Self-Healing**: Automatic error recovery with DOM scanning and selector caching
- **📈 Continuous Learning**: Bot improves over time based on success patterns

## 🏗️ Architecture

```
src/
├── claude/
│   └── claude-manager.js          # AI-powered decision making and optimization
├── logging/
│   └── performance-logger.js      # Comprehensive logging with metrics
├── self-healing/
│   └── self-healing-engine.js     # Automatic error recovery
└── bots/
    └── claude-enhanced-thundr-bot.js  # Main enhanced bot implementation

examples/
├── claude-enhanced-bot-example.js # Complete usage example
└── test-claude-features.js        # Feature testing script
```

## 🎯 Key Features

### Claude Manager
- **Intelligent Chat Responses**: Generate contextual responses based on conversation history and interests
- **Step Analysis**: Analyze bot steps and suggest optimizations
- **Bot Optimization**: Generate configuration improvements based on performance data
- **Selector Analysis**: Suggest alternative selectors when elements fail
- **Learning System**: Learn from successful interactions and failures

### Performance Logger
- **Step-by-Step Logging**: Track every bot action with timestamps and metadata
- **Real-time Metrics**: Monitor success rates, response times, and memory usage
- **Error Pattern Detection**: Identify and categorize recurring errors
- **Performance Scoring**: Calculate performance scores for each step
- **Session Analytics**: Generate comprehensive session reports

### Self-Healing Engine
- **Automatic Recovery**: Multiple recovery strategies for different error types
- **DOM Scanning**: Intelligent element discovery when selectors fail
- **Selector Caching**: Cache working selectors with confidence scores
- **Alternative Generation**: Generate alternative selectors automatically
- **Learning from Failures**: Improve recovery strategies over time

## 🚀 Quick Start

### 1. Setup Environment Variables

```bash
# Required for Claude integration
export ANTHROPIC_API_KEY=your-claude-api-key

# Optional configuration
export HEADLESS=true
export LOG_LEVEL=info
export CHAT_MODE=video
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Test Claude Features

```bash
npm run test-claude
```

### 4. Run Enhanced Bot

```bash
npm run claude-enhanced
```

## 📖 Usage Examples

### Basic Enhanced Bot

```javascript
const ClaudeEnhancedThundrBot = require('./src/bots/claude-enhanced-thundr-bot');

const bot = new ClaudeEnhancedThundrBot({
  claudeApiKey: process.env.ANTHROPIC_API_KEY,
  useClaudeForResponses: true,
  adaptiveInterests: true,
  autoLearn: true,
  interests: ['gaming', 'technology', 'music'],
  chatMode: 'video'
});

await bot.run();
```

### Advanced Configuration

```javascript
const config = {
  // Claude Integration
  claudeApiKey: process.env.ANTHROPIC_API_KEY,
  useClaudeForResponses: true,
  claudeModel: 'claude-3-haiku-20240307',
  claudeCacheEnabled: true,
  
  // Performance Optimization
  adaptiveInterests: true,
  performanceOptimization: true,
  detailedLogging: true,
  metricsInterval: 15000,
  
  // Self-Healing
  autoLearn: true,
  domScanningEnabled: true,
  maxHealingAttempts: 3,
  
  // Bot Behavior
  interests: ['gaming', 'technology', 'music', 'movies'],
  chatMode: 'video',
  keepAlive: true,
  sessionTimeout: 30 * 60 * 1000 // 30 minutes
};

const bot = new ClaudeEnhancedThundrBot(config);
```

## 🔧 Component Usage

### Standalone Claude Manager

```javascript
const ClaudeManager = require('./src/claude/claude-manager');

const claude = new ClaudeManager(apiKey);

// Generate intelligent response
const response = await claude.generateResponse(context, userMessage);

// Analyze bot step
const analysis = await claude.analyzeStep(stepName, context, logs);

// Optimize bot configuration
const optimizations = await claude.optimizeBot(performanceLogs);
```

### Standalone Performance Logger

```javascript
const PerformanceLogger = require('./src/logging/performance-logger');

const logger = new PerformanceLogger();

// Log a step
const step = logger.startStep('test_step', { metadata: 'value' });
// ... perform step ...
step.end(success, { result: 'data' });

// Analyze performance
const analysis = logger.analyzePerformance();
```

### Standalone Self-Healing Engine

```javascript
const SelfHealingEngine = require('./src/self-healing/self-healing-engine');

const healer = new SelfHealingEngine();

// Attempt to heal from error
const result = await healer.heal(error, {
  page: page,
  elementType: 'button',
  stepName: 'click_start'
});
```

## 📊 Monitoring and Analytics

### Real-time Metrics

The enhanced bot provides real-time metrics including:
- Success rate percentage
- Average response time
- Memory usage
- Active error count
- Current step execution

### Performance Reports

Detailed reports include:
- Session duration and step counts
- Success/failure rates by step
- Most time-consuming operations
- Common error patterns
- Optimization recommendations

### Healing Statistics

Self-healing analytics show:
- Total healing attempts
- Success rates by strategy
- Cached selector count
- Most effective recovery methods

## 🎛️ NPM Scripts

```bash
# Enhanced bot execution
npm run claude-enhanced          # Run the enhanced bot
npm run test-claude             # Test all Claude features

# Monitoring and analysis
npm run performance-report      # Generate performance report
npm run healing-stats          # Show healing statistics
npm run monitor                # Start AI monitoring
npm run dashboard              # Launch monitoring dashboard

# Standard bot operations
npm start                      # Run standard bot
npm test                      # Run standard tests
npm run docker:build          # Build Docker image
```

## 🔍 Event System

The enhanced bot emits detailed events for monitoring:

```javascript
// Performance events
bot.on('metrics-updated', (metrics) => {
  console.log(`Success Rate: ${metrics.successRate}%`);
});

// Claude events
bot.claudeManager.on('response-generated', ({ response }) => {
  console.log('Claude response:', response);
});

// Healing events
bot.selfHealingEngine.on('healed', ({ strategy, result }) => {
  console.log(`Healed using: ${strategy}`);
});

// Session events
bot.on('session-completed', ({ performanceReport, healingStats }) => {
  console.log('Session completed with stats:', performanceReport);
});
```

## 🗂️ File Structure

### Cache Files
- `cache/selector-cache.json` - Cached working selectors
- `cache/learning-data.json` - Self-healing learning data

### Log Files
- `logs/claude-manager.log` - Claude API interactions
- `logs/performance.log` - Performance metrics
- `logs/self-healing.log` - Healing attempts
- `logs/session-report-{id}.json` - Session reports

### Data Files
- `data/claude-learning-data.json` - Claude learning patterns
- `data/performance-metrics.json` - Performance metrics

## 🛠️ Configuration Options

### Claude Manager Options
```javascript
{
  model: 'claude-3-haiku-20240307',  // Claude model to use
  maxTokens: 1024,                   // Max response tokens
  temperature: 0.7,                  // Response creativity
  cacheEnabled: true                 // Enable response caching
}
```

### Performance Logger Options
```javascript
{
  logDir: 'logs',                    // Log directory
  maxLogSize: 50 * 1024 * 1024,     // Max log file size
  metricsInterval: 60000,            // Metrics update interval
  detailedLogging: true              // Enable detailed logging
}
```

### Self-Healing Engine Options
```javascript
{
  cacheDir: 'cache',                 // Cache directory
  maxRetries: 3,                     // Max healing attempts
  autoLearn: true,                   // Enable learning
  domScanningEnabled: true           // Enable DOM scanning
}
```

## 🚨 Error Handling

The system provides comprehensive error handling with:

1. **Automatic Recovery**: Multiple strategies for different error types
2. **Detailed Error Reports**: Complete context and stack traces
3. **Pattern Recognition**: Identify recurring issues
4. **Proactive Fixes**: Claude suggests preventive measures

## 📈 Performance Optimization

### Adaptive Features
- **Smart Interest Selection**: Choose interests based on success rates
- **Dynamic Timeouts**: Adjust timeouts based on network conditions
- **Intelligent Delays**: Optimize delays for natural behavior
- **Selector Optimization**: Use fastest working selectors

### Learning System
- Success pattern recognition
- Failure analysis and prevention
- Configuration auto-tuning
- Performance trend tracking

## 🔒 Security and Privacy

- All Claude interactions are logged for transparency
- No sensitive data is sent to Claude API
- Local caching reduces API calls
- Error data is sanitized before analysis

## 🆘 Troubleshooting

### Common Issues

1. **Claude API Key Missing**
   ```bash
   export ANTHROPIC_API_KEY=your-key
   ```

2. **Performance Issues**
   ```bash
   npm run performance-report
   ```

3. **Healing Not Working**
   ```bash
   npm run healing-stats
   ```

4. **Test Failures**
   ```bash
   npm run test-claude
   ```

### Debug Mode

Enable detailed logging:
```bash
export LOG_LEVEL=debug
npm run claude-enhanced
```

## 🔮 Future Enhancements

- Multi-language support
- Advanced conversation modeling
- Predictive error prevention
- Custom healing strategies
- Performance benchmarking
- A/B testing framework

## 📚 API Reference

See individual component files for detailed API documentation:
- [ClaudeManager API](src/claude/claude-manager.js)
- [PerformanceLogger API](src/logging/performance-logger.js)
- [SelfHealingEngine API](src/self-healing/self-healing-engine.js)

## 🤝 Contributing

When contributing to the Claude integration:
1. Test all components with `npm run test-claude`
2. Update documentation for new features
3. Follow existing code patterns
4. Add comprehensive logging
5. Include error handling

## 📄 License

This enhancement maintains the same license as the main project (MIT).