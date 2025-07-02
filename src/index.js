const ThundrBot = require('./bots/thundr-bot');
const path = require('path');
require('dotenv').config();

// Beispiel-Konfiguration aus Umgebungsvariablen oder Default-Werten
const botConfig = {
  headless: process.env.HEADLESS === 'true',
  proxy: process.env.PROXY_URL || null,
  interests: process.env.INTERESTS ? process.env.INTERESTS.split(',') : ['gaming', 'music', 'technology'],
  messages: process.env.MESSAGES ? process.env.MESSAGES.split('|') : [
    'Hey! How are you doing?',
    'Hi there! What\'s up?',
    'Hello! Nice to meet you!',
    'Hey! What are you interested in?',
    'Hi! How\'s your day going?'
  ],
  delay: {
    min: parseInt(process.env.MIN_DELAY) || 2000,
    max: parseInt(process.env.MAX_DELAY) || 5000
  },
  keepAlive: process.env.KEEP_ALIVE === 'true',
  chatMode: process.env.CHAT_MODE || 'video',
  autoReconnect: process.env.AUTO_RECONNECT !== 'false',
  maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 3,
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 1800000,
  screenshotOnError: process.env.SCREENSHOT_ON_ERROR !== 'false',
  stealthMode: process.env.STEALTH_MODE !== 'false',
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Bot-Instanz erstellen
const bot = new ThundrBot(botConfig);

// Event-Listener für Bot-Events
bot.on('browser_started', () => {
  console.log('🚀 Browser erfolgreich gestartet');
});

bot.on('page_loaded', () => {
  console.log('📄 Thundr.com geladen');
});

bot.on('interests_selected', (data) => {
  console.log(`🎯 ${data.count} Interests ausgewählt`);
});

bot.on('chat_started', (data) => {
  console.log(`💬 ${data.mode} Chat gestartet`);
});

bot.on('partner_connected', () => {
  console.log('👥 Partner verbunden!');
});

bot.on('message_sent', (data) => {
  console.log(`📤 Nachricht gesendet: "${data.message}"`);
});

bot.on('message_received', (data) => {
  console.log(`📥 Nachricht empfangen: "${data.message}"`);
});

bot.on('chat_ended', () => {
  console.log('🔚 Chat beendet');
});

bot.on('error', (error) => {
  console.error('❌ Fehler:', error);
});

bot.on('completed', () => {
  console.log('✅ Bot-Ausführung abgeschlossen');
});

bot.on('stopped', () => {
  console.log('🛑 Bot gestoppt');
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutdown-Signal empfangen, beende Bot...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Termination-Signal empfangen, beende Bot...');
  await bot.stop();
  process.exit(0);
});

// Bot starten
async function startBot() {
  console.log('🤖 Starte Thundr Bot...');
  console.log('📋 Konfiguration:', {
    ...botConfig,
    proxy: botConfig.proxy ? '***' : null,
    messages: `${botConfig.messages.length} Nachrichten konfiguriert`
  });
  
  try {
    const success = await bot.run();
    if (!success) {
      console.error('❌ Bot-Ausführung fehlgeschlagen');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error);
    await bot.stop();
    process.exit(1);
  }
}

// Entwicklungsmodus mit erweiterten Optionen
if (process.argv.includes('--dev')) {
  console.log('🔧 Entwicklungsmodus aktiviert');
  botConfig.headless = false;
  botConfig.logLevel = 'debug';
}

// Bot starten
startBot(); 