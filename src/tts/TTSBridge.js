const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const EventEmitter = require('events');

const WORKER_COMMANDS = new Set(['speak', 'list_voices', 'stop', 'shutdown']);

class TTSBridge extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isSpeaking = false;
    this.isPaused = false;
    this.ready = false;
    this.voices = [];
    this._pendingCallbacks = new Map();
    this._buffer = '';
    this._speakTimeout = null;
    this._stopTimeout = null;
    this._currentSpeakId = null;
    this._currentAudioPath = '';
    this._pendingAudio = null;
    this._respawnDelay = 1000;
    this._started = false;
    this._shuttingDown = false;
    this._idleTimeout = null;
    this._idleMs = 5 * 60 * 1000;
    this._playbackPhase = 'idle';
    this._lastCompletedId = '';
  }

  start() {
    if (this._started && this.process) return;

    const workerPath = path.join(__dirname, '..', '..', 'python', 'tts_worker.py');
    const python = this._resolvePythonCommand();
    const env = {
      ...process.env,
      BLABBERCAST_USE_AUDIO_HOST: '1'
    };

    this.process = spawn(python.command, [...python.args, workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env
    });
    const proc = this.process;

    this._started = true;
    this.ready = false;

    proc.stdout.on('data', (data) => this._onData(data));
    proc.stderr.on('data', (data) => {
      console.error('[TTS Python]', data.toString().trim());
    });

    proc.on('close', (code) => {
      if (this.process !== proc) return;

      this.process = null;
      this.ready = false;
      this.isSpeaking = false;
      this.isPaused = false;
      this._currentSpeakId = null;
      this._currentAudioPath = '';
      this._pendingAudio = null;
      this._playbackPhase = 'idle';
      this._lastCompletedId = '';
      this._started = false;
      this._clearSpeakTimeout();
      this._clearStopTimeout();

      if (this._shuttingDown) return;

      console.error(`[TTS] Python process exited with code ${code}`);
      setTimeout(() => {
        console.log('[TTS] Respawning Python process...');
        this.start();
      }, this._respawnDelay);
    });

    proc.on('error', (err) => {
      console.error(`[TTS] Failed to spawn Python (${[python.command, ...python.args].join(' ')}):`, err.message);
      if (this.process === proc) {
        this.process = null;
        this.ready = false;
        this._started = false;
      }
    });
  }

  _resolvePythonCommand() {
    if (process.env.BLABBERCAST_PYTHON) {
      return { command: process.env.BLABBERCAST_PYTHON, args: [] };
    }

    const pathCandidates = [
      path.join(__dirname, '..', '..', 'runtime', 'python', 'python.exe'),
      path.join(__dirname, '..', '..', 'python-runtime', 'python.exe'),
      path.join(process.cwd(), 'runtime', 'python', 'python.exe'),
      path.join(process.cwd(), 'python-runtime', 'python.exe')
    ];

    for (const candidate of pathCandidates) {
      try {
        if (fs.existsSync(candidate)) {
          return { command: candidate, args: [] };
        }
      } catch {}
    }

    if (this._commandWorks('python', ['--version'])) {
      return { command: 'python', args: [] };
    }

    if (this._commandWorks('py', ['-3', '--version'])) {
      return { command: 'py', args: ['-3'] };
    }

    return { command: 'python', args: [] };
  }

  _commandWorks(command, args) {
    try {
      const result = spawnSync(command, args, {
        stdio: 'ignore',
        windowsHide: true
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  _ensureStarted() {
    if (!this._started || !this.process) {
      this.start();
    }
    this._resetIdleTimer();
  }

  _resetIdleTimer() {
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
    }
    this._idleTimeout = setTimeout(() => {
      if (!this.isSpeaking && this._started) {
        console.log('[TTS] Idle timeout reached, shutting down Python process to save resources');
        this._shutdownProcess();
      }
    }, this._idleMs);
    if (typeof this._idleTimeout.unref === 'function') {
      this._idleTimeout.unref();
    }
  }

  _shutdownProcess() {
    if (!this.process) return;
    this._send({ type: 'shutdown' });
    const proc = this.process;
    setTimeout(() => {
      try { proc.kill(); } catch {}
    }, 3000);
    this.process = null;
    this.ready = false;
    this.isSpeaking = false;
    this.isPaused = false;
    this._currentSpeakId = null;
    this._currentAudioPath = '';
    this._pendingAudio = null;
    this._playbackPhase = 'idle';
    this._started = false;
    this._clearSpeakTimeout();
    this._clearStopTimeout();
  }

  _onData(data) {
    this._buffer += data.toString();
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        this._handleMessage(msg);
      } catch {}
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'ready':
        this.ready = true;
        this.emit('ready');
        break;

      case 'audio_ready': {
        const audio = {
          id: msg.id,
          volume: msg.volume,
          url: `/api/tts/audio/${encodeURIComponent(String(msg.id || ''))}?t=${Date.now()}`
        };

        this._currentAudioPath = msg.path || '';
        this._playbackPhase = 'waiting_browser';

        if (this.isPaused) {
          this._pendingAudio = audio;
        } else {
          this._pendingAudio = null;
          this.emit('audio_ready', audio);
        }
        break;
      }

      case 'done':
        if (msg.id && msg.id === this._lastCompletedId) {
          break;
        }
        if (this._playbackPhase === 'generating' || !this._currentAudioPath) {
          this._completeSpeak(msg.id);
        }
        break;

      case 'error':
        this.isSpeaking = false;
        this.isPaused = false;
        this._currentSpeakId = null;
        this._playbackPhase = 'idle';
        this._clearSpeakTimeout();
        this._clearStopTimeout();
        this._cleanupAudioFile(msg.id);
        console.error('[TTS Error]', msg.message);
        this.emit('error', msg.id, msg.message);
        break;

      case 'voices':
        this.voices = msg.voices || [];
        {
          const cb = this._pendingCallbacks.get(msg.id);
          if (cb) {
            cb(this.voices);
            this._pendingCallbacks.delete(msg.id);
          }
        }
        this.emit('voices', this.voices);
        break;
    }
  }

  _cleanupAudioFile(id) {
    const candidate = this._currentAudioPath;
    if (candidate) {
      this._currentAudioPath = '';
      fs.unlink(candidate, () => {});
    }

    if (this._pendingAudio && (!id || this._pendingAudio.id === id)) {
      this._pendingAudio = null;
    }
  }

  _completeSpeak(id) {
    this.isSpeaking = false;
    this.isPaused = false;
    this._currentSpeakId = null;
    this._playbackPhase = 'idle';
    this._lastCompletedId = id || '';
    this._clearSpeakTimeout();
    this._clearStopTimeout();
    this._resetIdleTimer();
    this._cleanupAudioFile(id);
    this.emit('done', id);
  }

  _send(msg) {
    if (!this.process || !this.process.stdin.writable) return;
    if (msg.type && !WORKER_COMMANDS.has(msg.type)) {
      console.error(`[TTS] Blocked unknown worker command type: ${msg.type}`);
      return;
    }
    const serialized = JSON.stringify(msg);
    if (serialized.includes('\n') || serialized.includes('\r')) {
      console.error('[TTS] Blocked worker message containing raw newline in serialized JSON');
      return;
    }
    this.process.stdin.write(serialized + '\n');
  }

  _clearSpeakTimeout() {
    if (this._speakTimeout) {
      clearTimeout(this._speakTimeout);
      this._speakTimeout = null;
    }
  }

  _clearStopTimeout() {
    if (this._stopTimeout) {
      clearTimeout(this._stopTimeout);
      this._stopTimeout = null;
    }
  }

  _startSpeakTimeout() {
    this._clearSpeakTimeout();
    this._speakTimeout = setTimeout(() => {
      if (this.isSpeaking && !this.isPaused) {
        console.warn('[TTS] Speak timeout, forcing stop');
        this.stop();
      }
    }, 30000);
  }

  speak(text, engine, voice, rate, volume, id = crypto.randomUUID(), speaker = '') {
    this._ensureStarted();

    this.isSpeaking = true;
    this.isPaused = false;
    this._currentSpeakId = id;
    this._currentAudioPath = '';
    this._pendingAudio = null;
    this._playbackPhase = 'generating';
    this._lastCompletedId = '';
    this._clearStopTimeout();

    this._send({
      type: 'speak',
      id,
      text,
      engine,
      voice,
      rate,
      volume,
      speaker
    });

    this._startSpeakTimeout();
    return id;
  }

  pause() {
    if (!this.isSpeaking && this._playbackPhase === 'idle') return;

    this.isPaused = true;
    this._clearSpeakTimeout();
  }

  resume() {
    if (!this.isPaused) return;

    this.isPaused = false;

    if (this._pendingAudio && this._playbackPhase === 'waiting_browser') {
      const audio = this._pendingAudio;
      this._pendingAudio = null;
      this.emit('audio_ready', audio);
    }

    this._startSpeakTimeout();
  }

  stop() {
    const id = this._currentSpeakId;
    this.isPaused = false;
    this._clearSpeakTimeout();

    if (!id) return;

    this._send({ type: 'stop' });

    if (this._playbackPhase === 'waiting_browser') {
      this._completeSpeak(id);
      return;
    }

    this._clearStopTimeout();
    this._stopTimeout = setTimeout(() => {
      if (!this.isSpeaking) return;

      console.warn('[TTS] Stop timeout, forcing completion');
      this._completeSpeak(id);
    }, 2000);
  }

  browserPlaybackStarted(id) {
    if (!id || id !== this._currentSpeakId) return false;
    if (this._playbackPhase === 'playing_browser') return true;
    if (this._playbackPhase !== 'waiting_browser') return false;

    this.isSpeaking = true;
    this._playbackPhase = 'playing_browser';
    this.emit('speaking', id);
    return true;
  }

  browserPlaybackCompleted(id) {
    if (!id) return false;
    if (id === this._lastCompletedId) return false;
    if (id !== this._currentSpeakId) return false;

    this._completeSpeak(id);
    return true;
  }

  browserPlaybackFailed(id, message) {
    if (!id || id !== this._currentSpeakId) return false;

    this.isSpeaking = false;
    this.isPaused = false;
    this._currentSpeakId = null;
    this._playbackPhase = 'idle';
    this._clearSpeakTimeout();
    this._clearStopTimeout();
    this._cleanupAudioFile(id);
    this.emit('error', id, message || 'Browser playback failed');
    return true;
  }

  getAudioFilePath(id) {
    if (!id || id !== this._currentSpeakId) return '';
    return this._currentAudioPath || '';
  }

  getActiveSpeakId() {
    return this._currentSpeakId || '';
  }

  listVoices() {
    this._ensureStarted();

    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      this._pendingCallbacks.set(id, resolve);
      this._send({ type: 'list_voices', id });

      setTimeout(() => {
        if (this._pendingCallbacks.has(id)) {
          this._pendingCallbacks.delete(id);
          resolve(this.voices);
        }
      }, 10000);
    });
  }

  shutdown() {
    this._shuttingDown = true;
    this._clearSpeakTimeout();
    this._clearStopTimeout();
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
    }
    if (this.process) {
      this._send({ type: 'shutdown' });
      const proc = this.process;
      setTimeout(() => {
        try { proc.kill(); } catch {}
      }, 3000);
    }
  }
}

module.exports = TTSBridge;
