class UserVoiceMap {
  constructor(maxSize = 500) {
    this._map = new Map();
    this._maxSize = maxSize;
  }

  set(username, voiceId) {
    const key = username.toLowerCase();
    // Delete first so re-insertion moves it to the end (freshest)
    this._map.delete(key);
    // Evict oldest if at capacity
    if (this._map.size >= this._maxSize) {
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
    this._map.set(key, voiceId);
  }

  get(username) {
    return this._map.get(username.toLowerCase()) || null;
  }

  delete(username) {
    this._map.delete(username.toLowerCase());
  }

  clear() {
    this._map.clear();
  }
}

module.exports = UserVoiceMap;
