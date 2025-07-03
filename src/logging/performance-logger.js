const winston = require('winston');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Performance Logger - Comprehensive logging with metrics tracking
 */
class PerformanceLogger extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      logDir: config.logDir || 'logs',
      metricsFile: config.metricsFile || 'performance-metrics.json',
      maxLogSize: config.maxLogSize || 50 * 1024 * 1024, // 50MB
      metricsInterval: config.metricsInterval || 60000, // 1 minute
      detailedLogging: config.detailedLogging ?? true,
      ...config
    };
    
    // Ensure log directory exists
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
    
    // Step tracking
    this.stepLogs = [];
    this.sessionMetrics = {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      endTime: null,
      totalSteps: 0,
      successfulSteps: 0,
      failedSteps: 0,
      stepDurations: {},
      errorPatterns: new Map(),
      performanceScores: {}
    };
    
    // Real-time metrics
    this.realtimeMetrics = {
      currentStep: null,
      avgResponseTime: 0,
      successRate: 0,
      activeErrors: [],
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(this.config.logDir, 'performance.log'),
          maxsize: this.config.maxLogSize,
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: path.join(this.config.logDir, 'errors.log'),
          level: 'error',
          maxsize: this.config.maxLogSize,
          maxFiles: 3
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          )
        })
      ]
    });
    
    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Log a step execution with detailed metrics
   */
  logStep(stepName, startTime, endTime, success, metadata = {}) {
    const duration = endTime - startTime;
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      sessionId: this.sessionMetrics.sessionId,
      stepName,
      duration,
      success,
      metadata,
      sequenceNumber: this.stepLogs.length + 1,
      memoryUsage: process.memoryUsage(),
      performanceScore: this.calculateStepPerformance(duration, success, stepName)
    };
    
    // Add to step logs
    this.stepLogs.push(logEntry);
    
    // Update session metrics
    this.updateMetrics(stepName, duration, success, metadata);
    
    // Log based on success
    if (success) {
      this.logger.info(`Step completed: ${stepName}`, {
        duration: `${duration}ms`,
        ...metadata
      });
    } else {
      this.logger.error(`Step failed: ${stepName}`, {
        duration: `${duration}ms`,
        error: metadata.error || 'Unknown error',
        ...metadata
      });
    }
    
    // Emit real-time event
    this.emit('step-logged', logEntry);
    
    // Check if we need to save metrics
    if (this.stepLogs.length % 10 === 0) {
      this.saveMetrics();
    }
    
    return logEntry;
  }

  /**
   * Log with context and automatic categorization
   */
  log(level, message, context = {}) {
    const enhancedContext = {
      ...context,
      sessionId: this.sessionMetrics.sessionId,
      currentStep: this.realtimeMetrics.currentStep,
      timestamp: new Date().toISOString()
    };
    
    this.logger[level](message, enhancedContext);
    
    // Track error patterns
    if (level === 'error') {
      this.trackErrorPattern(message, context);
    }
  }

  /**
   * Start tracking a new step
   */
  startStep(stepName, metadata = {}) {
    const startTime = performance.now();
    
    this.realtimeMetrics.currentStep = stepName;
    
    this.log('info', `Starting step: ${stepName}`, metadata);
    
    // Return a function to end the step
    return {
      end: (success = true, endMetadata = {}) => {
        const endTime = performance.now();
        return this.logStep(
          stepName,
          startTime,
          endTime,
          success,
          { ...metadata, ...endMetadata }
        );
      },
      addMetadata: (additionalMetadata) => {
        Object.assign(metadata, additionalMetadata);
      }
    };
  }

  /**
   * Update session metrics
   */
  updateMetrics(stepName, duration, success, metadata) {
    this.sessionMetrics.totalSteps++;
    
    if (success) {
      this.sessionMetrics.successfulSteps++;
    } else {
      this.sessionMetrics.failedSteps++;
    }
    
    // Track step durations
    if (!this.sessionMetrics.stepDurations[stepName]) {
      this.sessionMetrics.stepDurations[stepName] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        successCount: 0,
        failCount: 0
      };
    }
    
    const stepMetric = this.sessionMetrics.stepDurations[stepName];
    stepMetric.count++;
    stepMetric.totalDuration += duration;
    stepMetric.avgDuration = stepMetric.totalDuration / stepMetric.count;
    stepMetric.minDuration = Math.min(stepMetric.minDuration, duration);
    stepMetric.maxDuration = Math.max(stepMetric.maxDuration, duration);
    
    if (success) {
      stepMetric.successCount++;
    } else {
      stepMetric.failCount++;
    }
    
    // Update real-time metrics
    this.updateRealtimeMetrics();
  }

  /**
   * Track error patterns for analysis
   */
  trackErrorPattern(errorMessage, context) {
    const errorKey = this.categorizeError(errorMessage);
    
    if (!this.sessionMetrics.errorPatterns.has(errorKey)) {
      this.sessionMetrics.errorPatterns.set(errorKey, {
        count: 0,
        firstOccurrence: new Date(),
        lastOccurrence: null,
        contexts: []
      });
    }
    
    const errorPattern = this.sessionMetrics.errorPatterns.get(errorKey);
    errorPattern.count++;
    errorPattern.lastOccurrence = new Date();
    errorPattern.contexts.push({
      timestamp: new Date(),
      context: context,
      message: errorMessage
    });
    
    // Keep only last 10 contexts
    if (errorPattern.contexts.length > 10) {
      errorPattern.contexts = errorPattern.contexts.slice(-10);
    }
    
    // Add to active errors
    this.realtimeMetrics.activeErrors = Array.from(this.sessionMetrics.errorPatterns.entries())
      .map(([key, value]) => ({
        type: key,
        count: value.count,
        lastOccurrence: value.lastOccurrence
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Categorize error messages
   */
  categorizeError(errorMessage) {
    const patterns = {
      'selector_not_found': /selector|element.*not.*found/i,
      'timeout': /timeout|timed out/i,
      'network': /network|connection|fetch/i,
      'chat_partner': /partner|stranger|chat.*not.*found/i,
      'interest_selection': /interest|tag.*not.*found/i,
      'browser_crash': /crash|browser.*closed/i,
      'permission': /permission|denied|blocked/i
    };
    
    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(errorMessage)) {
        return category;
      }
    }
    
    return 'unknown';
  }

  /**
   * Calculate step performance score
   */
  calculateStepPerformance(duration, success, stepName) {
    let score = success ? 100 : 0;
    
    // Adjust score based on duration
    const expectedDurations = {
      'browser_start': 5000,
      'page_load': 3000,
      'interest_selection': 2000,
      'chat_start': 3000,
      'message_send': 1000,
      'wait_for_partner': 10000
    };
    
    const expected = expectedDurations[stepName] || 2000;
    const performanceRatio = expected / duration;
    
    if (success) {
      if (performanceRatio > 1.5) {
        score = 110; // Excellent performance
      } else if (performanceRatio > 1) {
        score = 100; // Good performance
      } else if (performanceRatio > 0.5) {
        score = 80; // Acceptable performance
      } else {
        score = 60; // Poor performance
      }
    }
    
    return score;
  }

  /**
   * Update real-time metrics
   */
  updateRealtimeMetrics() {
    const { totalSteps, successfulSteps } = this.sessionMetrics;
    
    this.realtimeMetrics.successRate = totalSteps > 0 
      ? (successfulSteps / totalSteps * 100).toFixed(2)
      : 0;
    
    // Calculate average response time
    const allDurations = this.stepLogs.map(log => log.duration);
    this.realtimeMetrics.avgResponseTime = allDurations.length > 0
      ? (allDurations.reduce((a, b) => a + b, 0) / allDurations.length).toFixed(2)
      : 0;
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.realtimeMetrics.memoryUsage = (memUsage.heapUsed / 1024 / 1024).toFixed(2); // MB
    
    // Emit metrics update
    this.emit('metrics-updated', this.realtimeMetrics);
  }

  /**
   * Analyze performance and generate insights
   */
  analyzePerformance() {
    const analysis = {
      sessionId: this.sessionMetrics.sessionId,
      duration: this.sessionMetrics.endTime 
        ? this.sessionMetrics.endTime - this.sessionMetrics.startTime
        : Date.now() - this.sessionMetrics.startTime,
      summary: {
        totalSteps: this.sessionMetrics.totalSteps,
        successRate: `${(this.sessionMetrics.successfulSteps / this.sessionMetrics.totalSteps * 100).toFixed(2)}%`,
        avgStepDuration: this.calculateAverageStepDuration(),
        mostFailedStep: this.getMostFailedStep(),
        mostTimeConsumingStep: this.getMostTimeConsumingStep(),
        errorPatterns: this.getTopErrorPatterns()
      },
      recommendations: this.generateRecommendations(),
      detailedMetrics: this.sessionMetrics.stepDurations
    };
    
    this.emit('performance-analyzed', analysis);
    return analysis;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check success rate
    const successRate = this.sessionMetrics.successfulSteps / this.sessionMetrics.totalSteps;
    if (successRate < 0.7) {
      recommendations.push({
        type: 'critical',
        message: 'Low success rate detected. Consider reviewing error logs and implementing better error handling.'
      });
    }
    
    // Check for slow steps
    Object.entries(this.sessionMetrics.stepDurations).forEach(([step, metrics]) => {
      if (metrics.avgDuration > 5000) {
        recommendations.push({
          type: 'performance',
          message: `Step "${step}" is taking too long (avg: ${metrics.avgDuration.toFixed(0)}ms). Consider optimization.`
        });
      }
    });
    
    // Check error patterns
    const topErrors = this.getTopErrorPatterns();
    if (topErrors.length > 0 && topErrors[0].count > 5) {
      recommendations.push({
        type: 'reliability',
        message: `Frequent error type: "${topErrors[0].type}" (${topErrors[0].count} occurrences). Implement specific handling.`
      });
    }
    
    return recommendations;
  }

  /**
   * Get average step duration
   */
  calculateAverageStepDuration() {
    const allDurations = this.stepLogs.map(log => log.duration);
    return allDurations.length > 0
      ? (allDurations.reduce((a, b) => a + b, 0) / allDurations.length).toFixed(2)
      : 0;
  }

  /**
   * Get most failed step
   */
  getMostFailedStep() {
    let mostFailed = null;
    let maxFailures = 0;
    
    Object.entries(this.sessionMetrics.stepDurations).forEach(([step, metrics]) => {
      if (metrics.failCount > maxFailures) {
        maxFailures = metrics.failCount;
        mostFailed = {
          step,
          failures: metrics.failCount,
          successRate: `${(metrics.successCount / metrics.count * 100).toFixed(2)}%`
        };
      }
    });
    
    return mostFailed;
  }

  /**
   * Get most time consuming step
   */
  getMostTimeConsumingStep() {
    let slowest = null;
    let maxDuration = 0;
    
    Object.entries(this.sessionMetrics.stepDurations).forEach(([step, metrics]) => {
      if (metrics.avgDuration > maxDuration) {
        maxDuration = metrics.avgDuration;
        slowest = {
          step,
          avgDuration: metrics.avgDuration.toFixed(2),
          totalTime: metrics.totalDuration.toFixed(2)
        };
      }
    });
    
    return slowest;
  }

  /**
   * Get top error patterns
   */
  getTopErrorPatterns() {
    return Array.from(this.sessionMetrics.errorPatterns.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        firstOccurrence: data.firstOccurrence,
        lastOccurrence: data.lastOccurrence
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Save metrics to file
   */
  saveMetrics() {
    try {
      const metricsPath = path.join(this.config.logDir, this.config.metricsFile);
      const metricsData = {
        sessionMetrics: this.sessionMetrics,
        realtimeMetrics: this.realtimeMetrics,
        stepLogs: this.stepLogs.slice(-100), // Keep last 100 steps
        analysis: this.analyzePerformance(),
        savedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(metricsPath, JSON.stringify(metricsData, null, 2));
      this.log('info', 'Metrics saved', { path: metricsPath });
    } catch (error) {
      this.log('error', 'Failed to save metrics', { error: error.message });
    }
  }

  /**
   * Start periodic metrics collection
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.updateRealtimeMetrics();
      this.saveMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * End session and generate final report
   */
  endSession() {
    this.sessionMetrics.endTime = new Date();
    
    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Generate final analysis
    const finalAnalysis = this.analyzePerformance();
    
    // Save final metrics
    this.saveMetrics();
    
    // Create session report
    const reportPath = path.join(
      this.config.logDir,
      `session-report-${this.sessionMetrics.sessionId}.json`
    );
    
    fs.writeFileSync(reportPath, JSON.stringify(finalAnalysis, null, 2));
    
    this.log('info', 'Session ended', {
      sessionId: this.sessionMetrics.sessionId,
      duration: finalAnalysis.duration,
      successRate: finalAnalysis.summary.successRate,
      reportPath
    });
    
    this.emit('session-ended', finalAnalysis);
    
    return finalAnalysis;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = PerformanceLogger;