const express = require('express');
const createRateLimiter = require('../security/rateLimiter');

// Allowed value ranges for settings (server-side enforcement)
const SETTINGS_RANGES = {
  tts: {
    volume:   { min: 0, max: 100 },
    rate:     { min: -50, max: 50 }
  },
  security: {
    maxMessageLength:  { min: 20, max: 500 },
    perUserCooldownMs: { min: 0, max: 60000 },
    globalCooldownMs:  { min: 0, max: 30000 }
  }
};

const MAX_BLOCKLIST_ITEM_LENGTH = 100;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTtsVoice(values, currentSettings, ttsBridge) {
  if (!values || !ttsBridge || !Array.isArray(ttsBridge.voices) || !ttsBridge.voices.length) return;
  if (!('engine' in values) && !('voice' in values) && !('speaker' in values)) return;

  const engine = values.engine || currentSettings.engine;
  const voice = ('voice' in values) ? values.voice : currentSettings.voice;
  const voicesForEngine = ttsBridge.voices.filter(v => v.engine === engine);
  if (!voicesForEngine.length) return;

  const voiceMatchesEngine = voicesForEngine.some(v => v.id === voice);
  if (!voiceMatchesEngine) {
    values.voice = voicesForEngine[0].id;
  }

  // Speakers are tied to a specific voice — reset when engine/voice changes
  // unless the client explicitly supplied a new speaker in the same update.
  const voiceChanged = 'voice' in values && values.voice !== currentSettings.voice;
  const engineChanged = 'engine' in values && values.engine !== currentSettings.engine;
  if ((voiceChanged || engineChanged) && !('speaker' in values)) {
    values.speaker = '';
  }

  if ('speaker' in values) {
    const resolvedVoice = voicesForEngine.find(v => v.id === values.voice || v.id === voice);
    const speakers = (resolvedVoice && Array.isArray(resolvedVoice.speakers)) ? resolvedVoice.speakers : [];
    if (!speakers.length) {
      values.speaker = '';
    } else if (values.speaker && !speakers.includes(values.speaker)) {
      // Unknown speaker for this voice — fall back to default
      values.speaker = '';
    }
  }
}

