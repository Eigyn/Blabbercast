const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const SettingsManager = require('./src/settings/SettingsManager');
const Sanitizer = require('./src/security/Sanitizer');
const MessageQueue = require('./src/queue/MessageQueue');
const TTSBridge = require('./src/tts/TTSBridge');
const TwitchAPI = require('./src/twitch/TwitchAPI');
const { createAdapter } = require('./src/adapters');
const UserVoiceMap = require('./src/tts/UserVoiceMap');
const createRoutes = require('./src/server/routes');
const createWebSocket = require('./src/server/websocket');
const createLogRelay = require('./src/server/logRelay');

// --- Init ---
const API_KEY = crypto.randomBytes(32).toString('hex');
const settings = new SettingsManager();
const sanitizer = new Sanitizer(settings.get('security'));
const queue = new MessageQueue(50);
const tts = new TTSBridge();
const twitchAPI = new TwitchAPI(settings.get('twitch'));
const userVoices = new UserVoiceMap(500);

function fuzzyMatchVoice(query, voices) {
  if (!voices || !voices.length) return null;
  const q = query.toLowerCase();
  // Exact ID match
  let match = voices.find(v => v.id.toLowerCase() === q);
  if (match) return match;
  // Exact name match
  match = voices.find(v => v.name.toLowerCase() === q);
  if (match) return match;
  // Partial match (contains)
  match = voices.find(v => v.id.toLowerCase().includes(q) || v.name.toLowerCase().includes(q));
  return match || null;
}

function piperModelExists(voice) {
  if (!voice) return false;
  const modelPath = path.isAbsolute(voice)
    ? voice
    : path.join(__dirname, 'models', voice.endsWith('.onnx') ? voice : `${voice}.onnx`);
  return fs.existsSync(modelPath);
}

function fallbackVoiceForEngine(engine) {
  const known = (tts.voices || []).find(v => v.engine === engine);
  if (known) return known.id;

  if (engine === 'piper') {
    const defaultVoice = 'en_US-lessac-medium';
    if (piperModelExists(defaultVoice)) return defaultVoice;

    try {
      const model = fs.readdirSync(path.join(__dirname, 'models')).find(f => f.endsWith('.onnx'));
      if (model) return path.basename(model, '.onnx');
    } catch {}
  }

  return '';
}

function resolveVoiceForEngine(engine, voice) {
  const knownVoices = tts.voices || [];
  const voicesForEngine = knownVoices.filter(v => v.engine === engine);
  if (voicesForEngine.length) {
    const match = voicesForEngine.find(v => v.id === voice);
    return match ? voice : fallbackVoiceForEngine(engine);
  }

  if (engine === 'piper') {
    return piperModelExists(voice) ? voice : fallbackVoiceForEngine(engine);
  }

  return voice || fallbackVoiceForEngine(engine);
}

// --- Express + HTTP ---
const app = express();
const server = http.createServer(app);

