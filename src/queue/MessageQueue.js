const EventEmitter = require('events');

class MessageQueue extends EventEmitter {
  constructor(maxSize = 50) {
    super();
    this.maxSize = maxSize;
    this._queue = [];
  }

  enqueue(message) {
    if (this._queue.length >= this.maxSize) {
      this._queue.shift(); // Drop oldest
    }
    this._queue.push(message);
    this.emit('enqueued', message);
    return true;
  }

  dequeue() {
    return this._queue.shift() || null;
  }

  peek() {
    return this._queue[0] || null;
  }

  clear() {
    this._queue = [];
  }

  get length() {
    return this._queue.length;
  }

  get isEmpty() {
    return this._queue.length === 0;
  }
}

module.exports = MessageQueue;
