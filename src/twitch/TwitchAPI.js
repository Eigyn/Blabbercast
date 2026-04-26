const EventEmitter = require('events');

class TwitchAPI extends EventEmitter {
  constructor(config) {
    super();
    this.channel = config.channel || '';
    this.clientId = config.clientId || process.env.TWITCH_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.TWITCH_CLIENT_SECRET || '';
    this.accessToken = null;
    this.tokenExpiry = 0;
    this._pollInterval = null;
    this._pollIntervalMs = 60000;
    this._streamInfo = { live: false, viewers: 0, title: '', game: '' };
  }

  get configured() {
    return !!(this.clientId && this.clientSecret);
  }

  get streamInfo() {
    return { channel: this.channel, ...this._streamInfo };
  }

  async _getAppToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials'
    });

    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: params
    });

    if (!res.ok) {
      throw new Error(`Twitch OAuth failed: ${res.status}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    // Expire 1 hour early for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 3600) * 1000;
    return this.accessToken;
  }

  async fetchStreamInfo() {
    if (!this.configured || !this.channel) return this._streamInfo;

    try {
      const token = await this._getAppToken();
      const res = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(this.channel)}`,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          this.accessToken = null; // Force re-auth
        }
        return this._streamInfo;
      }

      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const stream = data.data[0];
        this._streamInfo = {
          live: true,
          viewers: stream.viewer_count || 0,
          title: stream.title || '',
          game: stream.game_name || ''
        };
      } else {
        this._streamInfo = { live: false, viewers: 0, title: '', game: '' };
      }

      this.emit('update', this.streamInfo);
    } catch (err) {
      console.error('[TwitchAPI]', err.message);
    }

    return this._streamInfo;
  }

  updateConfig(config) {
    if (!config) return;
    const nextChannel = typeof config.channel === 'string' ? config.channel : this.channel;
    const nextClientId = config.clientId || this.clientId;
    const nextClientSecret = config.clientSecret || this.clientSecret;
    const changed =
      this.channel !== nextChannel ||
      this.clientId !== nextClientId ||
      this.clientSecret !== nextClientSecret;

    this.channel = nextChannel;
    this.clientId = nextClientId;
    this.clientSecret = nextClientSecret;

    if (changed) {
      this.accessToken = null;
      this.tokenExpiry = 0;
      this._streamInfo = { live: false, viewers: 0, title: '', game: '' };
      if (this.configured && this.channel) {
        if (this._pollInterval) {
          this.fetchStreamInfo();
        } else {
          this.startPolling(this._pollIntervalMs);
        }
      } else {
        this.stopPolling();
      }
    }
  }

  startPolling(intervalMs = 60000) {
    this._pollIntervalMs = intervalMs;
    this.stopPolling();
    if (!this.configured || !this.channel) return;

    // Fetch immediately
    this.fetchStreamInfo();

    // Then poll on interval
    this._pollInterval = setInterval(() => this.fetchStreamInfo(), intervalMs);
    if (typeof this._pollInterval.unref === 'function') {
      this._pollInterval.unref();
    }
  }

  stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }
}

module.exports = TwitchAPI;