const port = settings.get('server').port;
const allowedOrigins = new Set([
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`
]);

const { broadcast } = createWebSocket(server, allowedOrigins);
const logRelay = createLogRelay(broadcast);

// --- Security Headers ---
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* ws://127.0.0.1:*");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// --- CORS: only allow requests from localhost ---
app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (same-origin, curl, non-browser)
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
}));

// Adapter list — populated below, passed by reference so routes can access it
const adapters = [];

app.use(express.static(path.join(__dirname, 'public')));
app.use(createRoutes(settings, sanitizer, queue, tts, broadcast, twitchAPI, shutdown, API_KEY, adapters, processNextMessage, {
  setupTwitchAdapter: () => setupTwitchAdapter(),
  setupYouTubeAdapter: () => setupYouTubeAdapter(),
  getLogs: () => logRelay.getEntries()
}));

// --- TTS Events ---
tts.on('ready', () => {
  console.log('[TTS] Python worker ready');
  processNextMessage();
});

tts.on('audio_ready', (audio) => {
  broadcast({ type: 'audio-ready', data: audio });
});

tts.on('speaking', (id) => {
  broadcast({ type: 'speaking', data: { id } });
});

tts.on('done', (id) => {
  broadcast({ type: 'done', data: { id } });
  broadcast({ type: 'queue', data: { length: queue.length } });
  // Event-driven: process next message when TTS finishes
  processNextMessage();
});

tts.on('error', (id, message) => {
  console.error('[TTS Error]', message);
  // Try next message even on error
  processNextMessage();
});

// --- Shared message handler for all chat adapters ---
function handleChatMessage(msg) {
  // Intercept !voice command before sanitization
  const trimmed = msg.text.trim();
  if (settings.get('tts').allowUserVoices !== false && trimmed.toLowerCase().startsWith('!voice ')) {
    const requested = trimmed.substring(7).trim();
    if (requested) {
      const matched = fuzzyMatchVoice(requested, tts.voices);
      if (matched) {
        userVoices.set(msg.username, matched.id);
        broadcast({ type: 'voice-set', data: { username: msg.username, voice: matched.name, success: true } });
      } else {
        broadcast({ type: 'voice-set', data: { username: msg.username, query: requested, success: false } });
      }
    }
    return;
  }

  const result = sanitizer.sanitize(msg);
  if (!result.allowed) return;

  const entry = { ...msg, text: result.text, id: Date.now().toString(36), voice: userVoices.get(msg.username) };
  queue.enqueue(entry);

  broadcast({ type: 'message', data: entry });
  broadcast({ type: 'queue', data: { length: queue.length } });
}

// --- Event-Driven TTS Processing ---
function processNextMessage() {
  const ttsSettings = settings.get('tts');
  if (ttsSettings.paused || tts.isSpeaking || queue.isEmpty) return;

  // Lazy-start: TTS bridge starts on first use
  if (!tts.ready && !tts._started) {
    tts.start();
    // Wait for ready event before processing
    tts.once('ready', () => processNextMessage());
    return;
  }

  if (!tts.ready) return;

  const msg = queue.dequeue();
  if (!msg) return;

  // Prepend username if enabled
  let speakText = msg.text;
  if (ttsSettings.speakUsername && msg.username) {
    speakText = `${msg.username} said: ${msg.text}`;
  }

  const configuredVoice = resolveVoiceForEngine(ttsSettings.engine, ttsSettings.voice);
  const userVoice = (ttsSettings.allowUserVoices !== false && msg.voice)
    ? resolveVoiceForEngine(ttsSettings.engine, msg.voice)
    : '';
  const voice = userVoice || configuredVoice;

  if (configuredVoice && configuredVoice !== ttsSettings.voice) {
    settings.update('tts', { voice: configuredVoice });
    broadcast({ type: 'settings', data: settings.getSafe() });
  }

  tts.speak(
    speakText,
    ttsSettings.engine,
    voice,
    ttsSettings.rate,
    ttsSettings.volume,
    msg.id,
    ttsSettings.speaker || ''
  );

  broadcast({ type: 'queue', data: { length: queue.length } });
}

// Trigger processing when a message is enqueued
queue.on('enqueued', () => processNextMessage());

// --- Chat Adapters ---
// Removes any existing adapter with the given name, tearing it down cleanly.
async function removeAdapter(name) {
  for (let i = adapters.length - 1; i >= 0; i--) {
    if (adapters[i].name === name) {
      try { await adapters[i].disconnect(); } catch (err) { console.error(`[${name}] Disconnect error:`, err.message || err); }
      adapters.splice(i, 1);
    }
  }
}

async function setupTwitchAdapter() {
  await removeAdapter('twitch');
  const twitchConfig = settings.get('twitch');
  if (!twitchConfig.channel || twitchConfig.channel === 'YOUR_CHANNEL_NAME') {
    console.log('[Twitch] No channel configured. Set "channel" in the dashboard or config.local.json');
    broadcast({ type: 'status', data: { platform: 'twitch', state: 'disconnected' } });
    return;
  }

  // Refresh TwitchAPI credentials if they changed
  if (typeof twitchAPI.updateConfig === 'function') {
    twitchAPI.updateConfig(twitchConfig);
  }

  const twitchAdapter = createAdapter('twitch', twitchConfig);
  twitchAdapter.on('message', handleChatMessage);
  twitchAdapter.on('connected', () => {
    console.log(`[Twitch] Connected to #${twitchConfig.channel}`);
    broadcast({ type: 'status', data: { platform: 'twitch', state: 'connected' } });
  });
  twitchAdapter.on('disconnected', () => {
    console.log('[Twitch] Disconnected');
    broadcast({ type: 'status', data: { platform: 'twitch', state: 'disconnected' } });
  });
  twitchAdapter.on('error', (err) => {
    console.error('[Twitch Error]', err.message || err);
  });

  adapters.push(twitchAdapter);
  await twitchAdapter.connect();
}

async function setupYouTubeAdapter() {
  await removeAdapter('youtube');
  const youtubeConfig = settings.get('youtube');
  if (!youtubeConfig.videoId && !youtubeConfig.channelId && !youtubeConfig.handle) {
    console.log('[YouTube] No video/channel/handle configured. Set "youtube" in the dashboard or config.local.json');
    broadcast({ type: 'status', data: { platform: 'youtube', state: 'disconnected' } });
    return;
  }

  const youtubeAdapter = createAdapter('youtube', youtubeConfig);
  youtubeAdapter.on('message', handleChatMessage);
  youtubeAdapter.on('connected', () => {
    console.log(`[YouTube] Connected to live chat (video: ${youtubeAdapter.liveId})`);
    broadcast({ type: 'status', data: { platform: 'youtube', state: 'connected' } });
  });
  youtubeAdapter.on('disconnected', () => {
    console.log('[YouTube] Disconnected');
    broadcast({ type: 'status', data: { platform: 'youtube', state: 'disconnected' } });
  });
  youtubeAdapter.on('error', (err) => {
    console.error('[YouTube Error]', err.message || err);
  });

  adapters.push(youtubeAdapter);
  await youtubeAdapter.connect();
}

setupTwitchAdapter();
setupYouTubeAdapter();

// --- Twitch API (viewer count polling) ---
twitchAPI.on('update', (info) => {
  broadcast({ type: 'channel-info', data: info });
});
twitchAPI.startPolling(60000);

// --- Start (no eager TTS spawn — lazy start on first message) ---
server.listen(port, '127.0.0.1', () => {
  console.log(`[Server] Blabbercast running at http://localhost:${port}`);
  console.log('[Server] Bound to 127.0.0.1 (localhost only)');

  // Auto-open browser if --open flag passed
  if (process.argv.includes('--open')) {
    exec(`start http://localhost:${port}`);
  }
});

// --- Graceful Shutdown ---
function shutdown() {
  console.log('\n[Server] Shutting down...');
  tts.shutdown();
  twitchAPI.stopPolling();
  for (const adapter of adapters) {
    adapter.disconnect();
  }
  server.close();
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
