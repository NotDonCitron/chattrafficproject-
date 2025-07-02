const { chromium } = require('playwright');
const winston = require('winston');
const UserAgent = require('user-agents');
const { EventEmitter } = require('events');

class ThundrBot extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      headless: config.headless ?? false,
      proxy: config.proxy || null,
      userAgent: config.userAgent || new UserAgent({ deviceCategory: 'desktop' }).toString(),
      interests: config.interests || [],
      messages: config.messages || ['Hey! How are you doing?'],
      delay: config.delay || { min: 2000, max: 5000 },
      keepAlive: config.keepAlive ?? false,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts || 3,
      screenshotOnError: config.screenshotOnError ?? true,
      chatMode: config.chatMode || 'video', // 'video' or 'text'
      sessionTimeout: config.sessionTimeout || 1800000, // 30 minutes
      stealthMode: config.stealthMode ?? true
    };
    
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.sessionStartTime = null;
    this.chatPartner = null;
    this.messageHistory = [];
    
    // Logger setup
    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/thundr-bot.log' })
      ]
    });
  }

  // Zufällige Verzögerung für natürliches Verhalten
  async randomDelay(min = this.config.delay.min, max = this.config.delay.max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Browser mit Stealth-Einstellungen starten
  async start() {
    try {
      this.logger.info('Starting browser...');
      
      const browserOptions = {
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      };

      // Proxy konfigurieren falls vorhanden
      if (this.config.proxy) {
        browserOptions.proxy = {
          server: this.config.proxy
        };
      }

      this.browser = await chromium.launch(browserOptions);

      const contextOptions = {
        userAgent: this.config.userAgent,
        viewport: { 
          width: 1366 + Math.floor(Math.random() * 200), 
          height: 768 + Math.floor(Math.random() * 100) 
        },
        permissions: ['camera', 'microphone'],
        geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York
        locale: 'en-US'
      };

      // Stealth-Mode Einstellungen
      if (this.config.stealthMode) {
        contextOptions.extraHTTPHeaders = {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        };
      }

      this.context = await this.browser.newContext(contextOptions);
      
      // WebRTC-Leak verhindern
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Chrome Runtime überschreiben
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      this.page = await this.context.newPage();
      
      // Event-Listener für Fehlerbehandlung
      this.page.on('pageerror', error => {
        this.logger.error('Page error:', error.message);
        this.emit('error', { type: 'page_error', error: error.message });
      });

      this.page.on('crash', () => {
        this.logger.error('Page crashed!');
        this.emit('crash');
      });

      this.logger.info('Browser started successfully', {
        userAgent: this.config.userAgent,
        viewport: contextOptions.viewport
      });
      
      this.emit('browser_started');
      return true;
    } catch (error) {
      this.logger.error('Failed to start browser:', error);
      this.emit('error', { type: 'browser_start_failed', error: error.message });
      return false;
    }
  }

  // Thundr.com öffnen
  async openThundr() {
    try {
      this.logger.info('Loading Thundr.com...');
      
      await this.page.goto('https://thundr.com/', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Nach dem Laden der Seite: Acknowledgment-Popup schließen, falls vorhanden
      try {
        await this.page.waitForSelector('button:has-text("I Agree")', { timeout: 5000 });
        await this.page.click('button:has-text("I Agree")');
        this.logger.info('Acknowledgment popup closed ("I Agree" clicked)');
        await this.randomDelay(500, 1000);
      } catch (e) {
        this.logger.info('No acknowledgment popup found');
      }
      
      this.logger.info('Thundr.com loaded successfully');
      
      // Warten bis die Hauptelemente geladen sind
      await this.page.waitForLoadState('domcontentloaded');
      await this.randomDelay(2000, 4000);
      
      // Screenshot für Debugging
      if (!this.config.headless) {
        await this.page.screenshot({ 
          path: `screenshots/thundr-home-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      this.emit('page_loaded');
      return true;
    } catch (error) {
      this.logger.error('Failed to load Thundr:', error);
      
      if (this.config.screenshotOnError) {
        await this.page.screenshot({ 
          path: `screenshots/error-${Date.now()}.png` 
        });
      }
      
      this.emit('error', { type: 'page_load_failed', error: error.message });
      return false;
    }
  }

  // Interests wirklich auswählen (und nicht überspringen)
  async selectInterests() {
    try {
      this.logger.info('Looking for interest selection...');
      await this.randomDelay(1000, 2000);

      // Suche nach allen Buttons, die als Interest dienen könnten
      const allButtons = await this.page.$$('button, [role="button"]');
      let interestButtons = [];

      for (const btn of allButtons) {
        const text = await btn.textContent();
        // Filter: Buttons mit kurzem, sinnvollem Text (z.B. Interest-Tags)
        if (text && text.length > 1 && text.length < 30) {
          interestButtons.push(btn);
        }
      }

      if (interestButtons.length === 0) {
        this.logger.warn('No interest buttons found');
        return false;
      }

      // Wähle gezielt deine Interests, oder zufällig, falls nicht konfiguriert
      let selected = 0;
      for (let i = 0; i < interestButtons.length; i++) {
        const btn = interestButtons[i];
        const text = await btn.textContent();
        if (
          this.config.interests.length === 0 ||
          this.config.interests.some(interest =>
            text.toLowerCase().includes(interest.toLowerCase())
          )
        ) {
          await btn.click();
          this.logger.info(`Selected interest: ${text.trim()}`);
          selected++;
          await this.randomDelay(500, 1000);
          if (selected >= (this.config.interests.length || 5)) break; // max 5 Interests
        }
      }

      this.logger.info(`Selected ${selected} interests`);
      this.emit('interests_selected', { count: selected });
      return true;
    } catch (error) {
      this.logger.error('Error selecting interests:', error);
      this.emit('error', { type: 'interest_selection_failed', error: error.message });
      return false;
    }
  }

  // Chat-Modus starten (Video oder Text)
  async startChat() {
    try {
      const mode = this.config.chatMode;
      this.logger.info(`Starting ${mode} chat...`);
      
      // Selektoren basierend auf der Website-Analyse
      const chatButtonSelectors = {
        video: [
          'button:has-text("Video Chat")',
          'a:has-text("Video Chat")',
          '[data-action="video-chat"]',
          '.video-chat-button',
          'button[class*="video"]'
        ],
        text: [
          'button:has-text("Text Chat")',
          'a:has-text("Text Chat")',
          '[data-action="text-chat"]',
          '.text-chat-button',
          'button[class*="text"]'
        ]
      };
      
      const selectors = chatButtonSelectors[mode] || chatButtonSelectors.video;
      let chatButton = null;
      
      for (const selector of selectors) {
        try {
          chatButton = await this.page.waitForSelector(selector, { 
            timeout: 5000,
            state: 'visible' 
          });
          if (chatButton) {
            this.logger.info(`Found chat button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!chatButton) {
        // Fallback: Suche nach Text
        const buttonText = mode === 'video' ? 'Video Chat' : 'Text Chat';
        chatButton = await this.page.locator(`text="${buttonText}"`).first();
      }
      
      if (chatButton) {
        await chatButton.click();
        this.logger.info(`${mode} chat started`);
        this.emit('chat_started', { mode });

        // Nach dem Klick auf Video Chat: Acknowledgment-Popup schließen, falls vorhanden
        try {
          await this.page.waitForSelector('button:has-text("I Agree")', { timeout: 5000 });
          await this.page.click('button:has-text("I Agree")');
          this.logger.info('Acknowledgment popup closed ("I Agree" clicked)');
          await this.randomDelay(500, 1000);
        } catch (e) {
          this.logger.info('No acknowledgment popup found');
        }

        // Entry-Formular ausfüllen
        await this.fillEntryForm();

        this.sessionStartTime = Date.now();
        this.isConnected = true;

        await this.randomDelay(3000, 5000);
        return true;
      } else {
        throw new Error(`${mode} chat button not found`);
      }
    } catch (error) {
      this.logger.error('Failed to start chat:', error);
      this.emit('error', { type: 'chat_start_failed', error: error.message });
      return false;
    }
  }

  // Warten auf Chat-Partner
  async waitForPartner() {
    try {
      this.logger.info('Waiting for chat partner...');
      
      // Verschiedene Indikatoren für eine aktive Verbindung
      const partnerIndicators = [
        '.partner-connected',
        '.user-connected',
        '[data-status="connected"]',
        '.video-container.active',
        '.stranger-video',
        'video:not([src=""])',
        '.chat-messages',
        '.chat-active'
      ];
      
      const timeout = 30000; // 30 Sekunden Timeout
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        for (const selector of partnerIndicators) {
          try {
            const element = await this.page.$(selector);
            if (element && await element.isVisible()) {
              this.logger.info('Partner connected!');
              this.emit('partner_connected');
              this.chatPartner = { connectedAt: new Date() };
              return true;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Prüfe auf "Searching..." oder ähnliche Meldungen
        const searchingText = await this.page.locator('text=/searching|looking|connecting/i').count();
        if (searchingText > 0) {
          this.logger.debug('Still searching for partner...');
        }
        
        await this.randomDelay(1000, 2000);
      }
      
      this.logger.warn('Timeout waiting for partner');
      return false;
    } catch (error) {
      this.logger.error('Error waiting for partner:', error);
      return false;
    }
  }

  // Chat-Interface finden
  async findChatInterface() {
    try {
      this.logger.info('Looking for chat interface...');
      
      const chatInputSelectors = [
        'input[placeholder*="message" i]',
        'input[placeholder*="type" i]',
        'textarea[placeholder*="message" i]',
        'input.chat-input',
        'textarea.chat-input',
        '#message-input',
        '[data-testid="chat-input"]',
        '.message-input',
        'input[type="text"]:visible'
      ];
      
      for (const selector of chatInputSelectors) {
        try {
          const input = await this.page.waitForSelector(selector, { 
            timeout: 5000,
            state: 'visible' 
          });
          if (input) {
            this.logger.info(`Found chat input: ${selector}`);
            return { input, selector };
          }
        } catch (e) {
          continue;
        }
      }
      
      this.logger.warn('Chat input not found');
      return null;
    } catch (error) {
      this.logger.error('Error finding chat interface:', error);
      return null;
    }
  }

  // Nachricht senden mit verbesserter Logik
  async sendMessage(message) {
    try {
      const chatInterface = await this.findChatInterface();
      if (!chatInterface) {
        this.logger.error('Cannot send message: chat interface not found');
        return false;
      }
      
      this.logger.info(`Sending message: "${message}"`);
      
      // Nachricht eingeben mit natürlicher Geschwindigkeit
      await chatInterface.input.click();
      await this.randomDelay(500, 1000);
      
      // Lösche vorhandenen Text
      await this.page.keyboard.press('Control+A');
      await this.page.keyboard.press('Delete');
      
      // Tippe die Nachricht
      if (this.config.stealthMode) {
        // Simuliere natürliches Tippen
        for (const char of message) {
          await chatInterface.input.type(char);
          await this.randomDelay(50, 150);
        }
      } else {
        await chatInterface.input.fill(message);
      }
      
      await this.randomDelay(500, 1000);
      
      // Sende die Nachricht
      const sent = await this.trySendMessage(chatInterface);
      
      if (sent) {
        this.messageHistory.push({
          type: 'sent',
          message: message,
          timestamp: new Date()
        });
        this.logger.info('Message sent successfully');
        this.emit('message_sent', { message });
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      this.emit('error', { type: 'message_send_failed', error: error.message });
      return false;
    }
  }

  // Hilfsfunktion zum Senden der Nachricht
  async trySendMessage(chatInterface) {
    // Versuche Enter zu drücken
    try {
      await this.page.keyboard.press('Enter');
      await this.randomDelay(500, 1000);
      
      // Prüfe ob das Input-Feld geleert wurde
      const value = await chatInterface.input.inputValue();
      if (value === '') {
        return true;
      }
    } catch (e) {
      this.logger.debug('Enter key did not work, trying send button');
    }
    
    // Versuche Send-Button zu finden
    const sendButtonSelectors = [
      'button:has-text("Send")',
      'button[aria-label*="send" i]',
      '.send-button',
      'button[type="submit"]',
      'button.submit',
      '[data-action="send"]'
    ];
    
    for (const selector of sendButtonSelectors) {
      try {
        const sendBtn = await this.page.$(selector);
        if (sendBtn && await sendBtn.isVisible()) {
          await sendBtn.click();
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }

  // Chat-Nachrichten lesen
  async readMessages() {
    try {
      const messageSelectors = [
        '.message',
        '.chat-message',
        '[data-message]',
        '.msg',
        '.chat-bubble'
      ];
      
      for (const selector of messageSelectors) {
        const messages = await this.page.$$(selector);
        if (messages.length > 0) {
          for (const msg of messages) {
            const text = await msg.textContent();
            const isOwn = await msg.evaluate(el => 
              el.classList.contains('own') || 
              el.classList.contains('sent') ||
              el.dataset.sender === 'self'
            );
            
            // Füge neue Nachrichten zur Historie hinzu
            const exists = this.messageHistory.some(m => 
              m.message === text.trim() && m.type === (isOwn ? 'sent' : 'received')
            );
            
            if (!exists && text.trim()) {
              this.messageHistory.push({
                type: isOwn ? 'sent' : 'received',
                message: text.trim(),
                timestamp: new Date()
              });
              
              if (!isOwn) {
                this.logger.info(`Received message: "${text.trim()}"`);
                this.emit('message_received', { message: text.trim() });
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error reading messages:', error);
    }
  }

  // Nächsten Chat starten
  async nextChat() {
    try {
      this.logger.info('Moving to next chat...');
      
      const nextButtonSelectors = [
        'button:has-text("Next")',
        'button:has-text("New")',
        'button:has-text("Skip")',
        '.next-button',
        '[data-action="next"]',
        'button.skip'
      ];
      
      for (const selector of nextButtonSelectors) {
        try {
          const nextBtn = await this.page.$(selector);
          if (nextBtn && await nextBtn.isVisible()) {
            await nextBtn.click();
            this.logger.info('Clicked next button');
            
            // Reset Chat-Status
            this.chatPartner = null;
            this.messageHistory = [];
            this.emit('chat_ended');
            
            await this.randomDelay(2000, 4000);
            return true;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Fallback: ESC drücken (funktioniert auf manchen Plattformen)
      await this.page.keyboard.press('Escape');
      await this.randomDelay(1000, 2000);
      
      return true;
    } catch (error) {
      this.logger.error('Error moving to next chat:', error);
      return false;
    }
  }

  // Hauptloop für kontinuierliches Chatten
  async runChatLoop() {
    try {
      while (this.config.keepAlive && this.isConnected) {
        // Prüfe Session-Timeout
        if (Date.now() - this.sessionStartTime > this.config.sessionTimeout) {
          this.logger.info('Session timeout reached');
          break;
        }
        
        // Warte auf Partner
        const hasPartner = await this.waitForPartner();
        if (!hasPartner) {
          await this.nextChat();
          continue;
        }
        
        // Sende eine zufällige Nachricht
        const randomMessage = this.config.messages[
          Math.floor(Math.random() * this.config.messages.length)
        ];
        
        await this.randomDelay(2000, 4000);
        await this.sendMessage(randomMessage);
        
        // Chat-Interaktion für eine Weile
        const chatDuration = 30000 + Math.random() * 60000; // 30-90 Sekunden
        const chatEndTime = Date.now() + chatDuration;
        
        while (Date.now() < chatEndTime && this.isConnected) {
          await this.readMessages();
          
          // Gelegentlich antworten
          if (Math.random() < 0.3 && this.messageHistory.length > 1) {
            const responses = [
              "That's interesting!",
              "Tell me more about that",
              "Cool! What else?",
              "I see what you mean",
              "That's awesome!"
            ];
            const response = responses[Math.floor(Math.random() * responses.length)];
            await this.sendMessage(response);
          }
          
          await this.randomDelay(3000, 5000);
        }
        
        // Zum nächsten Chat
        await this.nextChat();
        await this.randomDelay(3000, 5000);
      }
    } catch (error) {
      this.logger.error('Error in chat loop:', error);
      this.emit('error', { type: 'chat_loop_error', error: error.message });
    }
  }

  // Hauptfunktion
  async run() {
    try {
      this.logger.info('Starting Thundr Bot...');
      
      // Browser starten
      if (!await this.start()) {
        throw new Error('Failed to start browser');
      }
      
      // Thundr öffnen
      if (!await this.openThundr()) {
        throw new Error('Failed to open Thundr');
      }
      
      // Interests auswählen
      await this.selectInterests();
      
      // Chat starten
      if (!await this.startChat()) {
        throw new Error('Failed to start chat');
      }
      
      // Wenn keepAlive aktiviert ist, starte Chat-Loop
      if (this.config.keepAlive) {
        this.logger.info('Starting continuous chat mode...');
        await this.runChatLoop();
      } else {
        // Einmaliger Chat
        if (await this.waitForPartner()) {
          const message = this.config.messages[
            Math.floor(Math.random() * this.config.messages.length)
          ];
          await this.sendMessage(message);
          
          // Warte eine Weile für Interaktion
          await this.randomDelay(10000, 20000);
        }
      }
      
      this.logger.info('Bot execution completed successfully');
      this.emit('completed');
      
      // Beende nach einer kurzen Verzögerung
      if (!this.config.keepAlive) {
        await this.randomDelay(3000, 5000);
        await this.stop();
      }
      
      return true;
    } catch (error) {
      this.logger.error('Bot execution failed:', error);
      this.emit('error', { type: 'execution_failed', error: error.message });
      
      if (this.config.screenshotOnError && this.page) {
        await this.page.screenshot({ 
          path: `screenshots/error-${Date.now()}.png` 
        });
      }
      
      // Auto-Reconnect wenn konfiguriert
      if (this.config.autoReconnect && 
          this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.logger.info(`Attempting reconnect ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}...`);
        await this.stop();
        await this.randomDelay(5000, 10000);
        return await this.run();
      }
      
      await this.stop();
      return false;
    }
  }

  // Browser beenden
  async stop() {
    try {
      this.isConnected = false;
      
      if (this.page) {
        await this.page.close();
      }
      
      if (this.context) {
        await this.context.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      this.logger.info('Browser closed successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error closing browser:', error);
    }
  }
  
  // Statistiken abrufen
  getStats() {
    return {
      sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
      messagesSent: this.messageHistory.filter(m => m.type === 'sent').length,
      messagesReceived: this.messageHistory.filter(m => m.type === 'received').length,
      reconnectAttempts: this.reconnectAttempts,
      isConnected: this.isConnected
    };
  }

  async fillEntryForm() {
    try {
      this.logger.info('Filling entry form (gender, looking for, birthdate, terms)...');
      await this.randomDelay(1000, 2000);

      // 1. Female auswählen (robust: alle Spans prüfen)
      let femaleSelected = false;
      const genderSpans = await this.page.$$('span[data-scope="radio-group"][data-part="item-control"]');
      for (const span of genderSpans) {
        const label = await span.evaluate(el => el.parentElement?.textContent?.trim() || '');
        if (/female/i.test(label)) {
          await span.click();
          this.logger.info('Clicked Female span radio (label: ' + label + ')');
          femaleSelected = true;
          break;
        }
      }
      if (!femaleSelected) {
        // Fallback: input radio
        const femaleRadio = await this.page.$('input[type="radio"][value="Female"], input[name="gender"][value="Female"]');
        if (femaleRadio) {
          await femaleRadio.check();
          this.logger.info('Selected: Female (input)');
        } else {
          this.logger.warn('Female radio button not found');
        }
      }

      // 2. Looking for: Everyone (robust: alle Spans prüfen)
      let everyoneSelected = false;
      const lookingForSpans = await this.page.$$('span[data-scope="radio-group"][data-part="item-control"]');
      for (const span of lookingForSpans) {
        const label = await span.evaluate(el => el.parentElement?.textContent?.trim() || '');
        if (/everyone|alle|all/i.test(label)) {
          await span.click();
          this.logger.info('Clicked Everyone span radio (label: ' + label + ')');
          everyoneSelected = true;
          break;
        }
      }
      if (!everyoneSelected && lookingForSpans.length > 0) {
        // Fallback: Klicke das erste, falls kein Label gefunden
        await lookingForSpans[0].click();
        this.logger.info('Clicked first span for Looking For as fallback');
        everyoneSelected = true;
      }
      if (!everyoneSelected) {
        // Fallback: input radio
        const everyoneRadio = await this.page.$('input[type="radio"][value="Everyone"], input[name="lookingFor"][value="Everyone"]');
        if (everyoneRadio) {
          await everyoneRadio.check();
          this.logger.info('Selected: Looking for Everyone (input)');
        } else {
          this.logger.warn('Looking for Everyone radio button not found');
        }
      }

      // 3. Geburtsdatum eintragen
      const dayInput = await this.page.$('input[placeholder="DD"], input[name="day"], input[id*="day"]');
      const monthInput = await this.page.$('input[placeholder="MM"], input[name="month"], input[id*="month"]');
      const yearInput = await this.page.$('input[placeholder="YYYY"], input[name="year"], input[id*="year"]');
      if (dayInput && monthInput && yearInput) {
        await dayInput.fill('07');
        await monthInput.fill('12');
        await yearInput.fill('2002');
        this.logger.info('Filled date of birth: 07.12.2002');
      } else {
        this.logger.warn('Date of birth inputs not found');
      }

      // 4. Checkbox für Terms anhaken (SVG oder Parent klicken)
      let termsChecked = false;
      const svgCheckbox = await this.page.$('svg[data-state="unchecked"].css-wuqtn7');
      if (svgCheckbox) {
        await svgCheckbox.click();
        this.logger.info('Clicked SVG terms checkbox');
        termsChecked = true;
      } else {
        // Fallback: Versuche das Input-Element
        const termsCheckbox = await this.page.$('input[type="checkbox"], input[name*="terms"], input[id*="terms"]');
        if (termsCheckbox) {
          await termsCheckbox.check();
          this.logger.info('Checked terms of service (input)');
          termsChecked = true;
        } else {
          this.logger.warn('Terms of service checkbox not found');
        }
      }

      await this.randomDelay(500, 1000);

      // 5. Start-Button klicken (gezielt die Chakra-Button-Klasse)
      const startBtn = await this.page.$('button.chakra-button.css-fw0t89, button:has-text("Start"), button[type="submit"], button:has-text("Continue")');
      if (startBtn) {
        await startBtn.click();
        this.logger.info('Clicked Start button');
      } else {
        this.logger.warn('Start button not found');
      }

      await this.randomDelay(1000, 2000);
      this.logger.info('Entry form filled and submitted!');
      return true;
    } catch (error) {
      this.logger.error('Error filling entry form:', error);
      return false;
    }
  }
}

module.exports = ThundrBot; 