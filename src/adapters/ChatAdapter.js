const EventEmitter = require('events');

/**
 * Abstract base class for chat platform adapters.
 * Emits: 'message' { platform, channel, username, text, timestamp }
 * Emits: 'connected', 'disconnected', 'error'
 */
class ChatAdapter extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
  }

  connect() {
    throw new Error('connect() must be implemented');
  }

  disconnect() {
    throw new Error('disconnect() must be implemented');
  }

  get connected() {
    throw new Error('connected getter must be implemented');
  }
}

module.exports = ChatAdapter;
