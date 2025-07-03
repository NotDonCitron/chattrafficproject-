# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Thundr Bot** - an automated web automation platform for thundr.com (an Omegle-like video chat service). The project features both Node.js and Python implementations with AI-powered monitoring and self-healing capabilities.

## Architecture

The codebase has a hybrid architecture:
- **Primary Bot**: Node.js with Playwright (`src/bots/thundr-bot.js`)
- **Alternative Bots**: Multiple Python implementations with different optimization strategies
- **Monitoring System**: AI-powered monitoring using Anthropic Claude API (`monitoring/intelligent-monitor.js`)
- **Infrastructure**: Docker support with Redis for task queuing

Key architectural decisions:
- Event-driven architecture with EventEmitter for all bot interactions
- Stealth mode implementation to avoid detection
- Self-healing system that learns from failures and caches working selectors
- Modular design allowing easy switching between bot implementations

## Development Commands

### JavaScript Bot
```bash
npm start              # Start production bot
npm run dev           # Development mode with verbose logging
npm test              # Run test suite
npm run monitor       # Start AI monitoring system
npm run dashboard     # Launch monitoring dashboard (http://localhost:8080)
```

### Python Bots
```bash
python optimized_thundr_bot.py       # Simple, fast implementation (60-70% success)
python self_healing_thundr_bot.py    # Advanced with auto-recovery (85%+ success)
python quick_test_bot.py             # 60-second test run
python debug_bot.py                  # Debug mode with detailed logging
```

### Docker Operations
```bash
docker-compose up -d                         # Start all core services
docker-compose --profile monitoring up       # Include monitoring stack
docker-compose logs -f thundr-bot           # Follow bot logs
```

## Testing

Run tests with `npm test` which:
1. Validates browser startup and page loading
2. Tests interest selection functionality
3. Verifies chat initiation and message sending
4. Provides success rate statistics

For Python bots, use `quick_test_bot.py` for rapid validation.

## Critical Implementation Details

### Selector Strategy
The bot uses a multi-fallback selector approach due to frequent DOM changes:
1. Primary selectors defined in configuration
2. Fallback to self-healing system that discovers new selectors
3. Cached selectors stored in `cache/known_selectors.json`

### Stealth Techniques
- Custom user agent rotation
- Viewport randomization
- Human-like delays between actions
- WebGL and Canvas fingerprint spoofing
- WebRTC leak prevention

### Error Handling
- Screenshot capture on failures (stored in `screenshots/`)
- Automatic retry with exponential backoff
- Self-healing selector discovery on element not found errors
- AI monitoring for pattern detection and automatic fixes

## Environment Variables

Required for AI monitoring:
```
ANTHROPIC_API_KEY=your-key-here
```

Optional configuration:
```
HEADLESS=true/false
LOG_LEVEL=debug/info/warn/error
CHAT_MODE=video/text
INTERESTS=gaming,music,technology
```

## Bot Variants

1. **optimized_thundr_bot.py**: Best for high-volume, simple interactions
2. **self_healing_thundr_bot.py**: Best for reliability and adaptation to site changes
3. **production_thundr_bot.py**: Balanced approach for production use
4. **enhanced_thundr_bot.py**: Feature-rich with advanced chat capabilities

Choose based on your specific needs for speed vs reliability.

## Common Issues and Solutions

1. **Interest selection failing**: The self-healing bot automatically discovers new selectors
2. **Chat not starting**: Check proxy settings and ensure browser fingerprinting is enabled
3. **High failure rate**: Enable AI monitoring to identify patterns and generate fixes
4. **Docker issues**: Ensure Redis is running and accessible

## Security Considerations

- Never commit API keys (use environment variables)
- Respect platform rate limits
- Use proxies for anonymity when required
- Implement proper error handling to avoid data leaks
- Follow ethical usage guidelines

---

# Claude AI Enhanced ChatTrafficProject

> Enterprise-grade chatbot platform with AI-powered conversation management, multi-platform support, and advanced analytics

## 🎯 Enhanced Project Overview

This enhanced version transforms the basic chatbot into an intelligent, scalable, and enterprise-ready platform with **both immediate-use features and advanced enterprise capabilities**:

### 🚀 Immediate Use (Get Started Today)
- **Manual Log Analysis**: Copy-paste logs into Claude for instant insights
- **Ready-to-Use Prompts**: Pre-built prompts for common optimization tasks
- **Simple Chat Enhancement**: Generate better responses via Claude web interface
- **Basic Performance Monitoring**: Log analysis with actionable recommendations

