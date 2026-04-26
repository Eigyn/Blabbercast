(function () {
  'use strict';

  const pauseBtn = document.getElementById('pauseBtn');
  const skipBtn = document.getElementById('skipBtn');
  const clearBtn = document.getElementById('clearBtn');
  const feedClearBtn = document.getElementById('feedClearBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const shutdownBtn = document.getElementById('shutdownBtn');
  const testMessageInput = document.getElementById('testMessageInput');
  const testMessageBtn = document.getElementById('testMessageBtn');
  const queueCount = document.getElementById('queueCount');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeVal = document.getElementById('volumeVal');
  const rateSlider = document.getElementById('rateSlider');
  const rateVal = document.getElementById('rateVal');
  const onlineModeToggle = document.getElementById('onlineModeToggle');
  const onlineModeStatus = document.getElementById('onlineModeStatus');
  const onlineCard = document.getElementById('onlineCard');
  const modeIndicator = document.getElementById('modeIndicator');
  const engineSelect = document.getElementById('engineSelect');
  const voiceSelect = document.getElementById('voiceSelect');
  const speakerSelect = document.getElementById('speakerSelect');
  const speakerGroup = document.getElementById('speakerGroup');
  const speakUsernameToggle = document.getElementById('speakUsernameToggle');
  const allowUserVoicesToggle = document.getElementById('allowUserVoicesToggle');
  const feedList = document.getElementById('feedList');
  const feedCount = document.getElementById('feedCount');
  const channelName = document.getElementById('channelName');
  const viewerCount = document.getElementById('viewerCount');

  const twitchBadge = document.getElementById('twitchBadge');
  const youtubeBadge = document.getElementById('youtubeBadge');
  const twitchChannelDisplay = document.getElementById('twitchChannelDisplay');
  const ytChannelDisplay = document.getElementById('ytChannelDisplay');
  const reconnectBothBtn = document.getElementById('reconnectBothBtn');

  const settingsTwitchDot = document.getElementById('settingsTwitchDot');
  const settingsYtDot = document.getElementById('settingsYtDot');
  const twitchChannelInput = document.getElementById('twitchChannelInput');
  const twitchClientIdInput = document.getElementById('twitchClientIdInput');
  const twitchClientSecretInput = document.getElementById('twitchClientSecretInput');
  const ytHandleInput = document.getElementById('ytHandleInput');
  const ytChannelIdInput = document.getElementById('ytChannelIdInput');
  const ytVideoIdInput = document.getElementById('ytVideoIdInput');
  const saveTwitchBtn = document.getElementById('saveTwitchBtn');
  const saveYoutubeBtn = document.getElementById('saveYoutubeBtn');
  const revealButtons = document.querySelectorAll('.reveal-btn');

  const settingsPanel = document.getElementById('settingsPanel');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const closeSettings = document.getElementById('closeSettings');
  const userCooldownSlider = document.getElementById('userCooldownSlider');
  const userCooldownVal = document.getElementById('userCooldownVal');
  const globalCooldownSlider = document.getElementById('globalCooldownSlider');
  const globalCooldownVal = document.getElementById('globalCooldownVal');
  const maxLengthSlider = document.getElementById('maxLengthSlider');
  const maxLengthVal = document.getElementById('maxLengthVal');
  const stripSsmlToggle = document.getElementById('stripSsmlToggle');
  const stripZalgoToggle = document.getElementById('stripZalgoToggle');
  const stripUnicodeToggle = document.getElementById('stripUnicodeToggle');
  const stripUrlsToggle = document.getElementById('stripUrlsToggle');
  const blockWordInput = document.getElementById('blockWordInput');
  const addBlockWordBtn = document.getElementById('addBlockWord');
  const blockedWordTags = document.getElementById('blockedWordTags');
  const prefixInput = document.getElementById('prefixInput');
  const addPrefixBtn = document.getElementById('addPrefix');
  const prefixTags = document.getElementById('prefixTags');
  const blockUserInput = document.getElementById('blockUserInput');
  const addBlockUserBtn = document.getElementById('addBlockUser');
  const blockedUserTags = document.getElementById('blockedUserTags');
  const showLogsToggle = document.getElementById('showLogsToggle');
  const logPanel = document.getElementById('logPanel');
  const logList = document.getElementById('logList');
  const logFeed = document.getElementById('logFeed');
  const logCount = document.getElementById('logCount');

  const toastContainer = document.getElementById('toastContainer');

  const ICONS = {
    pause: '<svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M0 0h3v12H0zM7 0h3v12H7z"/></svg>',
    play:  '<svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M0 0v12l10-6z"/></svg>',
    speakingPlay: '<svg width="8" height="10" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M2 1v10l8-5z"/></svg>',
    twitch: '<svg width="8" height="10" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true"><path d="M1.5 0L0 3v13h4.5v2h2.5l2-2H12l4-4V0H1.5zm13 10.5l-3 3H8l-2 2v-2H2V1.5h12.5V10.5zM11 4.5v5H9.5v-5H11zm-3.5 0v5H6v-5h1.5z"/></svg>',
    youtube: '<svg width="10" height="8" viewBox="0 0 24 17" fill="currentColor" aria-hidden="true"><path d="M23.8 2.6s-.2-1.7-1-2.4C21.8.1 20.6 0 20 0 16.7-.2 12 0 12 0s-4.7-.2-8 0c-.6.1-1.8.2-2.8 1.2-.7.7-1 2.4-1 2.4S0 4.5 0 6.5v1.8c0 2 .2 3.9.2 3.9s.2 1.7 1 2.4c1 1 2.3.9 2.9 1C6.2 15.8 12 16 12 16s4.7 0 8-.2c.6-.1 1.8-.2 2.8-1.2.7-.7 1-2.4 1-2.4s.2-2 .2-3.9V6.5c-.1-2-.3-3.9-.2-3.9zM9.5 11.5v-6l6.5 3-6.5 3z"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  };

  function showToast(message, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  const audioHostKey = 'blabbercast.audioHost';
  const hostStaleMs = 5000;
  const windowId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const playbackAudio = new Audio();
  let currentAudioPlaybackId = '';
  let playbackStartedReported = false;
  let audioHostHeartbeat = null;

  let allVoices = [];
  let savedVoice = '';
  let savedSpeaker = '';
  const savedVoiceByEngine = {};
  let paused = false;
  let onlineMode = false;
  let messageCount = 0;
  let apiKey = '';
  const MAX_FEED_ITEMS = 100;
  const MAX_LOG_ITEMS = 300;
  const seenLogIds = new Set();

  function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET' && apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    return fetch(path, opts).then(async (response) => {
      const text = await response.text();
      let data = {};

      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }

      if (!response.ok && !data.error) {
        data.error = `Request failed (${response.status})`;
      }

      return data;
    });
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function bindRevealButtons() {
    revealButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;

        const showing = input.type === 'password';
        input.type = showing ? 'text' : 'password';
        btn.classList.toggle('active', showing);
        btn.title = showing ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', showing ? 'Hide secret' : 'Show secret');
      });
    });
  }

  function readAudioHostRecord() {
    try {
      return JSON.parse(localStorage.getItem(audioHostKey) || 'null');
    } catch {
      return null;
    }
  }

  function isAudioHostWindow() {
    const record = readAudioHostRecord();
    return !!record && record.id === windowId;
  }

  function claimAudioHost() {
    localStorage.setItem(audioHostKey, JSON.stringify({
      id: windowId,
      ts: Date.now()
    }));
  }

  function releaseAudioHost() {
    if (isAudioHostWindow()) {
      localStorage.removeItem(audioHostKey);
    }
  }

  function syncAudioHost(forceClaim) {
    const record = readAudioHostRecord();
    const stale = !record || (Date.now() - (record.ts || 0)) > hostStaleMs;

    if (isAudioHostWindow()) {
      claimAudioHost();
      return true;
    }

    if (forceClaim || stale) {
      claimAudioHost();
      return true;
    }

    return false;
  }

  async function reportBrowserPlayback(path, body) {
    try {
      await api('POST', path, body);
    } catch {}
  }

  function resetBrowserPlayback() {
    playbackAudio.pause();
    playbackAudio.removeAttribute('src');
    playbackAudio.load();
    currentAudioPlaybackId = '';
    playbackStartedReported = false;
  }

  async function stopBrowserPlayback(reportDone) {
    const id = currentAudioPlaybackId;
    if (!id) return;

    resetBrowserPlayback();

    if (reportDone) {
      await reportBrowserPlayback('/api/tts/browser/done', { id });
    }
  }

  async function playBrowserAudio(data) {
    if (!data || !data.id || !data.url) return;
    if (!isAudioHostWindow() && !syncAudioHost(false)) return;

    if (currentAudioPlaybackId && currentAudioPlaybackId !== data.id) {
      await stopBrowserPlayback(false);
    }

    currentAudioPlaybackId = data.id;
    playbackStartedReported = false;
    playbackAudio.volume = Math.max(0, Math.min(1, (Number(data.volume) || 100) / 100));
    playbackAudio.src = data.url;

    try {
      await playbackAudio.play();
    } catch (err) {
      const message = err && err.message ? err.message : 'Autoplay was blocked';
      resetBrowserPlayback();
      showToast(message, 'error');
      await reportBrowserPlayback('/api/tts/browser/error', { id: data.id, message });
    }
  }

  function initBrowserAudioHost() {
    playbackAudio.preload = 'auto';

    playbackAudio.addEventListener('playing', () => {
      if (!isAudioHostWindow() || !currentAudioPlaybackId || playbackStartedReported) return;
      playbackStartedReported = true;
      reportBrowserPlayback('/api/tts/browser/start', { id: currentAudioPlaybackId });
    });

    playbackAudio.addEventListener('ended', () => {
      stopBrowserPlayback(true);
    });

    playbackAudio.addEventListener('error', () => {
      if (!currentAudioPlaybackId) return;
      const id = currentAudioPlaybackId;
      resetBrowserPlayback();
      reportBrowserPlayback('/api/tts/browser/error', { id, message: 'Browser audio playback failed' });
    });

    syncAudioHost(document.visibilityState === 'visible');

    audioHostHeartbeat = setInterval(() => {
      if (isAudioHostWindow()) {
        claimAudioHost();
      } else if (document.visibilityState === 'visible') {
        syncAudioHost(false);
      }
    }, 2000);

    window.addEventListener('storage', (event) => {
      if (event.key !== audioHostKey) return;
      if (!readAudioHostRecord() && document.visibilityState === 'visible') {
        syncAudioHost(true);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncAudioHost(false);
      }
    });

    window.addEventListener('focus', () => {
      if (document.visibilityState === 'visible') {
        syncAudioHost(false);
      }
    });

    window.addEventListener('beforeunload', () => {
      if (audioHostHeartbeat) clearInterval(audioHostHeartbeat);
      if (isAudioHostWindow()) {
        releaseAudioHost();
      }
    });
  }

  function setLogVisibility(show) {
    if (!logPanel || !showLogsToggle) return;
    logPanel.hidden = !show;
    showLogsToggle.checked = show;
  }

  function addLogEntry(entry) {
    if (!entry || !logList || !logCount || !logFeed) return;
    if (entry.id && seenLogIds.has(entry.id)) return;
    if (entry.id) seenLogIds.add(entry.id);

    const empty = logList.querySelector('.log-empty');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = 'log-entry level-' + (entry.level || 'log');
    if (entry.id) row.dataset.id = entry.id;

    const ts = document.createElement('span');
    ts.className = 'log-time';
    ts.textContent = formatTime(entry.timestamp);

    const level = document.createElement('span');
    level.className = 'log-level';
    level.textContent = (entry.level || 'log').toUpperCase();

    const message = document.createElement('pre');
    message.className = 'log-message';
    message.textContent = entry.message || '';

    row.appendChild(ts);
    row.appendChild(level);
    row.appendChild(message);
    logList.appendChild(row);

    while (logList.children.length > MAX_LOG_ITEMS) {
      const first = logList.firstElementChild;
      if (!first) break;
      if (first.dataset && first.dataset.id) seenLogIds.delete(first.dataset.id);
      logList.removeChild(first);
    }

    logCount.textContent = String(logList.querySelectorAll('.log-entry').length);
    logFeed.scrollTop = logFeed.scrollHeight;
  }

  async function loadLogs() {
    const logs = await api('GET', '/api/logs');
    if (!Array.isArray(logs) || !logList) return;

    logList.innerHTML = '<div class="log-empty">No log output yet.</div>';
    seenLogIds.clear();
    logCount.textContent = '0';

    for (const entry of logs) {
      addLogEntry(entry);
    }
  }

  async function loadChannelInfo() {
    const info = await api('GET', '/api/channel-info');
    updateChannelInfo(info);
  }

  function updateChannelInfo(info) {
    if (!channelName || !viewerCount) return;

    channelName.textContent = info && info.channel ? info.channel : '';
    if (!info || !info.configured) {
      viewerCount.textContent = '';
      viewerCount.className = 'viewer-count';
    } else if (info.live) {
      viewerCount.textContent = info.viewers.toLocaleString() + ' viewers';
      viewerCount.className = 'viewer-count live';
    } else {
      viewerCount.textContent = 'Offline';
      viewerCount.className = 'viewer-count';
    }
  }

  function updatePlatformStatus(platform, state) {
    const connected = state === 'connected';
    if (platform === 'twitch') {
      twitchBadge.classList.toggle('active', connected);
      if (settingsTwitchDot) settingsTwitchDot.classList.toggle('active', connected);
    } else if (platform === 'youtube') {
      youtubeBadge.classList.toggle('active', connected);
      if (settingsYtDot) settingsYtDot.classList.toggle('active', connected);
    }
  }

  function youtubeDisplayName(yt) {
    if (!yt) return 'YouTube';
    return yt.handle || yt.channelId || yt.videoId || 'YouTube';
  }

  function updateConnectionDisplays(settings) {
    if (!settings) return;
    const tw = settings.twitch || {};
    const yt = settings.youtube || {};

    if (twitchChannelDisplay) {
      const channel = tw.channel && tw.channel !== 'YOUR_CHANNEL_NAME' ? tw.channel : 'Twitch';
      twitchChannelDisplay.textContent = channel;
    }
    if (ytChannelDisplay) {
      ytChannelDisplay.textContent = youtubeDisplayName(yt);
    }

    if (twitchChannelInput && tw.channel && tw.channel !== 'YOUR_CHANNEL_NAME') {
      twitchChannelInput.value = tw.channel;
    }
    if (twitchClientIdInput && tw.clientId && tw.clientId !== '***') {
      twitchClientIdInput.value = tw.clientId;
    }
    if (ytHandleInput) ytHandleInput.value = yt.handle || '';
    if (ytChannelIdInput) ytChannelIdInput.value = yt.channelId || '';
    if (ytVideoIdInput) ytVideoIdInput.value = yt.videoId || '';
  }

  function updateOnlineMode(enabled) {
    onlineMode = enabled;
    onlineModeToggle.checked = enabled;

    if (enabled) {
      modeIndicator.textContent = 'ONLINE';
      modeIndicator.classList.add('online');
    } else {
      modeIndicator.textContent = 'LOCAL';
      modeIndicator.classList.remove('online');
    }

    if (onlineCard) onlineCard.classList.toggle('is-online', enabled);
    if (onlineModeStatus) {
      onlineModeStatus.textContent = enabled ? 'Azure Voices Enabled' : 'Local engines only';
    }

    updateEngineOptions();
  }

  function updateEngineOptions() {
    const currentEngine = engineSelect.value;

    engineSelect.innerHTML = '';

    const piperOpt = document.createElement('option');
    piperOpt.value = 'piper';
    piperOpt.textContent = 'Piper (Local Neural)';
    engineSelect.appendChild(piperOpt);

    const sapiOpt = document.createElement('option');
    sapiOpt.value = 'sapi';
    sapiOpt.textContent = 'Microsoft SAPI (Local)';
    engineSelect.appendChild(sapiOpt);

    if (onlineMode) {
      const edgeOpt = document.createElement('option');
      edgeOpt.value = 'edge-tts';
      edgeOpt.textContent = 'Edge TTS (Azure Neural)';
      engineSelect.appendChild(edgeOpt);
    }

    const options = Array.from(engineSelect.options).map(o => o.value);
    if (options.includes(currentEngine)) {
      engineSelect.value = currentEngine;
    } else {
      engineSelect.value = 'piper';
    }

    filterVoices();
  }

  async function loadSettings() {
    const settings = await api('GET', '/api/settings');

    paused = settings.tts.paused;
    updatePauseBtn();
    volumeSlider.value = settings.tts.volume;
    volumeVal.textContent = settings.tts.volume;
    rateSlider.value = settings.tts.rate;
    rateVal.textContent = settings.tts.rate;
    savedVoice = settings.tts.voice || '';
    savedSpeaker = settings.tts.speaker || '';
    savedVoiceByEngine[settings.tts.engine] = savedVoice;
    speakUsernameToggle.checked = settings.tts.speakUsername || false;
    allowUserVoicesToggle.checked = settings.tts.allowUserVoices !== false;

    updateOnlineMode(settings.tts.onlineMode || false);

    const engineOptions = Array.from(engineSelect.options).map(o => o.value);
    engineSelect.value = engineOptions.includes(settings.tts.engine) ? settings.tts.engine : 'piper';

    const sec = settings.security;
    const userCooldownSec = Math.round((sec.perUserCooldownMs || 5000) / 1000);
    userCooldownSlider.value = userCooldownSec;
    userCooldownVal.textContent = userCooldownSec + 's';
    const globalCooldownSec = Math.round((sec.globalCooldownMs || 2000) / 1000);
    globalCooldownSlider.value = globalCooldownSec;
    globalCooldownVal.textContent = globalCooldownSec + 's';
    maxLengthSlider.value = sec.maxMessageLength || 200;
    maxLengthVal.textContent = sec.maxMessageLength || 200;
    stripSsmlToggle.checked = sec.stripSsml !== false;
    stripZalgoToggle.checked = sec.stripZalgo !== false;
    stripUnicodeToggle.checked = sec.stripUnicode !== false;
    stripUrlsToggle.checked = sec.stripUrls !== false;
    setLogVisibility(!settings.ui || settings.ui.showLogs !== false);

    renderBlockedWords(sec.blockedWords || []);
    renderBlockedUsers(sec.blockedUsers || []);
    renderPrefixes(sec.commandPrefixes || ['!']);

    updateConnectionDisplays(settings);

    return settings;
  }

  async function loadVoices() {
    allVoices = await api('GET', '/api/voices');
    const selectedVoice = filterVoices();
    if (selectedVoice && selectedVoice !== savedVoice) {
      savedVoice = selectedVoice;
      api('PATCH', '/api/settings', { section: 'tts', values: { engine: engineSelect.value, voice: selectedVoice } });
    }
  }

  function filterVoices(preferredVoice) {
    const engine = engineSelect.value;
    voiceSelect.innerHTML = '';
    const filtered = allVoices.filter(v => v.engine === engine);
    if (filtered.length === 0) {
      voiceSelect.innerHTML = '<option value="">No voices available</option>';
      updateSpeakerOptions(null);
      return;
    }
    for (const v of filtered) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      voiceSelect.appendChild(opt);
    }

    const preferred = preferredVoice || savedVoiceByEngine[engine] || savedVoice;
    const selected = filtered.some(v => v.id === preferred) ? preferred : filtered[0].id;
    voiceSelect.value = selected;
    savedVoiceByEngine[engine] = selected;
    updateSpeakerOptions(filtered.find(v => v.id === selected));
    return selected;
  }

  function updateSpeakerOptions(voice) {
    if (!speakerSelect || !speakerGroup) return;

    const speakers = (voice && Array.isArray(voice.speakers)) ? voice.speakers : [];
    speakerSelect.innerHTML = '';

    if (!speakers.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No speakers for this voice available...';
      speakerSelect.appendChild(opt);
      speakerSelect.value = '';
      speakerSelect.disabled = true;
      speakerGroup.classList.add('is-disabled');
      speakerGroup.hidden = false;
      savedSpeaker = '';
      return;
    }

    for (const name of speakers) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      speakerSelect.appendChild(opt);
    }
    speakerSelect.value = speakers.includes(savedSpeaker) ? savedSpeaker : speakers[0];
    speakerSelect.disabled = false;
    speakerGroup.classList.remove('is-disabled');
    speakerGroup.hidden = false;
  }

  function updatePauseBtn() {
    if (paused) {
      pauseBtn.innerHTML = ICONS.play + ' <span class="btn-label">Resume</span>';
      pauseBtn.classList.remove('active');
    } else {
      pauseBtn.innerHTML = ICONS.pause + ' <span class="btn-label">Pause</span>';
      pauseBtn.classList.add('active');
    }
  }

  pauseBtn.addEventListener('click', async () => {
    if (paused) {
      await api('POST', '/api/tts/resume');
      paused = false;
    } else {
      await api('POST', '/api/tts/pause');
      paused = true;
    }
    updatePauseBtn();
  });

  skipBtn.addEventListener('click', () => api('POST', '/api/tts/skip'));

  function clearQueueAndFeed() {
    api('POST', '/api/tts/clear');
    feedList.innerHTML = '<div class="feed-empty"><span class="feed-empty-main">Queue cleared</span></div>';
    messageCount = 0;
    feedCount.textContent = '0';
  }

  clearBtn.addEventListener('click', clearQueueAndFeed);
  if (feedClearBtn) feedClearBtn.addEventListener('click', clearQueueAndFeed);

  testMessageBtn.addEventListener('click', async () => {
    const text = testMessageInput.value.trim();
    if (!text) return;
    await api('POST', '/api/tts/test', { text });
    testMessageInput.value = '';
  });

  testMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') testMessageBtn.click();
  });

  shutdownBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to shut down the TTS service?')) {
      api('POST', '/api/shutdown');
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#7878a0;font-size:16px;font-family:Segoe UI,sans-serif;background:#0b0b14;">Service has been shut down. You can close this tab.</div>';
    }
  });

  if (reconnectBothBtn) {
    reconnectBothBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      reconnectBothBtn.classList.add('spinning');
      showToast('Reconnecting Twitch and YouTube...', '');
      try {
        const result = await api('POST', '/api/reconnect');
        if (result && result.error) {
          showToast(result.error, 'error');
        }
      } catch {
        showToast('Failed to reconnect', 'error');
      }
      setTimeout(() => reconnectBothBtn.classList.remove('spinning'), 2000);
    });
  }

  if (saveTwitchBtn) {
    saveTwitchBtn.addEventListener('click', async () => {
      const payload = {
        channel: twitchChannelInput ? twitchChannelInput.value.trim() : '',
        clientId: twitchClientIdInput ? twitchClientIdInput.value.trim() : '',
        clientSecret: twitchClientSecretInput ? twitchClientSecretInput.value : ''
      };
      if (!payload.channel) {
        showToast('Enter a Twitch channel name', 'error');
        return;
      }
      saveTwitchBtn.disabled = true;
      try {
        const result = await api('POST', '/api/twitch/config', payload);
        if (result && result.error) {
          showToast(result.error, 'error');
        } else {
          showToast('Twitch settings saved — reconnecting...', 'success');
          if (result && result.settings) updateConnectionDisplays(result.settings);
          if (twitchClientSecretInput) twitchClientSecretInput.value = '';
        }
      } catch {
        showToast('Failed to save Twitch settings', 'error');
      } finally {
        saveTwitchBtn.disabled = false;
      }
    });
  }

  if (saveYoutubeBtn) {
    saveYoutubeBtn.addEventListener('click', async () => {
      const payload = {
        handle: ytHandleInput ? ytHandleInput.value.trim() : '',
        channelId: ytChannelIdInput ? ytChannelIdInput.value.trim() : '',
        videoId: ytVideoIdInput ? ytVideoIdInput.value.trim() : ''
      };
      if (!payload.handle && !payload.channelId && !payload.videoId) {
        showToast('Enter a handle, channel ID, or video ID', 'error');
        return;
      }
      saveYoutubeBtn.disabled = true;
      try {
        const result = await api('POST', '/api/youtube/config', payload);
        if (result && result.error) {
          showToast(result.error, 'error');
        } else {
          showToast('YouTube settings saved — searching for live stream...', 'success');
          if (result && result.settings) updateConnectionDisplays(result.settings);
        }
      } catch {
        showToast('Failed to save YouTube settings', 'error');
      } finally {
        saveYoutubeBtn.disabled = false;
      }
    });
  }

  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
  });

  closeSettings.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
  });

  if (settingsOverlay) {
    settingsOverlay.addEventListener('click', () => {
      settingsPanel.classList.remove('open');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsPanel.classList.contains('open')) {
      settingsPanel.classList.remove('open');
    }
  });

  onlineModeToggle.addEventListener('change', () => {
    const enabled = onlineModeToggle.checked;
    updateOnlineMode(enabled);
    const selectedVoice = filterVoices();
    savedVoice = selectedVoice || '';
    api('PATCH', '/api/settings', { section: 'tts', values: { onlineMode: enabled, engine: engineSelect.value, voice: selectedVoice } });
  });

  const updateVolume = debounce((val) => {
    api('PATCH', '/api/settings', { section: 'tts', values: { volume: parseInt(val) } });
  }, 300);

  volumeSlider.addEventListener('input', (e) => {
    volumeVal.textContent = e.target.value;
    updateVolume(e.target.value);
  });

  const updateRate = debounce((val) => {
    api('PATCH', '/api/settings', { section: 'tts', values: { rate: parseInt(val) } });
  }, 300);

  rateSlider.addEventListener('input', (e) => {
    rateVal.textContent = e.target.value;
    updateRate(e.target.value);
  });

  engineSelect.addEventListener('change', () => {
    const newVoice = filterVoices() || '';
    savedVoice = newVoice;
    savedSpeaker = speakerSelect && !speakerSelect.disabled ? (speakerSelect.value || '') : '';
    api('PATCH', '/api/settings', {
      section: 'tts',
      values: { engine: engineSelect.value, voice: newVoice, speaker: savedSpeaker }
    });
  });

  voiceSelect.addEventListener('change', () => {
    savedVoice = voiceSelect.value;
    savedVoiceByEngine[engineSelect.value] = voiceSelect.value;
    savedSpeaker = '';
    const voice = allVoices.find(v => v.engine === engineSelect.value && v.id === voiceSelect.value);
    updateSpeakerOptions(voice);
    const speaker = (speakerSelect && !speakerSelect.disabled) ? (speakerSelect.value || '') : '';
    savedSpeaker = speaker;
    api('PATCH', '/api/settings', { section: 'tts', values: { voice: voiceSelect.value, speaker } });
  });

  if (speakerSelect) {
    speakerSelect.addEventListener('change', () => {
      savedSpeaker = speakerSelect.value || '';
      api('PATCH', '/api/settings', { section: 'tts', values: { speaker: savedSpeaker } });
    });
  }

  speakUsernameToggle.addEventListener('change', () => {
    api('PATCH', '/api/settings', { section: 'tts', values: { speakUsername: speakUsernameToggle.checked } });
  });

  allowUserVoicesToggle.addEventListener('change', () => {
    api('PATCH', '/api/settings', { section: 'tts', values: { allowUserVoices: allowUserVoicesToggle.checked } });
  });

  const updateUserCooldown = debounce((val) => {
    api('PATCH', '/api/settings', { section: 'security', values: { perUserCooldownMs: parseInt(val) * 1000 } });
  }, 300);

  userCooldownSlider.addEventListener('input', (e) => {
    userCooldownVal.textContent = e.target.value + 's';
    updateUserCooldown(e.target.value);
  });

  const updateGlobalCooldown = debounce((val) => {
    api('PATCH', '/api/settings', { section: 'security', values: { globalCooldownMs: parseInt(val) * 1000 } });
  }, 300);

  globalCooldownSlider.addEventListener('input', (e) => {
    globalCooldownVal.textContent = e.target.value + 's';
    updateGlobalCooldown(e.target.value);
  });

  const updateMaxLength = debounce((val) => {
    api('PATCH', '/api/settings', { section: 'security', values: { maxMessageLength: parseInt(val) } });
  }, 300);

  maxLengthSlider.addEventListener('input', (e) => {
    maxLengthVal.textContent = e.target.value;
    updateMaxLength(e.target.value);
  });

  stripSsmlToggle.addEventListener('change', () => {
    api('PATCH', '/api/settings', { section: 'security', values: { stripSsml: stripSsmlToggle.checked } });
  });

  stripZalgoToggle.addEventListener('change', () => {
    api('PATCH', '/api/settings', { section: 'security', values: { stripZalgo: stripZalgoToggle.checked } });
  });

  stripUnicodeToggle.addEventListener('change', () => {
    api('PATCH', '/api/settings', { section: 'security', values: { stripUnicode: stripUnicodeToggle.checked } });
  });

  stripUrlsToggle.addEventListener('change', () => {
    api('PATCH', '/api/settings', { section: 'security', values: { stripUrls: stripUrlsToggle.checked } });
  });

  if (showLogsToggle) {
    showLogsToggle.addEventListener('change', () => {
      const show = showLogsToggle.checked;
      setLogVisibility(show);
      api('PATCH', '/api/settings', { section: 'ui', values: { showLogs: show } });
    });
  }

  function formatTime(ts) {
    const d = ts ? new Date(ts) : new Date();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function platformTagHTML(platform) {
    const p = platform || 'twitch';
    const label = p === 'youtube' ? 'YT' : p === 'twitch' ? 'TW' : p.substring(0, 2).toUpperCase();
    const icon = p === 'twitch' ? ICONS.twitch : p === 'youtube' ? ICONS.youtube : '';
    return `<span class="platform-tag ${p}">${icon}${label}</span>`;
  }

  function addFeedItem(data, isSpeaking) {
    const empty = feedList.querySelector('.feed-empty');
    if (empty) empty.remove();

    const platform = data.platform || 'twitch';
    const div = document.createElement('div');
    div.className = 'feed-item' + (isSpeaking ? ' speaking' : '');
    if (data.id) div.dataset.id = data.id;

    const num = document.createElement('div');
    num.className = 'feed-item-num';
    num.innerHTML = isSpeaking ? ICONS.speakingPlay : String(messageCount + 1);

    const body = document.createElement('div');
    body.className = 'feed-item-body';

    const meta = document.createElement('div');
    meta.className = 'feed-item-meta';

    const user = document.createElement('span');
    user.className = 'username';
    user.textContent = data.username || 'system';

    const time = document.createElement('span');
    time.className = 'timestamp';
    time.textContent = formatTime(data.timestamp);

    meta.appendChild(user);
    meta.insertAdjacentHTML('beforeend', platformTagHTML(platform));
    meta.appendChild(time);

    const text = document.createElement('p');
    text.className = 'text';
    text.textContent = data.text || '';

    body.appendChild(meta);
    body.appendChild(text);

    const del = document.createElement('button');
    del.className = 'feed-del';
    del.title = 'Remove from view';
    del.innerHTML = ICONS.trash;
    del.addEventListener('click', () => div.remove());

    div.appendChild(num);
    div.appendChild(body);
    div.appendChild(del);

    feedList.appendChild(div);
    messageCount++;
    feedCount.textContent = String(messageCount);

    while (feedList.children.length > MAX_FEED_ITEMS) {
      feedList.removeChild(feedList.firstChild);
    }

    const feed = feedList.parentElement;
    if (messageCount > 10) {
      feed.scrollTop = feed.scrollHeight;
    }
  }

  function markSpeaking(data) {
    let target = null;
    if (data.id) {
      target = feedList.querySelector(`.feed-item[data-id="${CSS.escape(String(data.id))}"]`);
    }

    if (!target && data.username) {
      const items = Array.from(feedList.querySelectorAll('.feed-item')).reverse();
      for (const item of items) {
        const uname = item.querySelector('.username');
        const txt = item.querySelector('.text');
        if (uname && txt && uname.textContent === data.username && txt.textContent === data.text) {
          target = item;
          break;
        }
      }
    }

    if (!target) return;

    const prev = feedList.querySelectorAll('.speaking');
    prev.forEach(el => {
      el.classList.remove('speaking');
      const num = el.querySelector('.feed-item-num');
      if (num && num.dataset.pos) num.innerHTML = num.dataset.pos;
    });

    target.classList.add('speaking');
    const num = target.querySelector('.feed-item-num');
    if (num) {
      if (!num.dataset.pos) num.dataset.pos = num.innerHTML;
      num.innerHTML = ICONS.speakingPlay;
    }
  }

  function clearSpeaking(data) {
    const speakingItems = data && data.id
      ? feedList.querySelectorAll(`.feed-item.speaking[data-id="${CSS.escape(String(data.id))}"]`)
      : feedList.querySelectorAll('.speaking');

    speakingItems.forEach(el => {
      el.classList.remove('speaking');
      const num = el.querySelector('.feed-item-num');
      if (num && num.dataset.pos) num.innerHTML = num.dataset.pos;
    });
  }

  function renderTags(container, values, dataKey) {
    if (!container) return;

    container.textContent = '';
    const safeValues = Array.isArray(values) ? values : [];

    for (const value of safeValues) {
      const tag = document.createElement('span');
      tag.className = 'tag';

      const remove = document.createElement('span');
      remove.className = 'remove';
      remove.dataset[dataKey] = value;
      remove.textContent = '×';

      tag.append(document.createTextNode(value + ' '), remove);
      container.appendChild(tag);
    }
  }

  function renderBlockedWords(words) {
    renderTags(blockedWordTags, words, 'word');
  }

  function renderBlockedUsers(users) {
    renderTags(blockedUserTags, users, 'user');
  }

  function renderPrefixes(prefixes) {
    renderTags(prefixTags, prefixes, 'prefix');
  }

  addBlockWordBtn.addEventListener('click', async () => {
    const word = blockWordInput.value.trim();
    if (!word) return;
    const result = await api('POST', '/api/blocklist/words', { action: 'add', word });
    renderBlockedWords(result.blockedWords || []);
    blockWordInput.value = '';
  });

  blockedWordTags.addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove')) {
      const word = e.target.dataset.word;
      const result = await api('POST', '/api/blocklist/words', { action: 'remove', word });
      renderBlockedWords(result.blockedWords || []);
    }
  });

  addBlockUserBtn.addEventListener('click', async () => {
    const user = blockUserInput.value.trim();
    if (!user) return;
    const result = await api('POST', '/api/blocklist/users', { action: 'add', user });
    renderBlockedUsers(result.blockedUsers || []);
    blockUserInput.value = '';
  });

  blockedUserTags.addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove')) {
      const user = e.target.dataset.user;
      const result = await api('POST', '/api/blocklist/users', { action: 'remove', user });
      renderBlockedUsers(result.blockedUsers || []);
    }
  });

  addPrefixBtn.addEventListener('click', async () => {
    const prefix = prefixInput.value.trim();
    if (!prefix) return;
    const result = await api('POST', '/api/blocklist/prefixes', { action: 'add', prefix });
    renderPrefixes(result.commandPrefixes || []);
    prefixInput.value = '';
  });

  prefixTags.addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove')) {
      const prefix = e.target.dataset.prefix;
      const result = await api('POST', '/api/blocklist/prefixes', { action: 'remove', prefix });
      renderPrefixes(result.commandPrefixes || []);
    }
  });

  function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}`);
    let retryDelay = 1000;

    ws.onopen = () => {
      retryDelay = 1000;
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'message':
          addFeedItem(msg.data, false);
          break;

        case 'audio-ready':
          playBrowserAudio(msg.data);
          break;

        case 'audio-control':
          if (!isAudioHostWindow()) break;
          if (!msg.data) break;

          if (msg.data.action === 'pause') {
            playbackAudio.pause();
          } else if (msg.data.action === 'resume') {
            if (currentAudioPlaybackId && (!msg.data.id || msg.data.id === currentAudioPlaybackId)) {
              playbackAudio.play().catch(async (err) => {
                const message = err && err.message ? err.message : 'Could not resume browser audio';
                await reportBrowserPlayback('/api/tts/browser/error', { id: currentAudioPlaybackId, message });
              });
            }
          } else if (msg.data.action === 'stop') {
            if (currentAudioPlaybackId && (!msg.data.id || msg.data.id === currentAudioPlaybackId)) {
              stopBrowserPlayback(true);
            }
          }
          break;

        case 'speaking':
          if (msg.data) markSpeaking(msg.data);
          break;

        case 'done':
          clearSpeaking(msg.data);
          break;

        case 'queue':
          queueCount.textContent = String(msg.data.length || 0);
          break;

        case 'settings':
          if (msg.data && msg.data.tts) {
            paused = msg.data.tts.paused;
            updatePauseBtn();
          }
          if (msg.data && msg.data.ui) {
            setLogVisibility(msg.data.ui.showLogs !== false);
          }
          if (msg.data) updateConnectionDisplays(msg.data);
          break;

        case 'channel-info':
          if (msg.data) updateChannelInfo(msg.data);
          break;

        case 'voice-set':
          if (msg.data.success) {
            showToast(`${msg.data.username} set voice to ${msg.data.voice}`, 'success');
          } else {
            showToast(`${msg.data.username}: no voice matching "${msg.data.query}"`, 'error');
          }
          break;

        case 'status':
          if (msg.data.platform) {
            updatePlatformStatus(msg.data.platform, msg.data.state);
          }
          break;

        case 'log':
          addLogEntry(msg.data);
          break;
      }
    };

    ws.onclose = () => {
      twitchBadge.classList.remove('active');
      youtubeBadge.classList.remove('active');
      if (settingsTwitchDot) settingsTwitchDot.classList.remove('active');
      if (settingsYtDot) settingsYtDot.classList.remove('active');
      setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, 10000);
        connectWS();
      }, retryDelay);
    };
  }

  if (channelName) channelName.textContent = '';
  bindRevealButtons();
  initBrowserAudioHost();
  fetch('/api/auth/key')
    .then(r => r.json())
    .then(data => { apiKey = data.key; })
    .then(() => loadSettings())
    .then(() => Promise.all([loadVoices(), loadLogs()]))
    .then(() => {
      loadChannelInfo();
      connectWS();
      return api('GET', '/api/status');
    })
    .then(status => {
      if (status.platforms) {
        for (const [platform, state] of Object.entries(status.platforms)) {
          updatePlatformStatus(platform, state);
        }
      }
    });
})();
