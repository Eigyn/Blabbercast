// Zero-width and directional unicode characters to strip
const DANGEROUS_UNICODE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\uD800-\uDFFF]/g;

// SSML / HTML tags
const TAGS = /<[^>]*>/g;

// URL patterns
const URLS = /https?:\/\/\S+|www\.\S+/gi;

// Zalgo: 4+ consecutive combining marks per base character
const ZALGO = /\p{M}{4,}/u;

function stringArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback.slice();
  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
}

function blockedWordAction(value) {
  return value === 'block' ? 'block' : 'censor';
}

class Sanitizer {
  constructor(config = {}) {
    this.maxLength = config.maxMessageLength || 200;
    this.perUserCooldownMs = config.perUserCooldownMs ?? 5000;
    this.globalCooldownMs = config.globalCooldownMs ?? 2000;
    this.allowLinks = config.allowLinks || false;

    // Togglable security features
    this.stripSsml = config.stripSsml !== false;
    this.stripZalgo = config.stripZalgo !== false;
    this.stripUnicode = config.stripUnicode !== false;
    this.stripUrls = config.stripUrls !== false;

    this._blockedWords = new Set(stringArray(config.blockedWords).map(w => w.toLowerCase()));
    this._blockedUsers = new Set(stringArray(config.blockedUsers).map(u => u.toLowerCase()));
    this._commandPrefixes = stringArray(config.commandPrefixes, ['!']);
    this.blockedWordAction = blockedWordAction(config.blockedWordAction);

    this._userCooldowns = new Map();
    this._globalLast = 0;
  }

  updateConfig(config) {
    if (config.maxMessageLength !== undefined) this.maxLength = config.maxMessageLength;
    if (config.perUserCooldownMs !== undefined) this.perUserCooldownMs = config.perUserCooldownMs;
    if (config.globalCooldownMs !== undefined) this.globalCooldownMs = config.globalCooldownMs;
    if (config.allowLinks !== undefined) this.allowLinks = config.allowLinks;
    if (config.stripSsml !== undefined) this.stripSsml = config.stripSsml;
    if (config.stripZalgo !== undefined) this.stripZalgo = config.stripZalgo;
    if (config.stripUnicode !== undefined) this.stripUnicode = config.stripUnicode;
    if (config.stripUrls !== undefined) this.stripUrls = config.stripUrls;
    if (config.blockedWords !== undefined) this._blockedWords = new Set(stringArray(config.blockedWords).map(w => w.toLowerCase()));
    if (config.blockedUsers !== undefined) this._blockedUsers = new Set(stringArray(config.blockedUsers).map(u => u.toLowerCase()));
    if (config.commandPrefixes !== undefined) this._commandPrefixes = stringArray(config.commandPrefixes, ['!']);
    if (config.blockedWordAction !== undefined) this.blockedWordAction = blockedWordAction(config.blockedWordAction);
  }

  addBlockedWord(word) {
    this._blockedWords.add(word.toLowerCase());
  }

  removeBlockedWord(word) {
    this._blockedWords.delete(word.toLowerCase());
  }

  addBlockedUser(user) {
    this._blockedUsers.add(user.toLowerCase());
  }

  removeBlockedUser(user) {
    this._blockedUsers.delete(user.toLowerCase());
  }

  getBlockedWords() {
    return [...this._blockedWords];
  }

  getBlockedUsers() {
    return [...this._blockedUsers];
  }

  addCommandPrefix(prefix) {
    if (!this._commandPrefixes.includes(prefix)) {
      this._commandPrefixes.push(prefix);
    }
  }

  removeCommandPrefix(prefix) {
    this._commandPrefixes = this._commandPrefixes.filter(p => p !== prefix);
  }

  getCommandPrefixes() {
    return [...this._commandPrefixes];
  }

  sanitize(message) {
    const now = Date.now();
    const username = (message.username || '').toLowerCase();
    const rawText = (message.text || '').trimStart();

    // 1. Command prefix check (cheapest check first, before cooldowns)
    for (const prefix of this._commandPrefixes) {
      if (rawText.startsWith(prefix)) {
        return { allowed: false, text: '', reason: 'command_prefix' };
      }
    }

    // 2. Blocked user check
    if (this._blockedUsers.has(username)) {
      return { allowed: false, text: '', reason: 'blocked_user' };
    }

    // 3. Per-user cooldown
    const lastUser = this._userCooldowns.get(username) || 0;
    if (now - lastUser < this.perUserCooldownMs) {
      return { allowed: false, text: '', reason: 'user_cooldown' };
    }

    // 4. Global cooldown
    if (now - this._globalLast < this.globalCooldownMs) {
      return { allowed: false, text: '', reason: 'global_cooldown' };
    }

    let text = message.text || '';

    // 5. Truncate length
    text = text.substring(0, this.maxLength);

    // 6. Strip SSML/HTML tags
    if (this.stripSsml) {
      text = text.replace(TAGS, '');
    }

    // 7. Strip dangerous unicode
    if (this.stripUnicode) {
      text = text.replace(DANGEROUS_UNICODE, '');
    }

    // 8. Block messages containing Zalgo combining marks
    if (this.stripZalgo) {
      text = text.normalize('NFC');
      if (ZALGO.test(text)) {
        return { allowed: false, text: '', reason: 'zalgo' };
      }
    }

    // 9. Strip URLs
    if (this.stripUrls && !this.allowLinks) {
      text = text.replace(URLS, '');
    }

    // 10. Blocked words check
    for (const word of this._blockedWords) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'gi');
      if (re.test(text)) {
        if (this.blockedWordAction === 'block') {
          return { allowed: false, text: '', reason: 'blocked_word' };
        }
        // Censor: remove the blocked word from the text
        text = text.replace(re, '').replace(/\s{2,}/g, ' ');
      }
    }

    // 11. Strip newlines/carriage returns (defense-in-depth for IPC safety)
    text = text.replace(/[\r\n]/g, ' ');

    // 12. Empty check after sanitization
    text = text.trim();
    if (!text) {
      return { allowed: false, text: '', reason: 'empty' };
    }

    // Update cooldowns only on allowed messages
    this._userCooldowns.set(username, now);
    this._globalLast = now;

    return { allowed: true, text };
  }
}

module.exports = Sanitizer;
