const ThundrBot = require('./bots/thundr-bot');

// Test-Konfiguration für schnelle Überprüfung
const testConfig = {
  headless: false,
  chatMode: 'text', // Text-Chat für einfacheren Test
  interests: ['gaming', 'technology'],
  messages: [
    'Hey! This is a test message.',
    'Testing the Thundr bot!',
    'Hello from the test script!'
  ],
  delay: {
    min: 1000,
    max: 3000
  },
  keepAlive: false, // Nur einmaliger Durchlauf
  autoReconnect: false,
  screenshotOnError: true,
  stealthMode: true,
  logLevel: 'debug'
};

async function runTest() {
  console.log('🧪 Starting Thundr Bot Test...\n');
  
  const bot = new ThundrBot(testConfig);
  
  // Test-Event-Listener
  let eventCount = 0;
  
  bot.on('browser_started', () => {
    console.log('✅ Test 1 passed: Browser started');
    eventCount++;
  });
  
  bot.on('page_loaded', () => {
    console.log('✅ Test 2 passed: Page loaded');
    eventCount++;
  });
  
  bot.on('interests_selected', (data) => {
    console.log(`✅ Test 3 passed: ${data.count} interests selected`);
    eventCount++;
  });
  
  bot.on('chat_started', (data) => {
    console.log(`✅ Test 4 passed: ${data.mode} chat started`);
    eventCount++;
  });
  
  bot.on('message_sent', (data) => {
    console.log(`✅ Test 5 passed: Message sent - "${data.message}"`);
    eventCount++;
  });
  
  bot.on('error', (error) => {
    console.error('❌ Test failed with error:', error);
  });
  
  bot.on('completed', () => {
    console.log('\n📊 Test Summary:');
    console.log(`Total events captured: ${eventCount}`);
    console.log('✅ Bot test completed successfully!\n');
  });
  
  // Führe den Bot aus
  try {
    const success = await bot.run();
    
    if (success) {
      console.log('🎉 All tests passed!');
      
      // Zeige Bot-Statistiken
      const stats = bot.getStats();
      console.log('\n📈 Bot Statistics:');
      console.log(`- Session Duration: ${Math.round(stats.sessionDuration / 1000)}s`);
      console.log(`- Messages Sent: ${stats.messagesSent}`);
      console.log(`- Messages Received: ${stats.messagesReceived}`);
      console.log(`- Reconnect Attempts: ${stats.reconnectAttempts}`);
    } else {
      console.error('❌ Bot test failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error during test:', error);
    process.exit(1);
  }
}

// Führe den Test aus
runTest().catch(console.error); 