### 🏢 Enterprise Features (Full Integration)
- **AI-Powered Conversations**: Context-aware responses using Claude API
- **Multi-Platform Support**: Thundr, Omegle, Chatroulette, EmeraldChat
- **Real-Time Monitoring**: Live dashboard with WebSocket updates
- **Enterprise Scalability**: Kubernetes deployment with auto-scaling
- **Advanced Analytics**: ML-powered conversation optimization
- **Stealth Technology**: Next-generation anti-detection systems

## 🏗️ Enhanced Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude AI     │    │  Proxy Pool     │    │  Session Mgr    │
│   Integration   │◄──►│   Manager       │◄──►│   & Recovery    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Core Bot Engine                             │
├─────────────────────────────────────────────────────────────────┤
│  Multi-Platform Adapters  │  Queue Manager  │  ML Engine       │
└─────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Real-Time      │    │  Analytics      │    │  Anti-Detection │
│  Dashboard      │    │  Engine         │    │  System         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 💡 Immediate Use Features (Start Today)

### Manual Claude Integration (No Coding Required)

#### Basic Setup
**Requirements**:
- Claude subscription (claude.ai or API access)
- Existing bot with basic logging
- 5 minutes setup time

**Installation**:
```bash
# Install basic dependencies
npm install axios winston

# Optional: Add basic logging if not present
npm install performance-now
```

#### Ready-to-Use Workflow

**1. Performance Logging** (`src/logging/performance-logger.js`):
```javascript
// Basic logging setup (if not exists)
const winston = require('winston');
const performanceLogger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/performance.log' })
  ]
});

// Log every bot step
await performanceLogger.logStep('connect_to_chat', start, end, true, { 
  details: 'Connected successfully',
  responseTime: '250ms'
});
```

**2. Manual Log Analysis**:
- Export logs from `logs/performance.log`
- Copy recent logs (last 50-100 entries)
- Paste into Claude with optimization prompts

**3. Chat Response Generation**:
- Copy conversation context
- Ask Claude for natural response suggestions
- Apply responses manually or via simple automation

#### 📋 Copy-Paste Ready Prompts

**Performance Analysis**:
```
Analyze these bot performance logs and identify optimization opportunities:

[PASTE YOUR LOGS HERE]

Focus on:
- Slowest operations and bottlenecks
- Highest error rates and failure patterns
- Resource usage inefficiencies
- Timing optimization opportunities

Provide specific, actionable recommendations.
```

**Conversation Quality**:
```
Review this chat interaction and suggest improvements:

Context: [PLATFORM] chat, [DURATION] conversation
Partner Profile: [AGE/INTERESTS if known]
Conversation Goal: [ENGAGEMENT/INFORMATION/ENTERTAINMENT]

Chat Log:
[PASTE CONVERSATION HERE]

Make suggestions to improve:
- Naturalness and human-like responses
- Engagement and interest level
- Conversation flow and timing
- Platform-specific optimization
```

**Error Troubleshooting**:
```
Help troubleshoot this recurring bot error:

Error Details:
- Error Message: [ERROR_TEXT]
- Frequency: [X] times per [TIME_PERIOD]
- Platform: [PLATFORM_NAME]
- Context: [WHEN_IT_OCCURS]
- Recent Changes: [ANY_RECENT_MODIFICATIONS]

Provide:
1. Likely root cause analysis
2. Specific fix recommendations
3. Prevention strategies
4. Monitoring improvements
```

**Configuration Optimization**:
```
Optimize bot configuration based on these performance metrics:

Current Settings:
- Platform: [PLATFORM]
- Average Session Duration: [X] minutes
- Success Rate: [X]%
- Error Rate: [X]%
- Peak Concurrent Sessions: [X]

Performance Issues:
[LIST CURRENT PROBLEMS]

Suggest specific configuration changes for:
- Timing and delays
- Retry strategies
- Resource allocation
- Session management
```

**Stealth Improvement**:
```
Improve bot stealth based on these detection patterns:

Detection Events:
[LIST RECENT DETECTIONS/BANS]

Current Stealth Measures:
[LIST CURRENT ANTI-DETECTION FEATURES]

Platform: [PLATFORM_NAME]
Bot Behavior: [DESCRIBE CURRENT BEHAVIOR]

Recommend:
1. Enhanced stealth techniques
2. Behavior pattern changes
3. Technical improvements
4. Timing adjustments
```

#### 🔄 Manual Implementation Workflow

**Daily Optimization Routine**:
1. **Morning**: Export previous day's logs → Analyze with Claude → Apply quick fixes
2. **Midday**: Check error rates → Troubleshoot issues with Claude → Implement fixes
3. **Evening**: Review conversation quality → Get improvement suggestions → Update responses

