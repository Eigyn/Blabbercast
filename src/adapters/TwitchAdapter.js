const tmi = require('tmi.js');
const ChatAdapter = require('./ChatAdapter');

class TwitchAdapter extends ChatAdapter {
  constructor(config) {
    super('twitch');
    this._connected = false;

    this.client = new tmi.Client({
      connection: {
        secure: true,
        reconnect: true
      },
      channels: [config.channel]
    });

    this.client.on('message', (channel, tags, message, self) => {
      if (self) return; // Ignore own messages

      this.emit('message', {
        platform: 'twitch',
        channel: channel.replace('#', ''),
        username: tags['display-name'] || tags.username || 'unknown',
        text: message,
        timestamp: Date.now()
      });
    });

    this.client.on('connected', () => {
      this._connected = true;
      this.emit('connected');
    });

    this.client.on('disconnected', () => {
      this._connected = false;
      this.emit('disconnected');
    });
  }

  async connect() {
    try {
      await this.client.connect();
    } catch (err) {
      this.emit('error', err);
    }
  }

  async disconnect() {
    try {
      await this.client.disconnect();
      this._connected = false;
    } catch (err) {
      this.emit('error', err);
    }
  }

  get connected() {
    return this._connected;
  }
}

module.exports = TwitchAdapter;
