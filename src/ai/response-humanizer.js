const winston = require('winston');
const { EventEmitter } = require('events');

/**
 * ResponseHumanizer - Makes AI responses appear more human-like
 * Simulates natural typing patterns, delays, and human behaviors
 */
class ResponseHumanizer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      baseTypingSpeed: config.baseTypingSpeed || 65, // WPM
      typingSpeedVariation: config.typingSpeedVariation || 0.3, // 30% variation
      enableTypos: config.enableTypos ?? true,
      typoRate: config.typoRate || 0.02, // 2% chance per character
      correctionDelay: config.correctionDelay || [500, 1500], // ms range
      enablePauses: config.enablePauses ?? true,
      pauseProbability: config.pauseProbability || 0.3, // 30% chance
      naturalDelays: config.naturalDelays ?? true,
      emotionalResponseDelays: config.emotionalResponseDelays ?? true,
      thinkingPauses: config.thinkingPauses ?? true,
      ...config
    };
    
    // Common typos and corrections
    this.typoPatterns = this.initializeTypoPatterns();
    
    // Pause triggers (words/phrases that naturally cause pauses)
    this.pauseTriggers = [
      'but', 'however', 'although', 'because', 'since', 'while',
      'actually', 'honestly', 'personally', 'really', 'especially',
      'basically', 'literally', 'definitely', 'probably', 'maybe'
    ];
    
    // Emotional indicators that affect typing speed
    this.emotionalIndicators = {
      excitement: ['!', 'awesome', 'amazing', 'wow', 'incredible', 'fantastic'],
      hesitation: ['um', 'uh', 'well', 'maybe', 'i think', 'perhaps'],
      emphasis: ['really', 'very', 'extremely', 'totally', 'absolutely']
    };
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/response-humanizer.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.metrics = {
      totalResponses: 0,
      averageTypingSpeed: 0,
      typosGenerated: 0,
      pausesAdded: 0,
      correctionsApplied: 0
    };
  }

  /**
   * Initialize common typo patterns
   */
  initializeTypoPatterns() {
    return {
      // Common letter swaps
      'the': ['teh', 'hte'],
      'and': ['adn', 'nad'],
      'you': ['yuo', 'oyu'],
      'are': ['rae', 'aer'],
      'for': ['fro', 'ofr'],
      'that': ['taht', 'thta'],
      'with': ['wiht', 'wtih'],
      'have': ['ahve', 'haev'],
      'this': ['htis', 'tihs'],
      'will': ['wlil', 'iwll'],
      'your': ['yuor', 'yoru'],
      'they': ['tehy', 'tyeh'],
      'been': ['bene', 'ebn'],
      'their': ['thier', 'tehir'],
      'what': ['waht', 'hwat'],
      'said': ['siad', 'asid'],
      'each': ['eahc', 'aech'],
      'which': ['whcih', 'hwich'],
      'do': ['od'],
      'get': ['gte', 'etg'],
      'use': ['sue', 'ues'],
      'her': ['hre', 'ehr'],
      'many': ['amny', 'myan'],
      'way': ['wya', 'awy'],
      'would': ['owuld', 'woudl'],
      'like': ['liek', 'ilke'],
      'its': ['sit', 'tis'],
      'could': ['coudl', 'ocudl'],
      'time': ['itme', 'tmie']
    };
  }

  /**
   * Process response to make it more human-like
   */
  async process(response, options = {}) {
    try {
      const config = {
        typingSpeed: options.typingSpeed || 'natural',
        addTypos: options.addTypos ?? this.config.enableTypos,
        pauseLocations: options.pauseLocations || 'smart',
        emotionalTone: options.emotionalTone || 'neutral',
        enableCorrections: options.enableCorrections ?? true,
        platform: options.platform || 'unknown',
        conversationStage: options.conversationStage || 'middle',
        ...options
      };
      
      // Calculate base delays
      const preTypingDelay = await this.calculatePreTypingDelay(response, config);
      const typingSequence = await this.generateTypingSequence(response, config);
      
      const result = {
        originalResponse: response,
        processedResponse: typingSequence.finalText,
        preTypingDelay,
        typingSequence: typingSequence.sequence,
        totalTypingTime: typingSequence.totalTime,
        humanizationApplied: {
          typos: typingSequence.typosApplied,
          pauses: typingSequence.pausesAdded,
          corrections: typingSequence.correctionsApplied,
          emotionalAdjustments: typingSequence.emotionalAdjustments
        },
        metadata: {
          averageWPM: typingSequence.averageWPM,
          characterCount: response.length,
          wordCount: response.split(' ').length
        }
      };
      
      // Update metrics
      this.updateMetrics(result);
      
      this.emit('response-humanized', result);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to humanize response', {
        error: error.message,
        response: response.substring(0, 100)
      });
      
      // Return basic result on error
      return {
        originalResponse: response,
        processedResponse: response,
        preTypingDelay: 1000,
        typingSequence: [{ type: 'text', content: response, delay: 0 }],
        totalTypingTime: response.length * 50, // Basic estimation
        error: error.message
      };
    }
  }

  /**
   * Calculate delay before starting to type
   */
  async calculatePreTypingDelay(response, config) {
    let baseDelay = 800; // Base thinking time
    
    // Adjust for emotional tone
    switch (config.emotionalTone) {
      case 'excited':
        baseDelay *= 0.6; // Faster response when excited
        break;
      case 'thoughtful':
      case 'confused':
        baseDelay *= 1.8; // Longer thinking time
        break;
      case 'hesitant':
        baseDelay *= 2.2; // Much longer when hesitant
        break;
      case 'angry':
        baseDelay *= 0.4; // Very quick response when angry
        break;
      default:
        baseDelay *= this.randomBetween(0.8, 1.4); // Natural variation
    }
    
    // Adjust for conversation stage
    switch (config.conversationStage) {
      case 'opening':
        baseDelay *= 1.3; // Bit longer at start
        break;
      case 'closing':
        baseDelay *= 0.9; // Slightly faster when wrapping up
        break;
    }
    
    // Adjust for response complexity
    const complexity = this.analyzeResponseComplexity(response);
    baseDelay *= (1 + complexity * 0.5);
    
    // Add random variation
    const variation = this.randomBetween(0.7, 1.5);
    
    return Math.round(baseDelay * variation);
  }

  /**
   * Generate detailed typing sequence with human-like patterns
   */
  async generateTypingSequence(response, config) {
    const sequence = [];
    let currentText = '';
    let totalTime = 0;
    let typosApplied = 0;
    let pausesAdded = 0;
    let correctionsApplied = 0;
    let emotionalAdjustments = 0;
    
    // Calculate base typing speed
    const baseWPM = this.calculateTypingSpeed(config);
    const baseCharDelay = (60 / (baseWPM * 5)) * 1000; // Convert WPM to ms per character
    
    const words = response.split(' ');
    
    for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
      const word = words[wordIndex];
      const isLastWord = wordIndex === words.length - 1;
      
      // Check for natural pause before word
      if (this.shouldPauseBeforeWord(word, config)) {
        const pauseDelay = this.calculatePauseDelay(word, config);
        sequence.push({
          type: 'pause',
          duration: pauseDelay,
          reason: `natural pause before "${word}"`
        });
        totalTime += pauseDelay;
        pausesAdded++;
      }
      
      // Apply typo if applicable
      let wordToType = word;
      let hasTypo = false;
      
      if (config.addTypos && this.shouldApplyTypo(word)) {
        const typoWord = this.generateTypo(word);
        if (typoWord !== word) {
          wordToType = typoWord;
          hasTypo = true;
          typosApplied++;
        }
      }
      
      // Type the word character by character
      for (let charIndex = 0; charIndex < wordToType.length; charIndex++) {
        const char = wordToType[charIndex];
        
        // Calculate delay for this character
        let charDelay = this.calculateCharacterDelay(
          char,
          charIndex,
          wordToType,
          config,
          baseCharDelay
        );
        
        // Apply emotional adjustments
        const emotionalMultiplier = this.getEmotionalTypingMultiplier(wordToType, config.emotionalTone);
        if (emotionalMultiplier !== 1) {
          charDelay *= emotionalMultiplier;
          emotionalAdjustments++;
        }
        
        currentText += char;
        sequence.push({
          type: 'character',
          character: char,
          delay: Math.round(charDelay),
          cumulativeText: currentText
        });
        totalTime += charDelay;
      }
      
      // Apply correction if typo was made
      if (hasTypo && config.enableCorrections && Math.random() < 0.8) {
        const correctionDelay = this.randomBetween(
          this.config.correctionDelay[0],
          this.config.correctionDelay[1]
        );
        
        // Remove typo word
        currentText = currentText.substring(0, currentText.length - wordToType.length);
        
        sequence.push({
          type: 'correction',
          action: 'delete',
          charactersDeleted: wordToType.length,
          delay: correctionDelay / 2
        });
        
        sequence.push({
          type: 'pause',
          duration: correctionDelay / 2,
          reason: 'thinking after typo correction'
        });
        
        // Type correct word
        for (let charIndex = 0; charIndex < word.length; charIndex++) {
          const char = word[charIndex];
          const charDelay = this.calculateCharacterDelay(
            char,
            charIndex,
            word,
            config,
            baseCharDelay * 0.9 // Slightly faster when correcting
          );
          
          currentText += char;
          sequence.push({
            type: 'character',
            character: char,
            delay: Math.round(charDelay),
            cumulativeText: currentText,
            isCorrection: true
          });
          totalTime += charDelay;
        }
        
        totalTime += correctionDelay;
        correctionsApplied++;
      }
      
      // Add space after word (except for last word)
      if (!isLastWord) {
        const spaceDelay = baseCharDelay * this.randomBetween(0.8, 1.2);
        currentText += ' ';
        sequence.push({
          type: 'character',
          character: ' ',
          delay: Math.round(spaceDelay),
          cumulativeText: currentText
        });
        totalTime += spaceDelay;
      }
    }
    
    const averageWPM = this.calculateActualWPM(response, totalTime);
    
    return {
      sequence,
      finalText: currentText,
      totalTime: Math.round(totalTime),
      typosApplied,
      pausesAdded,
      correctionsApplied,
      emotionalAdjustments,
      averageWPM: Math.round(averageWPM)
    };
  }

  /**
   * Calculate typing speed based on configuration
   */
  calculateTypingSpeed(config) {
    let baseWPM = this.config.baseTypingSpeed;
    
    // Apply speed configuration
    switch (config.typingSpeed) {
      case 'slow':
        baseWPM *= 0.6;
        break;
      case 'fast':
        baseWPM *= 1.4;
        break;
      case 'natural':
      default:
        // Apply natural variation
        const variation = this.config.typingSpeedVariation;
        baseWPM *= this.randomBetween(1 - variation, 1 + variation);
        break;
    }
    
    return Math.max(20, Math.min(120, baseWPM)); // Constrain to reasonable range
  }

  /**
   * Calculate delay for individual character
   */
  calculateCharacterDelay(char, position, word, config, baseDelay) {
    let delay = baseDelay;
    
    // Adjust for character type
    if (char === ' ') {
      delay *= 1.5; // Spaces take longer
    } else if ('.,!?;:'.includes(char)) {
      delay *= 1.3; // Punctuation takes longer
    } else if ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(char)) {
      delay *= 1.2; // Capital letters take longer
    }
    
    // Adjust for position in word
    if (position === 0) {
      delay *= 1.1; // First character takes longer
    }
    
    // Add natural variation
    delay *= this.randomBetween(0.7, 1.4);
    
    return Math.max(30, delay); // Minimum delay
  }

  /**
   * Determine if should pause before word
   */
  shouldPauseBeforeWord(word, config) {
    if (!config.pauseLocations || config.pauseLocations === 'none') return false;
    
    const lowerWord = word.toLowerCase();
    
    // Smart pause locations
    if (config.pauseLocations === 'smart') {
      return this.pauseTriggers.includes(lowerWord) && Math.random() < this.config.pauseProbability;
    }
    
    // Random pauses
    if (config.pauseLocations === 'random') {
      return Math.random() < this.config.pauseProbability * 0.5;
    }
    
    return false;
  }

  /**
   * Calculate pause delay
   */
  calculatePauseDelay(word, config) {
    const basePause = 800;
    const lowerWord = word.toLowerCase();
    
    // Longer pauses for more significant words
    const significantWords = ['but', 'however', 'although', 'actually'];
    const multiplier = significantWords.includes(lowerWord) ? 1.5 : 1;
    
    return Math.round(basePause * multiplier * this.randomBetween(0.8, 1.4));
  }

  /**
   * Determine if should apply typo
   */
  shouldApplyTypo(word) {
    if (!this.config.enableTypos) return false;
    
    // Don't apply typos to very short words
    if (word.length < 3) return false;
    
    // Higher chance for longer words
    const lengthFactor = Math.min(word.length / 10, 2);
    const adjustedRate = this.config.typoRate * lengthFactor;
    
    return Math.random() < adjustedRate;
  }

  /**
   * Generate typo for word
   */
  generateTypo(word) {
    const lowerWord = word.toLowerCase();
    
    // Check for common typo patterns
    if (this.typoPatterns[lowerWord]) {
      const typos = this.typoPatterns[lowerWord];
      return typos[Math.floor(Math.random() * typos.length)];
    }
    
    // Generate random character swap/substitution
    if (word.length >= 4) {
      const typoType = Math.random();
      
      if (typoType < 0.4) {
        // Character swap
        return this.swapCharacters(word);
      } else if (typoType < 0.7) {
        // Character substitution
        return this.substituteCharacter(word);
      } else {
        // Character omission
        return this.omitCharacter(word);
      }
    }
    
    return word;
  }

  /**
   * Swap adjacent characters
   */
  swapCharacters(word) {
    if (word.length < 2) return word;
    
    const pos = Math.floor(Math.random() * (word.length - 1));
    const chars = word.split('');
    [chars[pos], chars[pos + 1]] = [chars[pos + 1], chars[pos]];
    
    return chars.join('');
  }

  /**
   * Substitute a character
   */
  substituteCharacter(word) {
    const pos = Math.floor(Math.random() * word.length);
    const chars = word.split('');
    const originalChar = chars[pos];
    
    // Common substitution patterns
    const substitutions = {
      'e': 'a', 'a': 'e', 'i': 'o', 'o': 'i',
      't': 'r', 'r': 't', 'n': 'm', 'm': 'n',
      's': 'd', 'd': 's', 'l': 'k', 'k': 'l'
    };
    
    if (substitutions[originalChar.toLowerCase()]) {
      chars[pos] = substitutions[originalChar.toLowerCase()];
    }
    
    return chars.join('');
  }

  /**
   * Omit a character
   */
  omitCharacter(word) {
    if (word.length <= 3) return word;
    
    const pos = Math.floor(Math.random() * word.length);
    return word.substring(0, pos) + word.substring(pos + 1);
  }

  /**
   * Get emotional typing speed multiplier
   */
  getEmotionalTypingMultiplier(word, emotionalTone) {
    const lowerWord = word.toLowerCase();
    
    switch (emotionalTone) {
      case 'excited':
        if (this.emotionalIndicators.excitement.some(indicator => 
            lowerWord.includes(indicator))) {
          return 0.7; // Type faster when excited
        }
        break;
        
      case 'hesitant':
        if (this.emotionalIndicators.hesitation.some(indicator => 
            lowerWord.includes(indicator))) {
          return 1.8; // Type slower when hesitant
        }
        break;
        
      case 'thoughtful':
        if (this.emotionalIndicators.emphasis.some(indicator => 
            lowerWord.includes(indicator))) {
          return 1.3; // Slightly slower for emphasis
        }
        break;
    }
    
    return 1; // No adjustment
  }

  /**
   * Analyze response complexity
   */
  analyzeResponseComplexity(response) {
    let complexity = 0;
    
    // Length factor
    if (response.length > 100) complexity += 0.2;
    if (response.length > 200) complexity += 0.3;
    
    // Question complexity
    const questionCount = (response.match(/\?/g) || []).length;
    complexity += questionCount * 0.1;
    
    // Complex words (longer than 8 characters)
    const words = response.split(' ');
    const complexWords = words.filter(word => word.length > 8).length;
    complexity += (complexWords / words.length) * 0.5;
    
    // Punctuation complexity
    const punctuationCount = (response.match(/[.,;:!]/g) || []).length;
    complexity += (punctuationCount / words.length) * 0.2;
    
    return Math.min(complexity, 1); // Cap at 1
  }

  /**
   * Calculate actual WPM from typing sequence
   */
  calculateActualWPM(text, totalTimeMs) {
    const wordCount = text.split(' ').length;
    const minutes = totalTimeMs / (1000 * 60);
    return minutes > 0 ? wordCount / minutes : 0;
  }

  /**
   * Generate random number between min and max
   */
  randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Update metrics
   */
  updateMetrics(result) {
    this.metrics.totalResponses++;
    
    // Update average typing speed
    const currentAvgWPM = this.metrics.averageTypingSpeed;
    this.metrics.averageTypingSpeed = ((currentAvgWPM * (this.metrics.totalResponses - 1)) + 
      result.metadata.averageWPM) / this.metrics.totalResponses;
    
    // Update counters
    this.metrics.typosGenerated += result.humanizationApplied.typos;
    this.metrics.pausesAdded += result.humanizationApplied.pauses;
    this.metrics.correctionsApplied += result.humanizationApplied.corrections;
  }

  /**
   * Get humanization metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageTypingSpeed: Math.round(this.metrics.averageTypingSpeed),
      typoRate: this.metrics.totalResponses > 0 
        ? (this.metrics.typosGenerated / this.metrics.totalResponses * 100).toFixed(2) + '%'
        : '0%',
      correctionRate: this.metrics.typosGenerated > 0
        ? (this.metrics.correctionsApplied / this.metrics.typosGenerated * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalResponses: 0,
      averageTypingSpeed: 0,
      typosGenerated: 0,
      pausesAdded: 0,
      correctionsApplied: 0
    };
  }
}

module.exports = ResponseHumanizer;