function createRoutes(settingsManager, sanitizer, queue, ttsBridge, broadcast, twitchAPI, shutdownFn, apiKey, adapters, processNextMessage, adapterControls) {
  const setupTwitchAdapter = adapterControls && adapterControls.setupTwitchAdapter;
  const setupYouTubeAdapter = adapterControls && adapterControls.setupYouTubeAdapter;
  const getLogs = adapterControls && adapterControls.getLogs;

  const router = express.Router();

  // JSON parsing
  router.use(express.json());

  // Rate limiters
  const standardLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 30 });
  const shutdownLimiter = createRateLimiter({ windowMs: 10000, maxRequests: 1 });

  // --- API Key endpoint (served to same-origin frontend only) ---
  router.get('/api/auth/key', (req, res) => {
    res.json({ key: apiKey });
  });

  // --- Auth middleware for mutating endpoints ---
  function requireAuth(req, res, next) {
    const provided = req.headers['x-api-key'];
    if (!provided || provided !== apiKey) {
      return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
    }
    next();
  }

  // GET /api/settings — return all settings (secrets redacted)
  router.get('/api/settings', (req, res) => {
    res.json(settingsManager.getSafe());
  });

  // PATCH /api/settings — partial update of a section
  router.patch('/api/settings', requireAuth, standardLimiter, (req, res) => {
    const { section, values } = req.body;
    if (!section || !values || typeof values !== 'object' || Array.isArray(values)) {
      return res.status(400).json({ error: 'Requires { section, values }' });
    }

    // Enforce value ranges
    const ranges = SETTINGS_RANGES[section];
    if (ranges) {
      for (const [key, val] of Object.entries(values)) {
        if (ranges[key] && typeof val === 'number') {
          values[key] = clampNumber(val, ranges[key].min, ranges[key].max);
        }
      }
    }

    if (section === 'tts') {
      normalizeTtsVoice(values, settingsManager.get('tts'), ttsBridge);
    }

    const ok = settingsManager.update(section, values);
    if (!ok) return res.status(400).json({ error: 'Invalid or disallowed section' });

    // Sync security settings with sanitizer
    if (section === 'security') {
      sanitizer.updateConfig(settingsManager.get('security'));
    }

    const updated = settingsManager.getSafe();
    broadcast({ type: 'settings', data: updated });
    res.json(updated);
  });

  // GET /api/voices — list available TTS voices
  router.get('/api/voices', async (req, res) => {
    try {
      const voices = await ttsBridge.listVoices();
      res.json(voices);
    } catch {
      res.json(ttsBridge.voices || []);
    }
  });

  // POST /api/tts/pause
  router.post('/api/tts/pause', requireAuth, standardLimiter, (req, res) => {
    settingsManager.update('tts', { paused: true });
    ttsBridge.pause();
    broadcast({ type: 'audio-control', data: { action: 'pause', id: ttsBridge.getActiveSpeakId() } });
    broadcast({ type: 'settings', data: settingsManager.getSafe() });
    res.json({ paused: true });
  });

  // POST /api/tts/resume
  router.post('/api/tts/resume', requireAuth, standardLimiter, (req, res) => {
    settingsManager.update('tts', { paused: false });
    broadcast({ type: 'audio-control', data: { action: 'resume', id: ttsBridge.getActiveSpeakId() } });
    broadcast({ type: 'settings', data: settingsManager.getSafe() });
    if (ttsBridge.isPaused) {
      ttsBridge.resume();
    } else if (processNextMessage) {
      processNextMessage();
    }
    res.json({ paused: false });
  });

  // POST /api/tts/skip — stop current and move to next
  router.post('/api/tts/skip', requireAuth, standardLimiter, (req, res) => {
    broadcast({ type: 'audio-control', data: { action: 'stop', id: ttsBridge.getActiveSpeakId() } });
    ttsBridge.stop();
    res.json({ skipped: true });
  });

  // POST /api/tts/clear — clear the message queue
  router.post('/api/tts/clear', requireAuth, standardLimiter, (req, res) => {
    queue.clear();
    broadcast({ type: 'queue', data: { length: 0 } });
    res.json({ cleared: true });
  });

  router.get('/api/tts/audio/:id', (req, res) => {
    const filePath = ttsBridge.getAudioFilePath(req.params.id);
    if (!filePath) {
      return res.status(404).json({ error: 'Audio not found' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.type(filePath);
    res.sendFile(filePath);
  });

  router.post('/api/tts/browser/start', requireAuth, standardLimiter, (req, res) => {
    const id = req.body && req.body.id;
    res.json({ started: ttsBridge.browserPlaybackStarted(id) });
  });

  router.post('/api/tts/browser/done', requireAuth, standardLimiter, (req, res) => {
    const id = req.body && req.body.id;
    res.json({ done: ttsBridge.browserPlaybackCompleted(id) });
  });

  router.post('/api/tts/browser/error', requireAuth, standardLimiter, (req, res) => {
    const id = req.body && req.body.id;
    const message = req.body && req.body.message;
    res.json({ error: ttsBridge.browserPlaybackFailed(id, message || 'Browser playback error') });
  });

  // POST /api/tts/test — speak a test message immediately
  router.post('/api/tts/test', requireAuth, standardLimiter, (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Requires { text }' });
    }

    // Run through the full sanitizer (blocked words, length, etc.)
    const result = sanitizer.sanitize({ username: 'test', text });
    if (!result.allowed) {
      return res.status(400).json({ error: `Message blocked: ${result.reason}` });
    }
    const sanitized = result.text;

    const id = Date.now().toString(36);
    const entry = {
      id,
      username: 'test',
      text: sanitized,
      timestamp: Date.now(),
      platform: 'dashboard'
    };

    queue.enqueue(entry);
    broadcast({ type: 'message', data: entry });
    broadcast({ type: 'queue', data: { length: queue.length } });
    if (processNextMessage) processNextMessage();

    res.json({ queued: true, id });
  });

  // GET /api/status — connection status
  router.get('/api/status', (req, res) => {
    const platforms = {};
    for (const adapter of (adapters || [])) {
      platforms[adapter.name] = adapter.connected ? 'connected' : 'disconnected';
    }
    res.json({
      ttsReady: ttsBridge.ready,
      ttsSpeaking: ttsBridge.isSpeaking,
      queueLength: queue.length,
      platforms
    });
  });

  router.get('/api/logs', (req, res) => {
    res.json(typeof getLogs === 'function' ? getLogs() : []);
  });

  // GET /api/channel-info — channel name + live viewer count
  router.get('/api/channel-info', async (req, res) => {
    const twitchConfig = settingsManager.get('twitch');
    const info = {
      channel: twitchConfig.channel || '',
      configured: twitchAPI ? twitchAPI.configured : false,
      live: false,
      viewers: 0,
      title: '',
      game: ''
    };

    if (twitchAPI && twitchAPI.configured) {
      const stream = twitchAPI.streamInfo;
      info.live = stream.live;
      info.viewers = stream.viewers;
      info.title = stream.title;
      info.game = stream.game;
    }

    res.json(info);
  });

  // POST /api/blocklist/words — add or remove blocked word
  router.post('/api/blocklist/words', requireAuth, standardLimiter, (req, res) => {
    const { action, word } = req.body;
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Requires { action, word }' });
    }

    if (word.length > MAX_BLOCKLIST_ITEM_LENGTH) {
      return res.status(400).json({ error: `Word must be ${MAX_BLOCKLIST_ITEM_LENGTH} characters or less` });
    }

    if (action === 'add') {
      sanitizer.addBlockedWord(word);
    } else if (action === 'remove') {
      sanitizer.removeBlockedWord(word);
    } else {
      return res.status(400).json({ error: 'Action must be "add" or "remove"' });
    }

    // Persist to config
    const words = sanitizer.getBlockedWords();
    settingsManager.update('security', { blockedWords: words });
    res.json({ blockedWords: words });
  });

  // POST /api/blocklist/users — add or remove blocked user
  router.post('/api/blocklist/users', requireAuth, standardLimiter, (req, res) => {
    const { action, user } = req.body;
    if (!user || typeof user !== 'string') {
      return res.status(400).json({ error: 'Requires { action, user }' });
    }

    if (user.length > MAX_BLOCKLIST_ITEM_LENGTH) {
      return res.status(400).json({ error: `Username must be ${MAX_BLOCKLIST_ITEM_LENGTH} characters or less` });
    }

    if (action === 'add') {
      sanitizer.addBlockedUser(user);
    } else if (action === 'remove') {
      sanitizer.removeBlockedUser(user);
    } else {
      return res.status(400).json({ error: 'Action must be "add" or "remove"' });
    }

    const users = sanitizer.getBlockedUsers();
    settingsManager.update('security', { blockedUsers: users });
    res.json({ blockedUsers: users });
  });

  // POST /api/blocklist/prefixes — add or remove command prefix
  router.post('/api/blocklist/prefixes', requireAuth, standardLimiter, (req, res) => {
    const { action, prefix } = req.body;
    if (!prefix || typeof prefix !== 'string') {
      return res.status(400).json({ error: 'Requires { action, prefix }' });
    }

    if (prefix.length > MAX_BLOCKLIST_ITEM_LENGTH) {
      return res.status(400).json({ error: `Prefix must be ${MAX_BLOCKLIST_ITEM_LENGTH} characters or less` });
    }

    if (action === 'add') {
      sanitizer.addCommandPrefix(prefix);
    } else if (action === 'remove') {
      sanitizer.removeCommandPrefix(prefix);
    } else {
      return res.status(400).json({ error: 'Action must be "add" or "remove"' });
    }

    const prefixes = sanitizer.getCommandPrefixes();
    settingsManager.update('security', { commandPrefixes: prefixes });
    res.json({ commandPrefixes: prefixes });
  });

  // POST /api/twitch/config — save Twitch connection details and reconnect
  router.post('/api/twitch/config', requireAuth, standardLimiter, async (req, res) => {
    const { channel, clientId, clientSecret } = req.body || {};
    const values = {};
    if (typeof channel === 'string') values.channel = channel.trim();
    if (typeof clientId === 'string' && clientId.trim()) values.clientId = clientId.trim();
    if (typeof clientSecret === 'string' && clientSecret.trim()) values.clientSecret = clientSecret.trim();

    if (Object.keys(values).length === 0) {
      return res.status(400).json({ error: 'No Twitch fields provided' });
    }

    const ok = settingsManager.update('twitch', values);
    if (!ok) return res.status(400).json({ error: 'Could not update Twitch settings' });

    if (setupTwitchAdapter) {
      try { await setupTwitchAdapter(); } catch (err) { console.error('[Twitch setup]', err.message || err); }
    }

    const updated = settingsManager.getSafe();
    broadcast({ type: 'settings', data: updated });
    res.json({ saved: true, settings: updated });
  });

  // POST /api/youtube/config — save YouTube connection details and reconnect
  router.post('/api/youtube/config', requireAuth, standardLimiter, async (req, res) => {
    const { handle, channelId, videoId } = req.body || {};
    const values = {};
    if (typeof handle === 'string') values.handle = handle.trim();
    if (typeof channelId === 'string') values.channelId = channelId.trim();
    if (typeof videoId === 'string') values.videoId = videoId.trim();

    if (Object.keys(values).length === 0) {
      return res.status(400).json({ error: 'No YouTube fields provided' });
    }

    const ok = settingsManager.update('youtube', values);
    if (!ok) return res.status(400).json({ error: 'Could not update YouTube settings' });

    if (setupYouTubeAdapter) {
      try { await setupYouTubeAdapter(); } catch (err) { console.error('[YouTube setup]', err.message || err); }
    }

    const updated = settingsManager.getSafe();
    broadcast({ type: 'settings', data: updated });
    res.json({ saved: true, settings: updated });
  });

  // POST /api/youtube/reconnect — re-check for an active YouTube live stream
  router.post('/api/youtube/reconnect', requireAuth, standardLimiter, async (req, res) => {
    const youtubeAdapter = (adapters || []).find(a => a.name === 'youtube');
    if (!youtubeAdapter) {
      // Fall back to (re)creating the adapter from current config
      if (setupYouTubeAdapter) {
        try {
          await setupYouTubeAdapter();
          return res.json({ reconnecting: true });
        } catch (err) {
          return res.status(500).json({ error: err.message || 'Reconnect failed' });
        }
      }
      return res.status(404).json({ error: 'YouTube adapter is not configured' });
    }

    try {
      await youtubeAdapter.reconnect();
      res.json({ reconnecting: true });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Reconnect failed' });
    }
  });

  // POST /api/twitch/reconnect — rebuild the Twitch adapter from current config
  router.post('/api/twitch/reconnect', requireAuth, standardLimiter, async (req, res) => {
    if (!setupTwitchAdapter) {
      return res.status(500).json({ error: 'Twitch reconnect is unavailable' });
    }
    try {
      await setupTwitchAdapter();
      res.json({ reconnecting: true });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Reconnect failed' });
    }
  });

  // POST /api/reconnect — rebuild both adapters from current config
  router.post('/api/reconnect', requireAuth, standardLimiter, async (req, res) => {
    const results = {};
    if (setupTwitchAdapter) {
      try { await setupTwitchAdapter(); results.twitch = 'ok'; }
      catch (err) { results.twitch = err.message || 'failed'; }
    }
    if (setupYouTubeAdapter) {
      try { await setupYouTubeAdapter(); results.youtube = 'ok'; }
      catch (err) { results.youtube = err.message || 'failed'; }
    }
    res.json({ reconnecting: true, results });
  });

  // POST /api/shutdown — gracefully shut down the service
  router.post('/api/shutdown', requireAuth, shutdownLimiter, (req, res) => {
    res.json({ shutting_down: true });
    if (shutdownFn) shutdownFn();
  });

  return router;
}

module.exports = createRoutes;
