const winston = require('winston');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * SessionStateManager - Manages persistent session state for recovery
 * Handles state serialization, persistence, and restoration
 */
class SessionStateManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      persistenceType: config.persistenceType || 'file', // 'file', 'redis', 'memory'
      stateDirectory: config.stateDirectory || './session-states',
      redisUrl: config.redisUrl || process.env.REDIS_URL,
      autoSaveInterval: config.autoSaveInterval || 30000, // 30 seconds
      maxStateAge: config.maxStateAge || 24 * 60 * 60 * 1000, // 24 hours
      compressionEnabled: config.compressionEnabled ?? true,
      encryptionEnabled: config.encryptionEnabled ?? false,
      encryptionKey: config.encryptionKey || process.env.SESSION_ENCRYPTION_KEY,
      maxStatesInMemory: config.maxStatesInMemory || 1000,
      ...config
    };
    
    // In-memory state cache
    this.stateCache = new Map();
    
    // Redis client (if using Redis persistence)
    this.redisClient = null;
    
    // Auto-save timer
    this.autoSaveTimer = null;
    
    // State tracking
    this.stateStats = {
      totalStates: 0,
      activeSessions: 0,
      recoveredSessions: 0,
      failedRecoveries: 0,
      lastSave: null,
      lastCleanup: null
    };
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/session-state-manager.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
    
    this.initialize();
  }

  /**
   * Initialize the state manager
   */
  async initialize() {
    try {
      // Setup persistence layer
      await this.setupPersistence();
      
      // Start auto-save if enabled
      if (this.config.autoSaveInterval > 0) {
        this.startAutoSave();
      }
      
      // Setup cleanup schedule
      this.scheduleCleanup();
      
      this.logger.info('Session state manager initialized', {
        persistenceType: this.config.persistenceType,
        autoSaveInterval: this.config.autoSaveInterval
      });
      
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize session state manager', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Setup persistence layer based on configuration
   */
  async setupPersistence() {
    switch (this.config.persistenceType) {
      case 'file':
        await this.setupFilePersistence();
        break;
      case 'redis':
        await this.setupRedisPersistence();
        break;
      case 'memory':
        // No setup needed for memory-only persistence
        break;
      default:
        throw new Error(`Unknown persistence type: ${this.config.persistenceType}`);
    }
  }

  /**
   * Setup file-based persistence
   */
  async setupFilePersistence() {
    try {
      await fs.mkdir(this.config.stateDirectory, { recursive: true });
      
      // Load existing states
      await this.loadStatesFromDisk();
      
      this.logger.info('File persistence setup complete', {
        directory: this.config.stateDirectory,
        statesLoaded: this.stateCache.size
      });
    } catch (error) {
      this.logger.error('Failed to setup file persistence', {
        error: error.message,
        directory: this.config.stateDirectory
      });
      throw error;
    }
  }

  /**
   * Setup Redis persistence
   */
  async setupRedisPersistence() {
    try {
      if (!this.config.redisUrl) {
        throw new Error('Redis URL not configured');
      }
      
      const Redis = require('ioredis');
      this.redisClient = new Redis(this.config.redisUrl);
      
      // Test connection
      await this.redisClient.ping();
      
      // Load existing states
      await this.loadStatesFromRedis();
      
      this.logger.info('Redis persistence setup complete', {
        redisUrl: this.config.redisUrl.replace(/\/\/.*@/, '//***@'),
        statesLoaded: this.stateCache.size
      });
    } catch (error) {
      this.logger.error('Failed to setup Redis persistence', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Save session state
   */
  async saveSessionState(sessionId, state) {
    try {
      // Validate state
      this.validateSessionState(state);
      
      // Prepare state for storage
      const stateToStore = {
        ...state,
        sessionId,
        lastSaved: new Date(),
        version: 1
      };
      
      // Compress if enabled
      if (this.config.compressionEnabled) {
        stateToStore._compressed = true;
        stateToStore.data = await this.compressData(stateToStore.data || {});
      }
      
      // Encrypt if enabled
      if (this.config.encryptionEnabled) {
        stateToStore._encrypted = true;
        stateToStore.data = await this.encryptData(stateToStore.data);
      }
      
      // Store in cache
      this.stateCache.set(sessionId, stateToStore);
      
      // Persist based on configuration
      await this.persistState(sessionId, stateToStore);
      
      // Update stats
      this.updateStats('save', sessionId);
      
      this.emit('state-saved', { sessionId, state: stateToStore });
      
      this.logger.debug('Session state saved', {
        sessionId,
        size: JSON.stringify(stateToStore).length,
        compressed: stateToStore._compressed,
        encrypted: stateToStore._encrypted
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to save session state', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Load session state
   */
  async loadSessionState(sessionId) {
    try {
      // Check cache first
      let state = this.stateCache.get(sessionId);
      
      // Load from persistence if not in cache
      if (!state) {
        state = await this.loadPersistedState(sessionId);
        
        if (state) {
          this.stateCache.set(sessionId, state);
        }
      }
      
      if (!state) {
        return null;
      }
      
      // Decrypt if needed
      if (state._encrypted) {
        state.data = await this.decryptData(state.data);
        delete state._encrypted;
      }
      
      // Decompress if needed
      if (state._compressed) {
        state.data = await this.decompressData(state.data);
        delete state._compressed;
      }
      
      // Check if state is too old
      const age = Date.now() - new Date(state.lastSaved).getTime();
      if (age > this.config.maxStateAge) {
        this.logger.warn('Session state is too old, removing', {
          sessionId,
          age: age / 1000 / 60,
          maxAge: this.config.maxStateAge / 1000 / 60
        });
        
        await this.removeSessionState(sessionId);
        return null;
      }
      
      this.emit('state-loaded', { sessionId, state });
      
      this.logger.debug('Session state loaded', {
        sessionId,
        age: Math.round(age / 1000)
      });
      
      return state;
    } catch (error) {
      this.logger.error('Failed to load session state', {
        sessionId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Remove session state
   */
  async removeSessionState(sessionId) {
    try {
      // Remove from cache
      this.stateCache.delete(sessionId);
      
      // Remove from persistence
      await this.removePersistedState(sessionId);
      
      this.emit('state-removed', { sessionId });
      
      this.logger.debug('Session state removed', { sessionId });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to remove session state', {
        sessionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get all session IDs
   */
  async getAllSessionIds() {
    try {
      const sessionIds = new Set();
      
      // Add from cache
      for (const sessionId of this.stateCache.keys()) {
        sessionIds.add(sessionId);
      }
      
      // Add from persistence
      const persistedIds = await this.getPersistedSessionIds();
      for (const sessionId of persistedIds) {
        sessionIds.add(sessionId);
      }
      
      return Array.from(sessionIds);
    } catch (error) {
      this.logger.error('Failed to get all session IDs', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get session states summary
   */
  async getSessionsSummary() {
    try {
      const sessionIds = await this.getAllSessionIds();
      const summary = {
        total: sessionIds.length,
        cached: this.stateCache.size,
        active: 0,
        expired: 0,
        byPlatform: {},
        byStatus: {}
      };
      
      const now = Date.now();
      
      for (const sessionId of sessionIds) {
        const state = await this.loadSessionState(sessionId);
        
        if (state) {
          const age = now - new Date(state.lastSaved).getTime();
          
          if (age > this.config.maxStateAge) {
            summary.expired++;
          } else {
            summary.active++;
            
            // Group by platform
            const platform = state.platform || 'unknown';
            summary.byPlatform[platform] = (summary.byPlatform[platform] || 0) + 1;
            
            // Group by status
            const status = state.status || 'unknown';
            summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
          }
        }
      }
      
      return summary;
    } catch (error) {
      this.logger.error('Failed to get sessions summary', {
        error: error.message
      });
      return {
        total: 0,
        cached: 0,
        active: 0,
        expired: 0,
        byPlatform: {},
        byStatus: {}
      };
    }
  }

  /**
   * Persist state based on configuration
   */
  async persistState(sessionId, state) {
    switch (this.config.persistenceType) {
      case 'file':
        await this.saveStateToFile(sessionId, state);
        break;
      case 'redis':
        await this.saveStateToRedis(sessionId, state);
        break;
      case 'memory':
        // No persistence needed for memory-only
        break;
    }
  }

  /**
   * Load persisted state
   */
  async loadPersistedState(sessionId) {
    switch (this.config.persistenceType) {
      case 'file':
        return await this.loadStateFromFile(sessionId);
      case 'redis':
        return await this.loadStateFromRedis(sessionId);
      case 'memory':
        return null; // No persistence for memory-only
      default:
        return null;
    }
  }

  /**
   * Remove persisted state
   */
  async removePersistedState(sessionId) {
    switch (this.config.persistenceType) {
      case 'file':
        await this.removeStateFromFile(sessionId);
        break;
      case 'redis':
        await this.removeStateFromRedis(sessionId);
        break;
      case 'memory':
        // No persistence to remove
        break;
    }
  }

  /**
   * Get persisted session IDs
   */
  async getPersistedSessionIds() {
    switch (this.config.persistenceType) {
      case 'file':
        return await this.getFileSessionIds();
      case 'redis':
        return await this.getRedisSessionIds();
      case 'memory':
        return [];
      default:
        return [];
    }
  }

  /**
   * File persistence methods
   */
  async saveStateToFile(sessionId, state) {
    const filePath = path.join(this.config.stateDirectory, `${sessionId}.json`);
    const data = JSON.stringify(state, null, 2);
    await fs.writeFile(filePath, data, 'utf8');
  }

  async loadStateFromFile(sessionId) {
    try {
      const filePath = path.join(this.config.stateDirectory, `${sessionId}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load state from file', {
          sessionId,
          error: error.message
        });
      }
      return null;
    }
  }

  async removeStateFromFile(sessionId) {
    try {
      const filePath = path.join(this.config.stateDirectory, `${sessionId}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to remove state file', {
          sessionId,
          error: error.message
        });
      }
    }
  }

  async getFileSessionIds() {
    try {
      const files = await fs.readdir(this.config.stateDirectory);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  async loadStatesFromDisk() {
    try {
      const sessionIds = await this.getFileSessionIds();
      
      for (const sessionId of sessionIds) {
        const state = await this.loadStateFromFile(sessionId);
        if (state) {
          this.stateCache.set(sessionId, state);
        }
      }
      
      this.logger.info('Loaded states from disk', {
        count: sessionIds.length
      });
    } catch (error) {
      this.logger.error('Failed to load states from disk', {
        error: error.message
      });
    }
  }

  /**
   * Redis persistence methods
   */
  async saveStateToRedis(sessionId, state) {
    if (!this.redisClient) return;
    
    const key = `session_state:${sessionId}`;
    const data = JSON.stringify(state);
    
    await this.redisClient.setex(key, this.config.maxStateAge / 1000, data);
  }

  async loadStateFromRedis(sessionId) {
    if (!this.redisClient) return null;
    
    try {
      const key = `session_state:${sessionId}`;
      const data = await this.redisClient.get(key);
      
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error('Failed to load state from Redis', {
        sessionId,
        error: error.message
      });
      return null;
    }
  }

  async removeStateFromRedis(sessionId) {
    if (!this.redisClient) return;
    
    const key = `session_state:${sessionId}`;
    await this.redisClient.del(key);
  }

  async getRedisSessionIds() {
    if (!this.redisClient) return [];
    
    try {
      const keys = await this.redisClient.keys('session_state:*');
      return keys.map(key => key.replace('session_state:', ''));
    } catch (error) {
      return [];
    }
  }

  async loadStatesFromRedis() {
    try {
      const sessionIds = await this.getRedisSessionIds();
      
      for (const sessionId of sessionIds) {
        const state = await this.loadStateFromRedis(sessionId);
        if (state) {
          this.stateCache.set(sessionId, state);
        }
      }
      
      this.logger.info('Loaded states from Redis', {
        count: sessionIds.length
      });
    } catch (error) {
      this.logger.error('Failed to load states from Redis', {
        error: error.message
      });
    }
  }

  /**
   * Utility methods
   */
  validateSessionState(state) {
    if (!state || typeof state !== 'object') {
      throw new Error('State must be an object');
    }
    
    if (!state.sessionId && !state.id) {
      throw new Error('State must have sessionId or id');
    }
  }

  async compressData(data) {
    // Simple compression using JSON stringify
    // In production, you might want to use actual compression libraries
    return JSON.stringify(data);
  }

  async decompressData(data) {
    return JSON.parse(data);
  }

  async encryptData(data) {
    // Placeholder for encryption
    // In production, implement proper encryption
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  async decryptData(data) {
    // Placeholder for decryption
    return JSON.parse(Buffer.from(data, 'base64').toString());
  }

  updateStats(operation, sessionId) {
    switch (operation) {
      case 'save':
        this.stateStats.lastSave = new Date();
        break;
      case 'load':
        // Track load operations
        break;
      case 'remove':
        // Track remove operations
        break;
    }
    
    this.stateStats.totalStates = this.stateCache.size;
  }

  startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      this.performAutoSave();
    }, this.config.autoSaveInterval);
  }

  async performAutoSave() {
    try {
      const sessionIds = Array.from(this.stateCache.keys());
      
      for (const sessionId of sessionIds) {
        const state = this.stateCache.get(sessionId);
        if (state && state._modified) {
          await this.persistState(sessionId, state);
          delete state._modified;
        }
      }
      
      this.logger.debug('Auto-save completed', {
        sessionCount: sessionIds.length
      });
    } catch (error) {
      this.logger.error('Auto-save failed', {
        error: error.message
      });
    }
  }

  scheduleCleanup() {
    setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000); // Every hour
  }

  async performCleanup() {
    try {
      const now = Date.now();
      const toRemove = [];
      
      for (const [sessionId, state] of this.stateCache.entries()) {
        const age = now - new Date(state.lastSaved).getTime();
        
        if (age > this.config.maxStateAge) {
          toRemove.push(sessionId);
        }
      }
      
      for (const sessionId of toRemove) {
        await this.removeSessionState(sessionId);
      }
      
      this.stateStats.lastCleanup = new Date();
      
      this.logger.info('Cleanup completed', {
        removedStates: toRemove.length,
        remainingStates: this.stateCache.size
      });
    } catch (error) {
      this.logger.error('Cleanup failed', {
        error: error.message
      });
    }
  }

  /**
   * Get state manager statistics
   */
  getStats() {
    return {
      ...this.stateStats,
      cacheSize: this.stateCache.size,
      persistenceType: this.config.persistenceType,
      autoSaveEnabled: this.autoSaveTimer !== null
    };
  }

  /**
   * Shutdown the state manager
   */
  async shutdown() {
    try {
      // Stop auto-save
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
      
      // Perform final save
      await this.performAutoSave();
      
      // Close Redis connection
      if (this.redisClient) {
        await this.redisClient.quit();
        this.redisClient = null;
      }
      
      this.logger.info('Session state manager shutdown complete');
      
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during shutdown', {
        error: error.message
      });
    }
  }
}

module.exports = SessionStateManager;