**Weekly Deep Analysis**:
1. **Monday**: Comprehensive performance review with Claude
2. **Wednesday**: Conversation quality assessment and improvement
3. **Friday**: Stealth effectiveness review and enhancement planning

#### 🏪 Simple Dashboard (Optional)

**Basic Monitoring Setup**:
```javascript
// simple-dashboard.js - Manual metrics viewing
const fs = require('fs');
const logs = fs.readFileSync('logs/performance.log', 'utf8');

// Parse and display key metrics
const metrics = {
  totalSessions: logs.split('session_start').length - 1,
  errorRate: (logs.split('error').length - 1) / totalSessions,
  avgDuration: calculateAverageDuration(logs),
  topErrors: extractTopErrors(logs)
};

console.log('Daily Metrics:', metrics);
```

**Manual Export for Claude Analysis**:
```bash
# Export recent logs for Claude analysis
tail -n 100 logs/performance.log > claude-analysis.txt
cat claude-analysis.txt
# Copy output and paste into Claude
```

### Advanced Features (Gradual Implementation)

After getting comfortable with manual integration, you can gradually implement:

1. **Automated Log Sending** → API integration
2. **Response Automation** → Direct Claude API calls
3. **Real-time Analysis** → WebSocket integration
4. **Full Enterprise Features** → Complete platform upgrade

## 🚀 Enhanced Development Commands

### Claude-Enhanced Bot
```bash
npm run claude-enhanced     # Run Claude-powered bot with AI responses
npm run test-claude        # Test all Claude AI features
npm run performance-report # Generate detailed performance metrics
npm run healing-stats      # Show self-healing statistics
```

### Multi-Platform Operations
```bash
npm run platform:thundr     # Run on Thundr platform
npm run platform:omegle     # Run on Omegle platform
npm run platform:all        # Run on all supported platforms
npm run proxy:health        # Check proxy pool health
npm run analytics:report    # Generate cross-platform analytics
```

### Enterprise Operations
```bash
kubectl apply -f k8s/       # Deploy to Kubernetes
npm run scale:up           # Scale up instances
npm run scale:down         # Scale down instances
npm run dashboard:start    # Start real-time dashboard
npm run queue:monitor      # Monitor job queues
```

## 💼 Enterprise Features Implementation

### 1. Enhanced Claude AI Integration

**Location**: `src/ai/`

**Key Components**:
- `conversation-manager.js` - Context-aware response generation
- `personality-engine.js` - Dynamic personality adaptation
- `context-memory.js` - Conversation history management
- `response-humanizer.js` - Natural typing patterns and delays

**Usage**:
```javascript
// Intelligent conversation generation
const response = await conversationManager.generateResponse({
  chatHistory: session.chatHistory,
  partnerProfile: session.partnerProfile,
  currentMood: session.mood,
  conversationGoals: session.goals,
  personalityType: session.personality
});
```

### 2. Multi-Platform Support

**Location**: `src/platforms/`

**Supported Platforms**:
- **Thundr.com** - Primary platform (existing implementation)
- **Omegle.com** - Text and video chat support
- **Chatroulette.com** - Video-focused platform
- **EmeraldChat.com** - Interest-based matching

**Platform Adapter Usage**:
```javascript
// Unified platform interface
const session = await platformAdapter.createSession('omegle', {
  chatMode: 'video',
  interests: ['gaming', 'music'],
  proxy: proxyConfig,
  stealthMode: true
});
```

### 3. Intelligent Proxy Pool Management

**Location**: `src/proxy/`

**Features**:
- Real-time proxy health monitoring
- Performance-based rotation
- Geographic load balancing
- Automatic failover and recovery
- Cost optimization algorithms

**Commands**:
```bash
npm run proxy:status       # Check proxy pool status
npm run proxy:rotate       # Force proxy rotation
npm run proxy:optimize     # Optimize proxy allocation
```

### 4. Real-Time Dashboard

**Location**: `src/dashboard/`

**Monitored Metrics**:
- Active session count and status
- Conversation success rates
- Proxy pool health and performance
- Resource utilization (CPU, memory)
- Error rates and patterns
- Response time distributions
- Platform-specific performance

**Dashboard Access**: `http://localhost:3001/dashboard`

### 5. Advanced Session Recovery

**Location**: `src/session/`

**Recovery Strategies**:
- Immediate restart for temporary issues
- Proxy switching for IP-related problems
- Platform switching for platform-specific issues
- Cooldown retry for rate limiting
- Intelligent failure pattern analysis

## 🔧 Enhanced Environment Configuration

