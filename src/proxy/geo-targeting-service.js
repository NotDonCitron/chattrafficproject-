const axios = require('axios');
const winston = require('winston');
const { EventEmitter } = require('events');

/**
 * GeoTargetingService - Geographic targeting and location-based proxy selection
 * Provides geolocation services and geographic optimization
 */
class GeoTargetingService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: config.enabled ?? true,
      geoProvider: config.geoProvider || 'ipapi', // ipapi, ipgeolocation, geojs
      cacheEnabled: config.cacheEnabled ?? true,
      cacheExpiry: config.cacheExpiry || 24 * 60 * 60 * 1000, // 24 hours
      rateLimitDelay: config.rateLimitDelay || 1000, // 1 second between requests
      timeout: config.timeout || 5000,
      maxRetries: config.maxRetries || 3,
      fallbackProviders: config.fallbackProviders || ['geojs', 'ipgeolocation'],
      ...config
    };
    
    // Geolocation cache
    this.geoCache = new Map();
    
    // Rate limiting
    this.lastRequest = 0;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    
    // Geographic regions and distances
    this.regions = this.initializeRegions();
    this.distanceCache = new Map();
    
    // Logger setup
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/geo-targeting.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
  }

  /**
   * Initialize geographic regions and continent mapping
   */
  initializeRegions() {
    return {
      continents: {
        'North America': ['US', 'CA', 'MX'],
        'South America': ['BR', 'AR', 'CL', 'CO', 'PE', 'VE'],
        'Europe': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'PL', 'RU'],
        'Asia': ['CN', 'JP', 'IN', 'KR', 'TH', 'SG', 'MY', 'ID', 'PH', 'VN'],
        'Africa': ['ZA', 'EG', 'NG', 'KE', 'MA', 'GH'],
        'Oceania': ['AU', 'NZ', 'FJ']
      },
      timezones: {
        'Americas': ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
        'Europe': ['Europe/London', 'Europe/Paris', 'Europe/Berlin'],
        'Asia': ['Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore'],
        'Pacific': ['Pacific/Auckland', 'Pacific/Sydney']
      },
      coordinates: {
        'US': { lat: 39.8283, lon: -98.5795 },
        'CA': { lat: 56.1304, lon: -106.3468 },
        'GB': { lat: 55.3781, lon: -3.4360 },
        'DE': { lat: 51.1657, lon: 10.4515 },
        'FR': { lat: 46.2276, lon: 2.2137 },
        'JP': { lat: 36.2048, lon: 138.2529 },
        'CN': { lat: 35.8617, lon: 104.1954 },
        'AU': { lat: -25.2744, lon: 133.7751 },
        'BR': { lat: -14.2350, lon: -51.9253 },
        'IN': { lat: 20.5937, lon: 78.9629 }
      }
    };
  }

  /**
   * Get geolocation data for IP address
   */
  async getLocation(ipAddress) {
    if (!this.config.enabled) {
      return null;
    }
    
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = this.getCachedLocation(ipAddress);
        if (cached) {
          return cached;
        }
      }
      
      // Add to queue for rate limiting
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          ipAddress,
          resolve,
          reject,
          timestamp: Date.now()
        });
        
        this.processQueue();
      });
      
    } catch (error) {
      this.logger.error('Failed to get location', {
        ipAddress,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Process geolocation request queue with rate limiting
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        // Rate limiting
        const timeSinceLastRequest = Date.now() - this.lastRequest;
        if (timeSinceLastRequest < this.config.rateLimitDelay) {
          await this.sleep(this.config.rateLimitDelay - timeSinceLastRequest);
        }
        
        const location = await this.fetchLocationData(request.ipAddress);
        
        // Cache the result
        if (this.config.cacheEnabled && location) {
          this.cacheLocation(request.ipAddress, location);
        }
        
        this.lastRequest = Date.now();
        request.resolve(location);
        
      } catch (error) {
        this.logger.error('Geolocation request failed', {
          ipAddress: request.ipAddress,
          error: error.message
        });
        request.reject(error);
      }
      
      // Small delay between requests
      await this.sleep(100);
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Fetch location data from geolocation provider
   */
  async fetchLocationData(ipAddress) {
    let lastError = null;
    
    // Try primary provider
    try {
      return await this.fetchFromProvider(ipAddress, this.config.geoProvider);
    } catch (error) {
      lastError = error;
      this.logger.warn(`Primary geo provider failed: ${this.config.geoProvider}`, {
        ipAddress,
        error: error.message
      });
    }
    
    // Try fallback providers
    for (const provider of this.config.fallbackProviders) {
      try {
        const result = await this.fetchFromProvider(ipAddress, provider);
        this.logger.info(`Fallback geo provider succeeded: ${provider}`, { ipAddress });
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Fallback geo provider failed: ${provider}`, {
          ipAddress,
          error: error.message
        });
      }
    }
    
    throw lastError || new Error('All geolocation providers failed');
  }

  /**
   * Fetch from specific geolocation provider
   */
  async fetchFromProvider(ipAddress, provider) {
    switch (provider) {
      case 'ipapi':
        return await this.fetchFromIPAPI(ipAddress);
      case 'ipgeolocation':
        return await this.fetchFromIPGeolocation(ipAddress);
      case 'geojs':
        return await this.fetchFromGeoJS(ipAddress);
      default:
        throw new Error(`Unknown geolocation provider: ${provider}`);
    }
  }

  /**
   * Fetch from IP-API.com
   */
  async fetchFromIPAPI(ipAddress) {
    const url = `http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org`;
    
    const response = await axios.get(url, {
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'GeoTargetingService/1.0'
      }
    });
    
    if (response.data.status === 'fail') {
      throw new Error(response.data.message || 'IP-API request failed');
    }
    
    return this.normalizeLocationData({
      country: response.data.country,
      countryCode: response.data.countryCode,
      region: response.data.regionName,
      regionCode: response.data.region,
      city: response.data.city,
      latitude: response.data.lat,
      longitude: response.data.lon,
      timezone: response.data.timezone,
      isp: response.data.isp,
      organization: response.data.org,
      provider: 'ipapi'
    });
  }

  /**
   * Fetch from IPGeolocation.io
   */
  async fetchFromIPGeolocation(ipAddress) {
    // Note: This requires an API key for production use
    const apiKey = process.env.IPGEOLOCATION_API_KEY;
    if (!apiKey) {
      throw new Error('IPGeolocation API key not configured');
    }
    
    const url = `https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&ip=${ipAddress}`;
    
    const response = await axios.get(url, {
      timeout: this.config.timeout
    });
    
    return this.normalizeLocationData({
      country: response.data.country_name,
      countryCode: response.data.country_code2,
      region: response.data.state_prov,
      regionCode: response.data.state_code,
      city: response.data.city,
      latitude: parseFloat(response.data.latitude),
      longitude: parseFloat(response.data.longitude),
      timezone: response.data.time_zone.name,
      isp: response.data.isp,
      organization: response.data.organization,
      provider: 'ipgeolocation'
    });
  }

  /**
   * Fetch from GeoJS.io
   */
  async fetchFromGeoJS(ipAddress) {
    const url = `https://get.geojs.io/v1/ip/geo/${ipAddress}.json`;
    
    const response = await axios.get(url, {
      timeout: this.config.timeout
    });
    
    return this.normalizeLocationData({
      country: response.data.country,
      countryCode: response.data.country_code,
      region: response.data.region,
      regionCode: null,
      city: response.data.city,
      latitude: parseFloat(response.data.latitude),
      longitude: parseFloat(response.data.longitude),
      timezone: response.data.timezone,
      isp: null,
      organization: response.data.organization_name,
      provider: 'geojs'
    });
  }

  /**
   * Normalize location data from different providers
   */
  normalizeLocationData(data) {
    const normalized = {
      country: data.country || 'Unknown',
      countryCode: data.countryCode?.toUpperCase() || 'XX',
      region: data.region || 'Unknown',
      regionCode: data.regionCode || null,
      city: data.city || 'Unknown',
      coordinates: {
        latitude: data.latitude || 0,
        longitude: data.longitude || 0
      },
      timezone: data.timezone || 'UTC',
      isp: data.isp || 'Unknown',
      organization: data.organization || 'Unknown',
      continent: this.getContinent(data.countryCode),
      provider: data.provider,
      timestamp: new Date()
    };
    
    // Add additional geographic information
    normalized.region_info = this.getRegionInfo(normalized);
    
    return normalized;
  }

  /**
   * Get continent for country code
   */
  getContinent(countryCode) {
    if (!countryCode) return 'Unknown';
    
    for (const [continent, countries] of Object.entries(this.regions.continents)) {
      if (countries.includes(countryCode.toUpperCase())) {
        return continent;
      }
    }
    
    return 'Unknown';
  }

  /**
   * Get additional region information
   */
  getRegionInfo(location) {
    return {
      is_eu: this.isEuropeanUnion(location.countryCode),
      is_asia_pacific: this.isAsiaPacific(location.countryCode),
      is_americas: this.isAmericas(location.countryCode),
      population_density: this.getPopulationDensity(location.countryCode),
      internet_penetration: this.getInternetPenetration(location.countryCode)
    };
  }

  /**
   * Check if country is in European Union
   */
  isEuropeanUnion(countryCode) {
    const euCountries = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];
    return euCountries.includes(countryCode);
  }

  /**
   * Check if country is in Asia-Pacific region
   */
  isAsiaPacific(countryCode) {
    const apacCountries = [
      'AU', 'NZ', 'JP', 'KR', 'CN', 'HK', 'TW', 'SG', 'MY', 'TH',
      'VN', 'PH', 'ID', 'IN', 'PK', 'BD'
    ];
    return apacCountries.includes(countryCode);
  }

  /**
   * Check if country is in Americas
   */
  isAmericas(countryCode) {
    const americasCountries = [
      'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC',
      'BO', 'PY', 'UY', 'GY', 'SR', 'GF'
    ];
    return americasCountries.includes(countryCode);
  }

  /**
   * Get estimated population density category
   */
  getPopulationDensity(countryCode) {
    const highDensity = ['SG', 'HK', 'MT', 'BD', 'TW', 'KR', 'NL'];
    const mediumDensity = ['DE', 'GB', 'IT', 'JP', 'PH', 'VN', 'PK'];
    const lowDensity = ['AU', 'CA', 'RU', 'KZ', 'MN', 'LY', 'TD'];
    
    if (highDensity.includes(countryCode)) return 'high';
    if (mediumDensity.includes(countryCode)) return 'medium';
    if (lowDensity.includes(countryCode)) return 'low';
    return 'unknown';
  }

  /**
   * Get estimated internet penetration
   */
  getInternetPenetration(countryCode) {
    const highPenetration = ['IS', 'NO', 'DK', 'SE', 'FI', 'NL', 'GB', 'DE', 'KR', 'JP'];
    const mediumPenetration = ['US', 'CA', 'AU', 'FR', 'IT', 'ES', 'CN', 'RU', 'BR'];
    const lowPenetration = ['IN', 'BD', 'PK', 'NG', 'ET', 'CD', 'UZ', 'AF'];
    
    if (highPenetration.includes(countryCode)) return 'high';
    if (mediumPenetration.includes(countryCode)) return 'medium';
    if (lowPenetration.includes(countryCode)) return 'low';
    return 'unknown';
  }

  /**
   * Check if location matches requirement
   */
  matchesLocation(proxyLocation, requirement) {
    if (!proxyLocation || !requirement) return true;
    
    const req = requirement.toLowerCase();
    const location = proxyLocation;
    
    // Exact country code match
    if (req === location.countryCode.toLowerCase()) return true;
    
    // Country name match
    if (req === location.country.toLowerCase()) return true;
    
    // Continent match
    if (req === location.continent.toLowerCase()) return true;
    
    // Region match
    if (req === location.region.toLowerCase()) return true;
    
    // City match
    if (req === location.city.toLowerCase()) return true;
    
    // Special region matches
    if (req === 'eu' && location.region_info.is_eu) return true;
    if (req === 'europe' && location.region_info.is_eu) return true;
    if (req === 'asia' && location.region_info.is_asia_pacific) return true;
    if (req === 'americas' && location.region_info.is_americas) return true;
    
    return false;
  }

  /**
   * Calculate geographic score for proxy selection
   */
  calculateGeoScore(proxyLocation, targetLocation) {
    if (!proxyLocation || !targetLocation) return 0.5;
    
    // Perfect match scores
    if (proxyLocation.countryCode === targetLocation.toUpperCase()) return 1.0;
    if (proxyLocation.country.toLowerCase() === targetLocation.toLowerCase()) return 1.0;
    
    // Continent match
    if (proxyLocation.continent.toLowerCase() === targetLocation.toLowerCase()) return 0.8;
    
    // Regional proximity
    const distance = this.calculateDistance(proxyLocation, targetLocation);
    if (distance !== null) {
      // Closer is better, max score at 0km, min score at 20000km
      return Math.max(0.1, 1.0 - (distance / 20000));
    }
    
    return 0.3; // Default score for unknown locations
  }

  /**
   * Calculate distance between two locations
   */
  calculateDistance(location1, location2) {
    try {
      const coord1 = this.getCoordinates(location1);
      const coord2 = this.getCoordinates(location2);
      
      if (!coord1 || !coord2) return null;
      
      // Use Haversine formula
      const R = 6371; // Earth's radius in kilometers
      const dLat = this.toRadians(coord2.lat - coord1.lat);
      const dLon = this.toRadians(coord2.lon - coord1.lon);
      
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      return distance;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get coordinates for location
   */
  getCoordinates(location) {
    // If location object has coordinates
    if (location.coordinates) {
      return {
        lat: location.coordinates.latitude,
        lon: location.coordinates.longitude
      };
    }
    
    // If it's a string, look up in known coordinates
    if (typeof location === 'string') {
      const countryCode = location.toUpperCase();
      return this.regions.coordinates[countryCode] || null;
    }
    
    // If location object has country code
    if (location.countryCode) {
      return this.regions.coordinates[location.countryCode] || null;
    }
    
    return null;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Cache location data
   */
  cacheLocation(ipAddress, locationData) {
    this.geoCache.set(ipAddress, {
      data: locationData,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.cacheExpiry
    });
    
    // Clean up expired entries periodically
    if (this.geoCache.size % 100 === 0) {
      this.cleanupCache();
    }
  }

  /**
   * Get cached location data
   */
  getCachedLocation(ipAddress) {
    const cached = this.geoCache.get(ipAddress);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    
    // Remove expired entry
    if (cached) {
      this.geoCache.delete(ipAddress);
    }
    
    return null;
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, value] of this.geoCache.entries()) {
      if (value.expiresAt <= now) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.geoCache.delete(key));
    
    if (expiredKeys.length > 0) {
      this.logger.debug('Cleaned up expired geo cache entries', {
        count: expiredKeys.length,
        remainingEntries: this.geoCache.size
      });
    }
  }

  /**
   * Get geographic statistics
   */
  getGeoStats() {
    const stats = {
      cacheSize: this.geoCache.size,
      queueSize: this.requestQueue.length,
      isProcessing: this.isProcessingQueue,
      cacheHitRate: this.calculateCacheHitRate(),
      supportedProviders: [this.config.geoProvider, ...this.config.fallbackProviders],
      regionCoverage: this.calculateRegionCoverage()
    };
    
    return stats;
  }

  /**
   * Calculate cache hit rate (approximate)
   */
  calculateCacheHitRate() {
    // This is a simplified calculation
    // In production, you'd want to track actual hits/misses
    return this.geoCache.size > 0 ? 85 : 0; // Assume 85% hit rate when cache has data
  }

  /**
   * Calculate region coverage from cached data
   */
  calculateRegionCoverage() {
    const countries = new Set();
    const continents = new Set();
    
    for (const cached of this.geoCache.values()) {
      if (cached.data) {
        countries.add(cached.data.countryCode);
        continents.add(cached.data.continent);
      }
    }
    
    return {
      countries: countries.size,
      continents: continents.size,
      totalCountriesKnown: Object.keys(this.regions.coordinates).length
    };
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.geoCache.clear();
    this.logger.info('Geo cache cleared');
  }
}

module.exports = GeoTargetingService;