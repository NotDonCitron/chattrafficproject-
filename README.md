# Thundr Bot - Video Chat Automation Platform

Ein skalierbarer Bot für [Thundr.com](https://thundr.com/) - eine Omegle-Alternative für Video- und Text-Chats mit Fremden.

## 🚀 Features

- **Video & Text Chat Support**: Automatisierte Teilnahme an Video- oder Text-Chats
- **Interest-Based Matching**: Automatische Auswahl von Interessen für besseres Matching
- **Multi-Account Support**: Unterstützung für mehrere Accounts (in Entwicklung)
- **Proxy Integration**: Eingebaute Proxy-Unterstützung für Anonymität
- **Stealth Mode**: Anti-Detection-Mechanismen
- **Event-Driven Architecture**: Vollständige Event-Emitter-Integration
- **Robuste Fehlerbehandlung**: Auto-Reconnect und Screenshot bei Fehlern
- **Umfassendes Logging**: Winston-basiertes Logging-System

## 📋 Voraussetzungen

- Node.js 16.x oder höher
- npm oder yarn
- Optional: Proxy-Server für anonyme Verbindungen

## 🛠️ Installation

1. Repository klonen:
```bash
git clone <repository-url>
cd chattrafficproject
```

2. Dependencies installieren:
```bash
npm install
```

3. Playwright Browser installieren:
```bash
npx playwright install chromium
```

4. Umgebungsvariablen konfigurieren:
```bash
cp .env.example .env
# Bearbeite .env mit deinen Einstellungen
```

## 🚀 Verwendung

### Einfacher Start

```bash
npm start
```

### Entwicklungsmodus

```bash
npm run dev
```

### Mit benutzerdefinierten Einstellungen

```javascript
const ThundrBot = require('./src/bots/thundr-bot');

const bot = new ThundrBot({
  headless: false,
  chatMode: 'video',
  interests: ['gaming', 'music'],
  messages: ['Hey! How are you?'],
  keepAlive: true
});

bot.run();
```

## ⚙️ Konfiguration

### Umgebungsvariablen (.env)

```env
# Browser
HEADLESS=false
BROWSER_TYPE=chromium

# Proxy (optional)
PROXY_URL=http://proxy:port

# Verhalten
MIN_DELAY=2000
MAX_DELAY=5000
KEEP_ALIVE=false

# Interests (kommagetrennt)
INTERESTS=gaming,music,technology

# Nachrichten (pipe-getrennt)
MESSAGES=Hey!|Hi there!|Hello!

# Chat-Modus
CHAT_MODE=video
SESSION_TIMEOUT=1800000
```

### Konfigurations-Objekt

```javascript
const config = {
  // Browser-Einstellungen
  headless: false,
  proxy: 'http://proxy:port',
  
  // Chat-Einstellungen
  chatMode: 'video', // oder 'text'
  keepAlive: true,
  sessionTimeout: 1800000,
  
  // Nachrichten
  messages: ['Hey!', 'Hi!'],
  interests: ['gaming', 'music'],
  
  // Stealth & Sicherheit
  stealthMode: true,
  autoReconnect: true,
  maxReconnectAttempts: 3
};
```

## 📊 Events

Der Bot emittiert folgende Events:

- `browser_started` - Browser wurde gestartet
- `page_loaded` - Thundr.com wurde geladen
- `interests_selected` - Interessen wurden ausgewählt
- `chat_started` - Chat wurde gestartet
- `partner_connected` - Chat-Partner verbunden
- `message_sent` - Nachricht gesendet
- `message_received` - Nachricht empfangen
- `chat_ended` - Chat beendet
- `error` - Fehler aufgetreten
- `completed` - Bot-Ausführung abgeschlossen

### Event-Beispiel

```javascript
bot.on('message_received', (data) => {
  console.log('Nachricht empfangen:', data.message);
});

bot.on('error', (error) => {
  console.error('Fehler:', error);
});
```

## 🐳 Docker Support

```bash
# Docker Image bauen
docker build -t thundr-bot .

# Container starten
docker run -it --rm thundr-bot
```

## 📁 Projektstruktur

```
chattrafficproject/
├── src/
│   ├── bots/
│   │   └── thundr-bot.js    # Haupt-Bot-Implementierung
│   ├── index.js              # Entry Point
│   └── ...
├── config/
│   └── default.js            # Standard-Konfiguration
├── logs/                     # Log-Dateien
├── screenshots/              # Screenshots bei Fehlern
├── .env                      # Umgebungsvariablen
├── package.json
└── README.md
```

## 🔒 Sicherheit & Ethik

- **Respektiere die Nutzungsbedingungen** von Thundr.com
- **Verwende verantwortungsvoll** - Spam oder Belästigung sind nicht erlaubt
- **Datenschutz beachten** - Keine persönlichen Daten sammeln
- **Rate Limiting** implementiert zur Vermeidung von Überlastung

## 🐛 Debugging

1. **Headless-Modus deaktivieren**:
```env
HEADLESS=false
```

2. **Debug-Logging aktivieren**:
```env
LOG_LEVEL=debug
```

3. **Screenshots bei Fehlern** werden automatisch in `screenshots/` gespeichert

## 📈 Roadmap

- [ ] Multi-Account Management
- [ ] Task Queue mit BullMQ
- [ ] Docker Compose Setup
- [ ] Monitoring Dashboard
- [ ] AI-Integration für intelligentere Gespräche
- [ ] Proxy-Pool-Management
- [ ] Kubernetes Deployment

## 🤝 Contributing

Pull Requests sind willkommen! Bitte stelle sicher, dass dein Code den Projektstandards entspricht.

## 📝 Lizenz

MIT License - siehe LICENSE Datei für Details

## ⚠️ Haftungsausschluss

Dieser Bot ist nur für Bildungs- und Forschungszwecke gedacht. Die Nutzung erfolgt auf eigene Gefahr. Respektiere immer die Nutzungsbedingungen der Zielwebsite. 