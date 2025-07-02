module.exports = {
  // Browser-Einstellungen
  browser: {
    headless: false,
    type: 'chromium', // chromium, firefox, webkit
    slowMo: 0,
    devtools: false
  },

  // Proxy-Einstellungen
  proxy: {
    enabled: false,
    server: null, // 'http://proxy:port'
    username: null,
    password: null
  },

  // Bot-Verhalten
  behavior: {
    minDelay: 2000,
    maxDelay: 5000,
    typingSpeed: {
      min: 50,
      max: 150
    },
    chatDuration: {
      min: 30000, // 30 Sekunden
      max: 90000  // 90 Sekunden
    },
    responseChance: 0.3 // 30% Chance auf Antwort
  },

  // Chat-Einstellungen
  chat: {
    mode: 'video', // 'video' oder 'text'
    keepAlive: false,
    sessionTimeout: 1800000, // 30 Minuten
    autoReconnect: true,
    maxReconnectAttempts: 3
  },

  // Nachrichten
  messages: {
    greetings: [
      'Hey! How are you doing?',
      'Hi there! What\'s up?',
      'Hello! Nice to meet you!',
      'Hey! What are you interested in?',
      'Hi! How\'s your day going?'
    ],
    responses: [
      'That\'s interesting!',
      'Tell me more about that',
      'Cool! What else?',
      'I see what you mean',
      'That\'s awesome!',
      'Really? That sounds great!',
      'Oh wow, I didn\'t know that',
      'Haha, that\'s funny!'
    ],
    farewells: [
      'It was nice talking to you!',
      'Have a great day!',
      'See you around!',
      'Take care!',
      'Bye!'
    ]
  },

  // Interests
  interests: {
    enabled: true,
    tags: [
      'gaming',
      'music',
      'technology',
      'movies',
      'art',
      'travel',
      'food',
      'sports',
      'books',
      'photography'
    ],
    maxSelection: 3
  },

  // Stealth-Einstellungen
  stealth: {
    enabled: true,
    randomizeViewport: true,
    randomizeUserAgent: true,
    blockWebRTC: true,
    hideWebdriver: true
  },

  // Logging
  logging: {
    level: 'info', // debug, info, warn, error
    file: {
      enabled: true,
      path: 'logs/thundr-bot.log',
      maxSize: '10m',
      maxFiles: 5
    },
    console: {
      enabled: true,
      colorize: true
    }
  },

  // Screenshots
  screenshots: {
    enabled: true,
    onError: true,
    path: 'screenshots/',
    quality: 80,
    fullPage: false
  },

  // Monitoring
  monitoring: {
    enabled: false,
    statsInterval: 60000, // 1 Minute
    metrics: {
      messagesPerMinute: true,
      connectionSuccessRate: true,
      averageChatDuration: true
    }
  }
}; 