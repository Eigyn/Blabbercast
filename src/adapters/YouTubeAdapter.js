const ChatAdapter = require('./ChatAdapter');
const { LiveChat } = require('youtube-chat');

/**
 * YouTube Live Chat adapter using youtube-chat (no API key needed).
 *
 * WARNING: This adapter uses unofficial web scraping to read YouTube live chat.
 * It is NOT endorsed by or affiliated with YouTube/Google and may violate their
 * Terms of Service. It may stop working at any time if YouTube changes their systems.
 *
 * Config (provide one):
 *   videoId   - ID of the live stream video (e.g. "dQw4w9WgXcQ")
 *   channelId - YouTube channel ID (finds active live stream automatically)
 *   handle    - YouTube handle (e.g. "@ChannelName")
 */
class YouTubeAdapter extends ChatAdapter {
  constructor(config) {
    super('youtube');
    this._connected = false;

    // Build the ID object youtube-chat expects
    if (config.videoId) {
      this._id = { liveId: config.videoId };
    } else if (config.channelId) {
      this._id = { channelId: config.channelId };
    } else if (config.handle) {
      this._id = { handle: config.handle };
    }

    this.liveChat = null;
    this.liveId = '';
  }

  async connect() {
    if (!this._id) {
      this.emit('error', new Error('YouTube requires a videoId, channelId, or handle'));
      return;
    }

    console.warn('[YouTube] WARNING: YouTube chat integration uses unofficial web scraping.');
    console.warn('[YouTube] This may violate YouTube Terms of Service. Use at your own risk.');

    this.liveChat = new LiveChat(this._id);

    this.liveChat.on('start', (liveId) => {
      this._connected = true;
      this.liveId = liveId;
      this.emit('connected');
    });

    this.liveChat.on('end', () => {
      this._connected = false;
      this.liveId = '';
      this.emit('disconnected');
    });

    this.liveChat.on('chat', (chatItem) => {
      // Extract text from message items (text + emoji text)
      const message = chatItem && chatItem.message;
      const text = Array.isArray(message)
        ? message.map(part => part.text || part.emojiText || '').join('')
        : (typeof message === 'string' ? message : '');

      if (!text.trim()) return;

      this.emit('message', {
        platform: 'youtube',
        channel: this.liveId || '',
        username: chatItem.author && chatItem.author.name ? chatItem.author.name : 'unknown',
        text,
        timestamp: Date.now()
      });
    });

    this.liveChat.on('error', (err) => {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    });

    try {
      const ok = await this.liveChat.start();
      if (!ok) {
        this.liveChat.stop();
        this.liveChat = null;
        this.emit('error', new Error('Could not find an active YouTube live stream'));
      }
    } catch (err) {
      try { this.liveChat.stop(); } catch {}
      this.liveChat = null;
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  async reconnect() {
    console.log('[YouTube] Reconnecting — searching for active live stream...');
    await this.disconnect();
    // Small delay to let the old connection fully tear down
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.connect();
  }

  async disconnect() {
    const hadConnection = this._connected || this.liveChat;
    if (this.liveChat) {
      this.liveChat.stop();
      this.liveChat = null;
    }
    this._connected = false;
    this.liveId = '';
    if (hadConnection) this.emit('disconnected');
  }

  get connected() {
    return this._connected;
  }
}

module.exports = YouTubeAdapter;
