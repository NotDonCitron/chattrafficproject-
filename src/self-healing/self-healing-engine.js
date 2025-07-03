const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const winston = require('winston');

/**
 * Self-Healing Engine - Automatic recovery and optimization
 */
class SelfHealingEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      cacheDir: config.cacheDir || 'cache',
      maxRetries: config.maxRetries || 3,
      healingStrategies: config.healingStrategies || 'aggressive',
      autoLearn: config.autoLearn ?? true,
      domScanningEnabled: config.domScanningEnabled ?? true,
      ...config
    };
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
    }
    
    // Selector cache with confidence scores
    this.selectorCache = new Map();
    this.loadSelectorCache();
    
    // Recovery strategies
    this.recoveryStrategies = new Map();
    this.initializeRecoveryStrategies();
    
    // Learning data
    this.learningData = {
      successfulSelectors: new Map(),
      failedSelectors: new Map(),
      domPatterns: new Map(),
      recoveryStats: new Map()
    };
    
    // Logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join('logs', 'self-healing.log') 
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Initialize recovery strategies
   */
  initializeRecoveryStrategies() {
    // Selector recovery strategies
    this.recoveryStrategies.set('selector_not_found', [
      this.tryAlternativeSelectors.bind(this),
      this.scanDOMForSimilarElements.bind(this),
      this.useTextContentSearch.bind(this),
      this.tryParentChildNavigation.bind(this),
      this.useAriaLabels.bind(this)
    ]);
    
    // Timeout recovery strategies
    this.recoveryStrategies.set('timeout', [
      this.increaseTimeout.bind(this),
      this.waitForNetworkIdle.bind(this),
      this.retryWithDelay.bind(this),
      this.checkForOverlays.bind(this)
    ]);
    
    // Chat partner recovery
    this.recoveryStrategies.set('no_partner', [
      this.refreshAndRetry.bind(this),
      this.changeInterests.bind(this),
      this.adjustTiming.bind(this),
      this.skipToNext.bind(this)
    ]);
    
    // Browser crash recovery
    this.recoveryStrategies.set('browser_crash', [
      this.restartBrowser.bind(this),
      this.clearBrowserData.bind(this),
      this.useAlternativeProfile.bind(this)
    ]);
  }

  /**
   * Main healing method - attempts to recover from errors
   */
  async heal(error, context) {
    this.logger.info('Starting self-healing process', {
      error: error.message,
      context: context.stepName
    });
    
    const errorType = this.categorizeError(error);
    const strategies = this.recoveryStrategies.get(errorType) || [];
    
    let healed = false;
    let attemptCount = 0;
    
    for (const strategy of strategies) {
      attemptCount++;
      this.logger.info(`Attempting healing strategy ${attemptCount}/${strategies.length}`);
      
      try {
        const result = await strategy(error, context);
        if (result.success) {
          healed = true;
          
          // Learn from successful healing
          if (this.config.autoLearn) {
            await this.learnFromHealing(errorType, strategy.name, result);
          }
          
          this.emit('healed', {
            error: error.message,
            strategy: strategy.name,
            result
          });
          
          return result;
        }
      } catch (strategyError) {
        this.logger.error(`Healing strategy failed: ${strategyError.message}`);
      }
    }
    
    if (!healed) {
      this.emit('healing-failed', {
        error: error.message,
        attempts: attemptCount
      });
    }
    
    return { success: false, attempts: attemptCount };
  }

  /**
   * Try alternative selectors from cache or generate new ones
   */
  async tryAlternativeSelectors(error, context) {
    const { page, elementType, originalSelector } = context;
    
    // Check cache for alternatives
    const cacheKey = `${elementType}_${context.stepName}`;
    const cachedSelectors = this.selectorCache.get(cacheKey);
    
    if (cachedSelectors && cachedSelectors.alternatives.length > 0) {
      for (const alt of cachedSelectors.alternatives) {
        try {
          await page.waitForSelector(alt.selector, { timeout: 2000 });
          
          // Update confidence score
          alt.confidence = Math.min(alt.confidence * 1.1, 1.0);
          this.saveSelectorCache();
          
          return {
            success: true,
            selector: alt.selector,
            method: 'cached_alternative'
          };
        } catch (e) {
          alt.confidence *= 0.9;
        }
      }
    }
    
    // Generate new alternatives
    const alternatives = this.generateAlternativeSelectors(originalSelector, elementType);
    
    for (const selector of alternatives) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        
        // Add to cache
        this.addSelectorToCache(cacheKey, selector, 0.7);
        
        return {
          success: true,
          selector,
          method: 'generated_alternative'
        };
      } catch (e) {
        continue;
      }
    }
    
    return { success: false };
  }

  /**
   * Scan DOM for similar elements
   */
  async scanDOMForSimilarElements(error, context) {
    if (!this.config.domScanningEnabled) {
      return { success: false };
    }
    
    const { page, elementType, keywords = [] } = context;
    
    this.logger.info('Scanning DOM for similar elements', { elementType, keywords });
    
    const scanScript = `
      (() => {
        const elements = document.querySelectorAll('${this.getElementSelectors(elementType)}');
        const results = [];
        
        elements.forEach((el, index) => {
          const text = el.textContent.trim().toLowerCase();
          const ariaLabel = el.getAttribute('aria-label') || '';
          const className = el.className || '';
          const id = el.id || '';
          
          const searchText = \`\${text} \${ariaLabel} \${className} \${id}\`.toLowerCase();
          const keywords = ${JSON.stringify(keywords.map(k => k.toLowerCase()))};
          
          const matches = keywords.filter(keyword => searchText.includes(keyword)).length;
          
          if (matches > 0) {
            results.push({
              index,
              text: text.substring(0, 50),
              matches,
              selector: \`\${el.tagName.toLowerCase()}:nth-of-type(\${index + 1})\`,
              attributes: {
                class: className,
                id: id,
                'aria-label': ariaLabel
              }
            });
          }
        });
        
        return results.sort((a, b) => b.matches - a.matches);
      })();
    `;
    
    try {
      const results = await page.evaluate(scanScript);
      
      if (results.length > 0) {
        const best = results[0];
        this.logger.info('Found matching element', best);
        
        // Try the best match
        try {
          await page.click(best.selector, { timeout: 2000 });
          
          // Cache the successful selector
          const cacheKey = `${elementType}_${context.stepName}`;
          this.addSelectorToCache(cacheKey, best.selector, 0.8);
          
          return {
            success: true,
            selector: best.selector,
            method: 'dom_scan',
            confidence: best.matches / keywords.length
          };
        } catch (clickError) {
          this.logger.error('Failed to click scanned element', clickError.message);
        }
      }
    } catch (scanError) {
      this.logger.error('DOM scan failed', scanError.message);
    }
    
    return { success: false };
  }

  /**
   * Search for elements by text content
   */
  async useTextContentSearch(error, context) {
    const { page, searchText, elementType = 'button' } = context;
    
    if (!searchText) {
      return { success: false };
    }
    
    const selectors = [
      `${elementType}:has-text("${searchText}")`,
      `${elementType}:text-is("${searchText}")`,
      `//*[contains(text(), "${searchText}")]`,
      `[aria-label*="${searchText}" i]`
    ];
    
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        
        return {
          success: true,
          selector,
          method: 'text_search'
        };
      } catch (e) {
        continue;
      }
    }
    
    return { success: false };
  }

  /**
   * Navigate through parent/child relationships
   */
  async tryParentChildNavigation(error, context) {
    const { page, nearbySelector, targetType } = context;
    
    if (!nearbySelector) {
      return { success: false };
    }
    
    const navigationScript = `
      (() => {
        const nearby = document.querySelector('${nearbySelector}');
        if (!nearby) return null;
        
        // Search in parent
        const parent = nearby.parentElement;
        const targetInParent = parent.querySelector('${targetType}');
        if (targetInParent) {
          return { found: true, index: Array.from(parent.children).indexOf(targetInParent) };
        }
        
        // Search in siblings
        const siblings = Array.from(parent.children);
        for (let i = 0; i < siblings.length; i++) {
          const target = siblings[i].querySelector('${targetType}');
          if (target) {
            return { found: true, index: i, inSibling: true };
          }
        }
        
        return null;
      })();
    `;
    
    try {
      const result = await page.evaluate(navigationScript);
      
      if (result && result.found) {
        const selector = result.inSibling
          ? `${nearbySelector} ~ :nth-child(${result.index + 1}) ${targetType}`
          : `${nearbySelector} ~ ${targetType}`;
        
        await page.click(selector, { timeout: 2000 });
        
        return {
          success: true,
          selector,
          method: 'parent_child_navigation'
        };
      }
    } catch (navError) {
      this.logger.error('Parent/child navigation failed', navError.message);
    }
    
    return { success: false };
  }

  /**
   * Use ARIA labels for accessibility-based selection
   */
  async useAriaLabels(error, context) {
    const { page, elementType, purpose } = context;
    
    const ariaSelectors = [
      `[aria-label*="${purpose}" i]`,
      `[aria-describedby*="${purpose}" i]`,
      `[role="${elementType}"][aria-label*="${purpose}" i]`,
      `[title*="${purpose}" i]`
    ];
    
    for (const selector of ariaSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        
        return {
          success: true,
          selector,
          method: 'aria_labels'
        };
      } catch (e) {
        continue;
      }
    }
    
    return { success: false };
  }

  /**
   * Timeout recovery: Increase timeout
   */
  async increaseTimeout(error, context) {
    const newTimeout = (context.timeout || 5000) * 2;
    
    this.logger.info(`Increasing timeout to ${newTimeout}ms`);
    
    return {
      success: true,
      newTimeout,
      method: 'increased_timeout'
    };
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle(error, context) {
    const { page } = context;
    
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      return {
        success: true,
        method: 'network_idle'
      };
    } catch (e) {
      return { success: false };
    }
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithDelay(error, context) {
    const attempt = context.retryAttempt || 1;
    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
    
    this.logger.info(`Waiting ${delay}ms before retry`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      success: true,
      delay,
      method: 'exponential_backoff'
    };
  }

  /**
   * Check for and remove overlays
   */
  async checkForOverlays(error, context) {
    const { page } = context;
    
    const overlaySelectors = [
      '.modal',
      '.overlay',
      '.popup',
      '[role="dialog"]',
      '.cookie-banner',
      '.consent-banner'
    ];
    
    try {
      for (const selector of overlaySelectors) {
        const overlay = await page.$(selector);
        if (overlay && await overlay.isVisible()) {
          // Try to close overlay
          const closeButton = await overlay.$('button[aria-label*="close" i], .close, [class*="close"]');
          if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(1000);
            
            return {
              success: true,
              method: 'overlay_removed',
              overlayType: selector
            };
          }
        }
      }
    } catch (e) {
      this.logger.error('Overlay check failed', e.message);
    }
    
    return { success: false };
  }

  /**
   * Generate alternative selectors
   */
  generateAlternativeSelectors(originalSelector, elementType) {
    const alternatives = [];
    
    // Extract meaningful parts from original selector
    const classMatch = originalSelector.match(/\.([a-zA-Z0-9-_]+)/);
    const idMatch = originalSelector.match(/#([a-zA-Z0-9-_]+)/);
    const textMatch = originalSelector.match(/:has-text\("([^"]+)"\)/);
    
    if (classMatch) {
      alternatives.push(`.${classMatch[1]}`);
      alternatives.push(`${elementType}.${classMatch[1]}`);
    }
    
    if (idMatch) {
      alternatives.push(`#${idMatch[1]}`);
    }
    
    if (textMatch) {
      const text = textMatch[1];
      alternatives.push(`${elementType}:has-text("${text}")`);
      alternatives.push(`//*[contains(text(), "${text}")]`);
      alternatives.push(`[aria-label*="${text}" i]`);
    }
    
    // Add generic alternatives
    alternatives.push(`${elementType}:visible`);
    alternatives.push(`${elementType}:not([disabled])`);
    
    return alternatives;
  }

  /**
   * Get element selectors by type
   */
  getElementSelectors(elementType) {
    const typeMap = {
      button: 'button, [role="button"], input[type="button"], input[type="submit"]',
      input: 'input, textarea, [contenteditable="true"]',
      link: 'a, [role="link"]',
      checkbox: 'input[type="checkbox"], [role="checkbox"]',
      radio: 'input[type="radio"], [role="radio"]'
    };
    
    return typeMap[elementType] || '*';
  }

  /**
   * Categorize error types
   */
  categorizeError(error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('selector') || errorMessage.includes('element')) {
      return 'selector_not_found';
    }
    if (errorMessage.includes('timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('partner') || errorMessage.includes('chat')) {
      return 'no_partner';
    }
    if (errorMessage.includes('crash') || errorMessage.includes('closed')) {
      return 'browser_crash';
    }
    
    return 'unknown';
  }

  /**
   * Learn from successful healing
   */
  async learnFromHealing(errorType, strategyName, result) {
    const key = `${errorType}_${strategyName}`;
    
    if (!this.learningData.recoveryStats.has(key)) {
      this.learningData.recoveryStats.set(key, {
        attempts: 0,
        successes: 0,
        averageTime: 0
      });
    }
    
    const stats = this.learningData.recoveryStats.get(key);
    stats.attempts++;
    stats.successes++;
    
    // Save learning data
    this.saveLearningData();
    
    this.emit('learned', {
      errorType,
      strategy: strategyName,
      stats
    });
  }

  /**
   * Add selector to cache
   */
  addSelectorToCache(key, selector, confidence = 0.5) {
    if (!this.selectorCache.has(key)) {
      this.selectorCache.set(key, {
        primary: selector,
        alternatives: [],
        lastUsed: new Date(),
        successCount: 0
      });
    }
    
    const cache = this.selectorCache.get(key);
    
    // Add as alternative if not primary
    if (cache.primary !== selector) {
      const existing = cache.alternatives.find(alt => alt.selector === selector);
      if (existing) {
        existing.confidence = Math.min(existing.confidence * 1.1, 1.0);
        existing.lastUsed = new Date();
      } else {
        cache.alternatives.push({
          selector,
          confidence,
          lastUsed: new Date(),
          successCount: 1
        });
      }
      
      // Sort by confidence
      cache.alternatives.sort((a, b) => b.confidence - a.confidence);
      
      // Keep top 5 alternatives
      cache.alternatives = cache.alternatives.slice(0, 5);
    }
    
    cache.successCount++;
    cache.lastUsed = new Date();
    
    this.saveSelectorCache();
  }

  /**
   * Load selector cache
   */
  loadSelectorCache() {
    try {
      const cachePath = path.join(this.config.cacheDir, 'selector-cache.json');
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        this.selectorCache = new Map(Object.entries(data));
        this.logger.info(`Loaded ${this.selectorCache.size} cached selectors`);
      }
    } catch (error) {
      this.logger.error('Failed to load selector cache', error.message);
    }
  }

  /**
   * Save selector cache
   */
  saveSelectorCache() {
    try {
      const cachePath = path.join(this.config.cacheDir, 'selector-cache.json');
      const data = Object.fromEntries(this.selectorCache);
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save selector cache', error.message);
    }
  }

  /**
   * Save learning data
   */
  saveLearningData() {
    try {
      const dataPath = path.join(this.config.cacheDir, 'learning-data.json');
      const data = {
        recoveryStats: Object.fromEntries(this.learningData.recoveryStats),
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save learning data', error.message);
    }
  }

  /**
   * Get healing statistics
   */
  getHealingStats() {
    const stats = {
      totalHealingAttempts: 0,
      successfulHealings: 0,
      strategyEffectiveness: {},
      mostCommonErrors: [],
      cachedSelectors: this.selectorCache.size
    };
    
    this.learningData.recoveryStats.forEach((data, key) => {
      stats.totalHealingAttempts += data.attempts;
      stats.successfulHealings += data.successes;
      
      const [errorType, strategy] = key.split('_');
      if (!stats.strategyEffectiveness[strategy]) {
        stats.strategyEffectiveness[strategy] = {
          attempts: 0,
          successes: 0,
          successRate: 0
        };
      }
      
      stats.strategyEffectiveness[strategy].attempts += data.attempts;
      stats.strategyEffectiveness[strategy].successes += data.successes;
    });
    
    // Calculate success rates
    Object.keys(stats.strategyEffectiveness).forEach(strategy => {
      const data = stats.strategyEffectiveness[strategy];
      data.successRate = data.attempts > 0 
        ? (data.successes / data.attempts * 100).toFixed(2) + '%'
        : '0%';
    });
    
    return stats;
  }
}

module.exports = SelfHealingEngine;