### Core Configuration
```bash
# Enhanced Claude Integration
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_MODEL=claude-3-opus-20240229
CLAUDE_CONTEXT_WINDOW=8000
CLAUDE_PERSONALITY_MODE=adaptive

# Multi-Platform Support
PLATFORM_THUNDR_ENABLED=true
PLATFORM_OMEGLE_ENABLED=true
PLATFORM_CHATROULETTE_ENABLED=true
PLATFORM_EMERALD_ENABLED=true

# Proxy Pool Configuration
PROXY_POOL_SIZE=1000
PROXY_ROTATION_STRATEGY=performance_based
PROXY_HEALTH_CHECK_INTERVAL=60000
PROXY_GEO_TARGETING=true

# Dashboard Configuration
DASHBOARD_PORT=3001
WEBSOCKET_PORT=3002
DASHBOARD_AUTH_REQUIRED=true

# Queue Management
QUEUE_CONCURRENCY_HIGH=50
QUEUE_CONCURRENCY_NORMAL=100
QUEUE_CONCURRENCY_LOW=200
QUEUE_RETRY_ATTEMPTS=3

# Analytics Configuration
ANALYTICS_RETENTION_DAYS=90
ANALYTICS_AGGREGATION_INTERVAL=3600000
ANALYTICS_ML_ENABLED=true

# Security
ENCRYPTION_KEY=your_encryption_key
JWT_SECRET=your_jwt_secret
STEALTH_MODE_ADVANCED=true
```

## 📊 Enhanced Performance Targets

### Scalability Metrics
- **Concurrent Sessions**: 1,000+ per instance
- **Response Time**: <2 seconds average
- **Uptime**: 99.9% availability
- **Auto-Scaling**: 2-100 instances based on load

### Quality Metrics
- **Conversation Success Rate**: >90%
- **Human-like Behavior Score**: >95%
- **Detection Avoidance**: >99%
- **Platform Coverage**: 4+ major platforms

### Operational Metrics
- **Cost Efficiency**: 50% reduction vs manual
- **Recovery Time**: <30 seconds for failures
- **Queue Processing**: 10,000+ jobs/hour
- **Analytics Latency**: Real-time (<5 seconds)

## 🚀 Enhanced Implementation Structure

### Project Structure
```
chattrafficproject/
├── src/
│   ├── ai/                     # Claude AI integration
│   │   ├── conversation-manager.js
│   │   ├── personality-engine.js
│   │   ├── context-memory.js
│   │   └── response-humanizer.js
│   ├── platforms/              # Multi-platform support
│   │   ├── platform-adapter.js
│   │   ├── thundr-adapter.js
│   │   ├── omegle-adapter.js
│   │   └── chatroulette-adapter.js
│   ├── proxy/                  # Enhanced proxy management
│   │   ├── proxy-pool-manager.js
│   │   ├── proxy-health-monitor.js
│   │   └── geo-targeting-service.js
│   ├── dashboard/              # Real-time dashboard
│   │   ├── websocket-server.js
│   │   ├── metrics-collector.js
│   │   └── dashboard-api.js
│   ├── session/                # Advanced session management
│   │   ├── session-manager.js
│   │   ├── recovery-engine.js
│   │   └── state-persistence.js
│   ├── ml/                     # Machine learning
│   │   ├── conversation-predictor.js
│   │   ├── optimization-engine.js
│   │   └── anomaly-detector.js
│   ├── quality/                # Quality engine
│   │   ├── conversation-quality-engine.js
│   │   ├── engagement-tracker.js
│   │   └── sentiment-analyzer.js
│   ├── stealth/                # Advanced anti-detection
│   │   ├── advanced-stealth-engine.js
│   │   ├── fingerprint-defense.js
│   │   └── behavior-mimicry.js
│   ├── queue/                  # Enhanced queue management
│   │   ├── advanced-queue-manager.js
│   │   ├── job-processor.js
│   │   └── scheduler.js
│   └── analytics/              # Analytics engine
│       ├── cross-platform-analytics.js
│       ├── performance-analyzer.js
│       └── predictive-engine.js
├── k8s/                        # Kubernetes configs
│   ├── deployment.yaml
│   ├── hpa.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── examples/                   # Enhanced examples
    ├── claude-enhanced-bot-example.js
    ├── multi-platform-example.js
    ├── enterprise-deployment-example.js
    └── analytics-dashboard-example.js
```

## 🔄 Enhanced Monitoring & Alerts

### Key Alerts
- Session failure rate >5%
- Proxy health score <80%
- Queue processing delays >60s
- Resource utilization >85%
- Conversation quality score <70%
- Platform-specific anomalies detected
- Security threats identified

