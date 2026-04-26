const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  server: { port: 3000 },
  twitch: { channel: 'YOUR_CHANNEL_NAME', clientId: '', clientSecret: '' },
  youtube: { videoId: '', channelId: '', handle: '' },
  tts: {
    engine: 'piper',
    onlineMode: false,
    voice: 'en_US-lessac-medium',
    speaker: '',
    volume: 80,
    rate: 0,
    paused: false,
    speakUsername: false,
    allowUserVoices: true
  },
  security: {
    maxMessageLength: 200,
    perUserCooldownMs: 5000,
    globalCooldownMs: 2000,
    blockedWords: [],
    blockedUsers: [],
    commandPrefixes: ['!'],
    blockedWordAction: 'censor',
    allowLinks: false,
    stripSsml: true,
    stripZalgo: true,
    stripUnicode: true,
    stripUrls: true
  },
  ui: {
    showLogs: true
  }
};

// Sections that clients are allowed to update
const ALLOWED_SECTIONS = new Set(['tts', 'security', 'twitch', 'youtube', 'ui']);

// Sentinel used in getSafe() responses — never persist this as a real value
const REDACTED_SENTINEL = '***';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Keys that contain secrets and should not be exposed via API
const SECRET_KEYS = new Set(['clientId', 'clientSecret']);

function isValidValueForDefault(value, defaultValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(value);
  }

  if (defaultValue && typeof defaultValue === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  return typeof value === typeof defaultValue;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.slice();
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = cloneValue(nestedValue);
    }
    return result;
  }

  return value;
}

class SettingsManager {
  constructor(configPath) {
    const rootDir = path.join(__dirname, '..', '..');
    const requestedConfigPath = configPath || process.env.BLABBERCAST_CONFIG || '';
    this.exampleConfigPath = configPath ? '' : path.join(rootDir, 'config.example.json');
    this.legacyConfigPath = configPath ? '' : path.join(rootDir, 'config.json');
    this.configPath = requestedConfigPath
      ? (path.isAbsolute(requestedConfigPath) ? requestedConfigPath : path.join(rootDir, requestedConfigPath))
      : path.join(rootDir, 'config.local.json');
    this.settings = this._load();
    this._applyEnvOverrides();
  }

  _applyEnvOverrides() {
    // Prefer environment variables for sensitive credentials
    if (process.env.TWITCH_CLIENT_ID) {
      this.settings.twitch.clientId = process.env.TWITCH_CLIENT_ID;
    }
    if (process.env.TWITCH_CLIENT_SECRET) {
      this.settings.twitch.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    }
  }

  _deepMerge(target, source) {
    const result = cloneValue(target);
    for (const key of Object.keys(source)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      if (!(key in target)) continue;
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else if (isValidValueForDefault(source[key], target[key])) {
        result[key] = cloneValue(source[key]);
      }
    }
    return result;
  }

  _readConfig(filePath) {
    if (!filePath) return {};
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  _load() {
    let settings = cloneValue(DEFAULTS);
    settings = this._deepMerge(settings, this._readConfig(this.exampleConfigPath));
    settings = this._deepMerge(settings, this._readConfig(this.legacyConfigPath));
    settings = this._deepMerge(settings, this._readConfig(this.configPath));
    return settings;
  }

  save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf-8');
  }

  get(section) {
    return section ? this.settings[section] : this.settings;
  }

  /**
   * Returns settings safe for API responses (secrets redacted).
   */
  getSafe(section) {
    const data = section ? this.settings[section] : this.settings;
    return JSON.parse(JSON.stringify(data), (key, value) => {
      if (SECRET_KEYS.has(key) && typeof value === 'string' && value) {
        return '***';
      }
      return value;
    });
  }

  update(section, values) {
    if (!this.settings[section]) return false;
    if (!ALLOWED_SECTIONS.has(section)) return false;

    // Validate types match defaults where possible
    const defaults = DEFAULTS[section] || {};
    for (const [key, val] of Object.entries(values)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      if (!(key in defaults)) continue;
      // Never overwrite a real secret with the redaction sentinel the client echoed back
      if (SECRET_KEYS.has(key) && val === REDACTED_SENTINEL) continue;
      if (!isValidValueForDefault(val, defaults[key])) continue;
      this.settings[section][key] = Array.isArray(val) ? val.slice() : val;
    }

    this.save();
    return true;
  }
}

module.exports = SettingsManager;
