# 🤖 Ultra-Intelligent Bot Monitoring System

## Overview
This advanced monitoring system uses **Anthropic Claude AI** to watch your bot in real-time, detect failure patterns, and automatically generate fixes for common issues.

## 🎯 Key Features

### Real-Time Analysis
- **Live log monitoring** with pattern detection
- **AI-powered error analysis** using Claude API
- **Automatic fix generation** for common failures
- **Performance tracking** and success rate monitoring

### Intelligence Capabilities
- 🎯 **Interest Selection Failures**: Detects when interests aren't found and generates new selectors
- ⏰ **Chat Timeout Optimization**: Analyzes timeout patterns and suggests improvements  
- 🔄 **Browser Restart Management**: Tracks restart frequency and optimizes stability
- 📊 **Session Performance Analysis**: Deep analysis of bot effectiveness

### Auto-Healing Features
- **Dynamic selector updates** based on AI analysis
- **Automatic retry strategies** for failed operations
- **Profile optimization suggestions** to improve chat success
- **Real-time code improvements** without manual intervention

## 🚀 Quick Start

### Method 1: Windows Batch File
```bash
# Double-click to run
monitor.bat
```

### Method 2: NPM Scripts
```bash
# Start monitoring
npm run monitor

# Start with dashboard
npm run dashboard
```

### Method 3: Direct Node.js
```bash
# Start the monitor
node monitoring/start-monitor.js

# View dashboard
python -m http.server 8080 --directory monitoring
# Then open: http://localhost:8080/dashboard.html
```

## 📊 Monitoring Dashboard

The dashboard provides real-time visualization of:

- **Current Session Status**: Active session number and uptime
- **Success Metrics**: Interest selection and chat success rates
- **Error Tracking**: Detailed breakdown of failure types
- **AI Analysis**: Live insights and recommendations
- **Live Logs**: Real-time bot activity with color coding

## 🧠 AI Analysis Examples

### Interest Selection Failures
When interests fail to select, Claude analyzes:
```json
{
  "rootCause": "Chakra UI dynamic selectors changed",
  "alternativeSelectors": [
    "div[role='option']:contains('Photography')",
    "[data-testid='interest-option'][data-value='photography']",
    ".css-xyz[aria-label*='Photography']"
  ],
  "strategies": ["Use xpath selectors", "Wait for elements", "Fallback methods"]
}
```

### Chat Timeout Analysis
For repeated timeouts, Claude suggests:
```json
{
  "rootCause": "Peak hours + unattractive profile combination",
  "profileOptimizations": ["Change age range", "Update interests", "Different gender"],
  "timingStrategies": ["Avoid peak hours", "Use multiple regions", "Stagger sessions"]
}
```

## 🔧 Configuration Files

### Generated Configurations
- `config/dynamic-selectors.json`: AI-generated selector updates
- `logs/monitor.log`: Detailed monitoring logs
- `logs/deep-analysis-*.json`: Comprehensive failure analyses

### Customization
Edit `monitoring/intelligent-monitor.js` to:
- Adjust error detection patterns
- Modify healing strategies
- Add new failure types
- Customize Claude prompts

## 📋 Error Patterns Detected

1. **Interest Selection**: `⚠ Photography nicht gefunden`
2. **Chat Timeouts**: `⚠ Kein Chat-Partner nach 90 Sekunden`
3. **Browser Crashes**: `Browser wird geschlossen für Neustart`
4. **Selector Failures**: `✗ Button nicht gefunden`
5. **Session Errors**: `⚠️ Session beendet (Neustart nötig)`

## 🎯 Success Metrics

The system tracks:
- **Interest Selection Rate**: Successful vs failed interests
- **Chat Connection Rate**: Successful chat establishments
- **Session Stability**: Average session duration
- **Overall Success Rate**: Combined effectiveness score

## 🛠️ Troubleshooting

### Common Issues
1. **API Key Invalid**: Check Anthropic API key in `start-monitor.js`
2. **Logs Not Appearing**: Ensure `logs/` directory exists
3. **Claude API Errors**: Verify API quota and permissions
4. **Bot Not Detected**: Ensure `enhanced_thundr_bot.py` is in root directory

### Debug Mode
```bash
node monitoring/start-monitor.js --debug
```

## 📊 Performance Impact

- **Memory Usage**: ~50MB additional
- **CPU Impact**: <5% during analysis
- **API Calls**: ~10-20 calls per session (only on failures)
- **Storage**: ~1MB per day of logs

## 🔮 Future Enhancements

Planned features:
- **Multi-bot orchestration**: Monitor multiple bots simultaneously
- **Predictive failure detection**: Prevent issues before they occur
- **Auto-deployment**: Update bot code automatically
- **Advanced analytics**: Machine learning pattern recognition
- **Slack/Discord notifications**: Real-time alerts

## 🎯 Architecture

```
Bot Process (Python) → Monitor (Node.js) → Claude AI → Auto-Fix → Updated Bot
                    ↓
                Dashboard (HTML) ← Real-time Updates ← Status Tracking
```

The monitoring system is completely **non-invasive** - it watches your existing bot without modifying its core functionality, only providing intelligence and auto-healing capabilities on top. 