### Dashboard Views
- **Operations**: Live sessions, success rates, errors
- **Performance**: Response times, resource usage
- **Quality**: Conversation scores, improvement trends
- **Infrastructure**: Kubernetes metrics, scaling events
- **Business**: ROI, cost analysis, platform comparison
- **Security**: Threat detection, stealth effectiveness

## 🎯 Success Metrics & KPIs

### Technical KPIs
- **System Reliability**: 99.9% uptime
- **Performance**: <2s response time
- **Scalability**: Handle 10x load spikes
- **Quality**: >90% human-like conversations
- **Multi-Platform Coverage**: 100% of target platforms

### Business KPIs
- **Efficiency**: 80% automation of chat tasks
- **Cost Savings**: 60% reduction in operational costs
- **Platform Diversification**: Risk reduction through multi-platform support
- **User Satisfaction**: >4.5/5 rating
- **Market Coverage**: Expanded reach across platforms

This comprehensive enhancement transforms your chatbot into an enterprise-grade, AI-powered platform capable of handling massive scale while maintaining high-quality, human-like conversations across multiple platforms.

## 🎯 Best Practices & Implementation Guidelines

### Manual Integration Best Practices

**Logging Strategy**:
- **Log Everything**: More data = better AI insights and recommendations
- **Include Context**: Add metadata like user type, session duration, system load
- **Structured Format**: Use consistent JSON formatting for easier analysis
- **Regular Export**: Set up daily/weekly log exports for Claude analysis

**Claude Interaction Guidelines**:
- **Be Specific**: Clear, actionable requests get better results
- **Provide Context**: Include relevant background information and current goals
- **Ask for Examples**: Request specific code/config changes rather than general advice
- **Iterate and Refine**: Use Claude's feedback to improve your prompts

**Implementation Approach**:
- **Start Small**: Begin with manual log analysis before automating
- **Test Changes**: Validate Claude suggestions in controlled environments
- **Document Results**: Track what works and what doesn't for future reference
- **Gradual Automation**: Move from manual to semi-automated to fully automated

**Performance Monitoring**:
- **Daily Reviews**: Quick 5-minute log analysis for immediate issues
- **Weekly Deep Dives**: Comprehensive performance and quality analysis
- **Monthly Optimization**: Strategic improvements based on accumulated insights
- **Quarterly Architecture Review**: Evaluate need for enterprise features

### Integration Roadmap

**Phase 1: Manual Integration (Week 1)**
1. Set up basic logging infrastructure
2. Create daily log analysis routine
3. Implement ready-to-use prompts
4. Start manual response improvement

**Phase 2: Semi-Automation (Week 2-4)**
1. Add basic API integration for log sending
2. Implement simple response automation
3. Create basic dashboard for metrics
4. Set up automated daily reports

**Phase 3: Advanced Features (Month 2-3)**
1. Real-time Claude integration
2. Advanced self-healing capabilities
3. Multi-platform support
4. Performance optimization engine

**Phase 4: Enterprise Scale (Month 4+)**
1. Full Kubernetes deployment
2. Advanced analytics and ML
3. Complete platform coverage
4. Enterprise monitoring and alerting

### Security and Compliance

**Data Handling**:
- Never send sensitive personal information to Claude
- Sanitize logs before analysis (remove IPs, personal data)
- Use environment variables for all API keys
- Implement proper access controls for logs and analytics

**Platform Compliance**:
- Respect platform terms of service
- Implement rate limiting and respectful usage
- Monitor for detection patterns and adapt quickly
- Maintain ethical usage guidelines

**Operational Security**:
- Regular security audits of integrations
- Secure storage of logs and analytics data
- Encrypted communication channels
- Regular backup and recovery testing

### Troubleshooting Guide

**Common Issues**:
1. **High Error Rates**: Use error troubleshooting prompt with detailed context
2. **Poor Conversation Quality**: Implement conversation quality analysis routine
3. **Detection/Bans**: Focus on stealth improvement prompts and behavior analysis
4. **Performance Issues**: Regular performance analysis and optimization cycles

**Emergency Procedures**:
1. **System Down**: Quick diagnostic checklist and recovery procedures
2. **Mass Detection**: Immediate stealth review and adaptation protocol
3. **Performance Degradation**: Rapid analysis and rollback procedures
4. **Security Breach**: Incident response and damage assessment

This enhanced platform provides both immediate value through manual Claude integration and a clear path to enterprise-scale automation, allowing you to start benefiting from AI assistance today while building toward a fully integrated solution.