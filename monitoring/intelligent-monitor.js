const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const winston = require('winston');

class IntelligentBotMonitor {
    constructor(anthropicApiKey) {
        this.anthropicApiKey = anthropicApiKey;
        this.anthropicClient = axios.create({
            baseURL: 'https://api.anthropic.com/v1',
            headers: {
                'x-api-key': anthropicApiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        });
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/monitor.log' }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });

        // Error pattern detection
        this.errorPatterns = {
            interestNotFound: /⚠ (.+) nicht gefunden/g,
            chatTimeout: /⚠ Kein Chat-Partner nach (\d+) Sekunden gefunden/,
            browserRestart: /Browser wird geschlossen für Neustart/,
            selectorFailed: /✗ (.+) Button nicht gefunden/,
            sessionEnded: /⚠️ Session (\d+) beendet \(Neustart nötig\)/
        };

        // Real-time monitoring data
        this.currentSession = {
            sessionNumber: 0,
            startTime: null,
            errors: [],
            screenshots: [],
            interestFailures: [],
            chatAttempts: 0
        };

        // Auto-healing strategies
        this.healingStrategies = new Map();
        this.failureCount = new Map();
        
        this.initializeHealingStrategies();
    }

    initializeHealingStrategies() {
        this.healingStrategies.set('interestSelection', [
            'updateInterestSelectors',
            'tryAlternativeInterestMethod',
            'skipInterestSelection',
            'useManualInterestClicks'
        ]);

        this.healingStrategies.set('chatTimeout', [
            'increaseWaitTime',
            'changeUserProfile',
            'restartBrowserSession',
            'useAlternativeRegion'
        ]);

        this.healingStrategies.set('selectorFailure', [
            'regenerateSelectors',
            'useAiSelectorAnalysis',
            'captureNewDom',
            'fallbackSelectors'
        ]);
    }

    async startMonitoring(botScript = 'enhanced_thundr_bot.py') {
        this.logger.info('🚀 Starting Intelligent Bot Monitoring...');
        this.logger.info(`📊 Using Anthropic API for AI analysis`);
        
        const botProcess = spawn('python', [botScript], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Real-time log analysis
        botProcess.stdout.on('data', async (data) => {
            const logLine = data.toString().trim();
            if (logLine) {
                await this.processLogLine(logLine);
            }
        });

        botProcess.stderr.on('data', async (data) => {
            const errorLine = data.toString().trim();
            if (errorLine) {
                this.logger.error(`Python Error: ${errorLine}`);
                await this.handleCriticalError(errorLine);
            }
        });

        botProcess.on('close', async (code) => {
            this.logger.info(`Bot process ended with code: ${code}`);
            if (code !== 0) {
                await this.handleProcessCrash(code);
            }
        });

        return botProcess;
    }

    async processLogLine(logLine) {
        console.log(`📋 ${logLine}`); // Real-time display

        // Detect session start
        if (logLine.includes('STARTE BOT-SESSION')) {
            const sessionMatch = logLine.match(/SESSION (\d+)\/\d+/);
            if (sessionMatch) {
                this.currentSession.sessionNumber = parseInt(sessionMatch[1]);
                this.currentSession.startTime = new Date();
                this.currentSession.errors = [];
                this.logger.info(`🔄 Session ${this.currentSession.sessionNumber} started`);
            }
        }

        // Detect and handle specific error patterns
        await this.detectAndHandleErrors(logLine);

        // Monitor success patterns for learning
        await this.detectSuccessPatterns(logLine);
    }

    async detectAndHandleErrors(logLine) {
        // Interest selection failures
        const interestMatch = logLine.match(this.errorPatterns.interestNotFound);
        if (interestMatch) {
            for (const match of interestMatch) {
                const interest = match.replace('⚠ ', '').replace(' nicht gefunden', '');
                this.currentSession.interestFailures.push(interest);
                await this.handleInterestFailure(interest);
            }
        }

        // Chat timeout
        if (this.errorPatterns.chatTimeout.test(logLine)) {
            const timeoutMatch = logLine.match(/(\d+) Sekunden/);
            const timeout = timeoutMatch ? parseInt(timeoutMatch[1]) : 90;
            await this.handleChatTimeout(timeout);
        }

        // Browser restart
        if (this.errorPatterns.browserRestart.test(logLine)) {
            await this.handleBrowserRestart();
        }

        // Session ended
        const sessionEndMatch = logLine.match(this.errorPatterns.sessionEnded);
        if (sessionEndMatch) {
            const sessionNum = parseInt(sessionEndMatch[1]);
            await this.handleSessionEnded(sessionNum);
        }
    }

    async handleInterestFailure(interest) {
        this.logger.warn(`🎯 Interest failure detected: ${interest}`);
        
        // Track failure frequency
        const failureKey = `interest_${interest}`;
        this.failureCount.set(failureKey, (this.failureCount.get(failureKey) || 0) + 1);

        // If this interest fails repeatedly, analyze with Claude
        if (this.failureCount.get(failureKey) >= 3) {
            await this.analyzeRepeatedFailure('interestSelection', {
                interest: interest,
                failureCount: this.failureCount.get(failureKey),
                sessionNumber: this.currentSession.sessionNumber
            });
        }
    }

    async handleChatTimeout(timeout) {
        this.logger.warn(`⏰ Chat timeout detected: ${timeout}s`);
        this.currentSession.chatAttempts++;

        // If multiple timeouts in session, trigger analysis
        if (this.currentSession.chatAttempts >= 2) {
            await this.analyzeRepeatedFailure('chatTimeout', {
                timeout: timeout,
                attempts: this.currentSession.chatAttempts,
                sessionNumber: this.currentSession.sessionNumber
            });
        }
    }

    async handleBrowserRestart() {
        this.logger.warn(`🔄 Browser restart detected`);
        
        // Analyze session performance before restart
        await this.analyzeSessionPerformance();
    }

    async analyzeRepeatedFailure(failureType, context) {
        this.logger.info(`🧠 Analyzing repeated failure: ${failureType}`);

        try {
            const analysis = await this.getClaudeAnalysis(failureType, context);
            const fixes = await this.generateFixes(failureType, analysis);
            
            this.logger.info(`🔧 Generated ${fixes.length} potential fixes`);
            
            // Apply the best fix
            if (fixes.length > 0) {
                await this.applyFix(fixes[0]);
            }

        } catch (error) {
            this.logger.error(`❌ Failed to analyze with Claude: ${error.message}`);
        }
    }

    async getClaudeAnalysis(failureType, context) {
        const prompt = this.buildAnalysisPrompt(failureType, context);
        
        try {
            const response = await this.anthropicClient.post('/messages', {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            return response.data.content[0].text;
        } catch (error) {
            this.logger.error(`Claude API Error: ${error.response?.data || error.message}`);
            throw error;
        }
    }

    buildAnalysisPrompt(failureType, context) {
        const baseContext = `
You are analyzing a Thundr.com video chat bot that's experiencing repeated failures.

Current Failure Type: ${failureType}
Context: ${JSON.stringify(context, null, 2)}

Recent Session Data:
- Session Number: ${this.currentSession.sessionNumber}
- Interest Failures: ${this.currentSession.interestFailures.join(', ')}
- Chat Attempts: ${this.currentSession.chatAttempts}
- Total Errors: ${this.currentSession.errors.length}
`;

        switch (failureType) {
            case 'interestSelection':
                return baseContext + `
The bot is failing to select interests on Thundr.com. Currently using these selectors:
- li[role="option"]:has-text("{interest}")
- [role="option"]:has-text("{interest}")
- .chakra-menu__menuitem:has-text("{interest}")

The interest "${context.interest}" has failed ${context.failureCount} times.

Please analyze why this might be failing and suggest:
1. Root cause of the failure
2. Alternative CSS selectors to try
3. Different approach strategies
4. Specific code changes needed

Respond with a JSON object containing: rootCause, alternativeSelectors[], strategies[], codeChanges[]`;

            case 'chatTimeout':
                return baseContext + `
The bot is experiencing chat timeouts after ${context.timeout} seconds. This has happened ${context.attempts} times in this session.

Possible causes:
- Region/server issues
- User profile attractiveness
- Peak/off-peak timing
- Technical connection issues

Please analyze and suggest:
1. Why timeouts might be occurring
2. Profile optimization strategies  
3. Timing/retry strategies
4. Technical fixes

Respond with a JSON object containing: rootCause, profileOptimizations[], timingStrategies[], technicalFixes[]`;

            default:
                return baseContext + `
Analyze this general failure pattern and provide recommendations.
Respond with a JSON object containing: rootCause, recommendations[], immediateActions[]`;
        }
    }

    async generateFixes(failureType, analysisResult) {
        this.logger.info(`🔧 Generating fixes based on Claude analysis`);
        
        try {
            const analysis = JSON.parse(analysisResult);
            const fixes = [];

            switch (failureType) {
                case 'interestSelection':
                    if (analysis.alternativeSelectors) {
                        fixes.push({
                            type: 'selectorUpdate',
                            priority: 1,
                            selectors: analysis.alternativeSelectors,
                            implementation: 'updateInterestSelectors'
                        });
                    }
                    break;

                case 'chatTimeout':
                    if (analysis.timingStrategies) {
                        fixes.push({
                            type: 'timingOptimization',
                            priority: 1,
                            strategies: analysis.timingStrategies,
                            implementation: 'updateWaitStrategy'
                        });
                    }
                    break;
            }

            return fixes;
        } catch (error) {
            this.logger.error(`Failed to parse Claude analysis: ${error.message}`);
            return [];
        }
    }

    async applyFix(fix) {
        this.logger.info(`🔧 Applying fix: ${fix.type}`);
        
        switch (fix.implementation) {
            case 'updateInterestSelectors':
                await this.updateInterestSelectors(fix.selectors);
                break;
            case 'updateWaitStrategy':
                await this.updateWaitStrategy(fix.strategies);
                break;
            default:
                this.logger.warn(`Unknown fix implementation: ${fix.implementation}`);
        }
    }

    async updateInterestSelectors(newSelectors) {
        this.logger.info(`🔄 Updating interest selectors`);
        
        // Create a new selector configuration
        const selectorConfig = {
            timestamp: new Date().toISOString(),
            selectors: newSelectors,
            reason: 'AI-generated fix for interest selection failures'
        };

        // Ensure config directory exists
        const configDir = path.join('config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Save to configuration file
        const configPath = path.join('config', 'dynamic-selectors.json');
        fs.writeFileSync(configPath, JSON.stringify(selectorConfig, null, 2));
        
        this.logger.info(`✅ Updated selectors saved to ${configPath}`);
    }

    async analyzeSessionPerformance() {
        const sessionSummary = {
            sessionNumber: this.currentSession.sessionNumber,
            duration: new Date() - this.currentSession.startTime,
            totalErrors: this.currentSession.errors.length,
            interestFailures: this.currentSession.interestFailures.length,
            chatAttempts: this.currentSession.chatAttempts,
            successRate: this.calculateSuccessRate()
        };

        this.logger.info(`📊 Session ${sessionSummary.sessionNumber} Performance:`, sessionSummary);

        // If performance is consistently poor, trigger deep analysis
        if (sessionSummary.successRate < 30) {
            await this.triggerDeepAnalysis(sessionSummary);
        }
    }

    async triggerDeepAnalysis(sessionSummary) {
        this.logger.warn(`🔍 Triggering deep analysis for poor performance`);
        
        const prompt = `
Analyze this poorly performing bot session:

${JSON.stringify(sessionSummary, null, 2)}

The bot is consistently failing. Please provide:
1. Strategic recommendations for improvement
2. Fundamental issues that need addressing  
3. Alternative approaches to consider
4. Emergency fallback strategies

Respond with detailed analysis and actionable recommendations.`;

        try {
            const analysis = await this.getClaudeAnalysis('deepAnalysis', sessionSummary);
            this.logger.info(`🧠 Deep Analysis Result: ${analysis}`);
            
            // Save analysis for review
            const analysisPath = path.join('logs', `deep-analysis-${Date.now()}.json`);
            fs.writeFileSync(analysisPath, JSON.stringify({
                timestamp: new Date().toISOString(),
                sessionSummary,
                analysis
            }, null, 2));

        } catch (error) {
            this.logger.error(`Failed deep analysis: ${error.message}`);
        }
    }

    calculateSuccessRate() {
        // Simple success rate calculation based on current metrics
        const totalAttempts = this.currentSession.interestFailures.length + this.currentSession.chatAttempts;
        const errors = this.currentSession.errors.length;
        
        if (totalAttempts === 0) return 100;
        return Math.max(0, ((totalAttempts - errors) / totalAttempts) * 100);
    }

    async detectSuccessPatterns(logLine) {
        // Track successful operations for learning
        if (logLine.includes('✓')) {
            const successMatch = logLine.match(/✓ (.+)/);
            if (successMatch) {
                this.logger.debug(`✅ Success detected: ${successMatch[1]}`);
            }
        }
    }

    async handleCriticalError(errorLine) {
        this.logger.error(`🚨 Critical Error: ${errorLine}`);
        this.currentSession.errors.push({
            timestamp: new Date(),
            error: errorLine,
            type: 'critical'
        });
    }

    async handleProcessCrash(exitCode) {
        this.logger.error(`💥 Bot process crashed with exit code: ${exitCode}`);
        
        // Immediate restart strategy
        setTimeout(() => {
            this.logger.info(`🔄 Attempting to restart bot...`);
            this.startMonitoring();
        }, 5000);
    }

    // Dashboard-style status reporting
    getStatus() {
        return {
            currentSession: this.currentSession.sessionNumber,
            uptime: this.currentSession.startTime ? new Date() - this.currentSession.startTime : 0,
            totalErrors: this.currentSession.errors.length,
            successRate: this.calculateSuccessRate(),
            lastActivity: new Date(),
            monitoring: true
        };
    }
}

module.exports = IntelligentBotMonitor; 