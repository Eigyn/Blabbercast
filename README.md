# Blabbercast

Local-only Node.js service that reads Twitch and YouTube live chat aloud through a TTS engine of your choice. The server binds to `127.0.0.1` and ships a small browser dashboard for control.

## What it does

- Connects to Twitch chat via IRC (`tmi.js`) and/or YouTube live chat (unofficial scraping via `youtube-chat`).
- Sanitises each message (length cap, blocked words/users, command-prefix filter, SSML/HTML stripping, dangerous-unicode and zalgo filtering, URL stripping, per-user and global cooldowns) before queueing.
- Hands queued text to a Python worker that synthesises audio with one of three engines: **Piper** (local neural), **Microsoft SAPI** (local), or **Edge TTS** (Microsoft Azure, online).
- Streams the resulting audio to a browser tab over WebSockets so playback uses the browser's audio output.

## What it does NOT do

- It does **not** post anything back to Twitch or YouTube — it is read-only.
- It does **not** open any port outside `127.0.0.1`. There is no remote control surface.
- It does **not** store or log chat messages to disk.
- It is **not** affiliated with Twitch, YouTube, or Microsoft.

## Requirements

- Windows 10 / 11 (the audio host uses the Windows `winmm` MCI API)
- Node.js 18 or newer
- Python 3.9+ with `pip install -r requirements.txt` (or only the engines you plan to use)
- PowerShell, included with Windows 10 / 11, for the Piper download step

## Source Setup

After downloading or cloning the source from GitHub, run:

```bat
setup.bat
```

Blabbercast ships with `config.example.json` for safe Piper-first defaults. Runtime settings are saved to `config.local.json`, which is gitignored.
`setup.bat` creates `config.local.json`, `.env`, and `models/` when they are missing. It also downloads Piper's pinned Windows runtime and a starter pack of local voices into `models/` for offline TTS.

Useful setup flags:

```bat
setup.bat --check
setup.bat --skip-piper
setup.bat --skip-python
setup.bat --minimal-piper
setup.bat --starter-piper
setup.bat --all-piper
```

When run by double-clicking, `setup.bat` asks which Piper voice pack to install. The recommended `starter` pack installs six voices: `en_US-lessac-medium`, `en_US-ryan-medium`, `en_US-amy-low`, `en_GB-alan-medium`, `en_GB-alba-medium`, and `en_GB-cori-medium`. Use `--minimal-piper` for only `en_US-lessac-medium`, or `--all-piper` for every voice in the catalog.

You can inspect or manually download specific Piper voices with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-piper.ps1 -List
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-piper.ps1 -Voices en_US-ryan-medium,en_GB-alba-medium
```

If you want Twitch live viewer counts and authenticated calls, register an application at <https://dev.twitch.tv/console> and set credentials in `.env`:

```bash
notepad .env
```

Environment variables take precedence over local config for credentials. Do not commit `.env`, `config.local.json`, or legacy `config.json`.

## Run

```bat
Blabbercast.bat
```

Double-click `Blabbercast.vbs` if you want to start Blabbercast without the command window.

Or run from a terminal:

```bash
npm run start:open
```

The dashboard opens at <http://localhost:3000>.

## Packaged Windows Build

The GitHub source release intentionally does not include `Blabbercast.exe`, `node_modules/`, `runtime/`, or `models/`. Those are generated or bundled artifacts.

For a packaged build, `Blabbercast.exe` is the no-setup launcher: it is expected to sit next to the bundled Node/Python runtimes and installed dependencies. `Blabbercast.bat` is the alternate launcher for the same folder, and also works from source after `setup.bat` has installed dependencies.

## Project layout

```
server.js           Express + WebSocket entry point
setup.bat           Windows source setup helper
Blabbercast.bat     Windows launcher for source or packaged folders
Blabbercast.vbs     Quiet Windows launcher that hides the command window
config.example.json Safe example settings; local settings are written to config.local.json
scripts/            Setup helpers, including the Piper runtime/model downloader
src/
  adapters/         Twitch + YouTube chat adapter implementations
  queue/            In-memory FIFO message queue (drop-oldest at 50)
  security/         Sanitiser + IP-bucketed rate limiter
  server/           Express routes, WebSocket server, console -> UI log relay
  settings/         JSON-backed settings with secret redaction + env overrides
  tts/              Node <-> Python TTS bridge and per-user voice map
  twitch/           Twitch Helix API client (viewer count polling)
python/
  tts_worker.py     Long-lived NDJSON worker: Piper / Edge TTS / SAPI
public/             Browser dashboard (vanilla JS, no build step)
```

## Security notes

- All mutating HTTP endpoints require an `X-API-Key` header. The key is generated fresh at every server start (`crypto.randomBytes(32)`) and only handed to same-origin callers via `GET /api/auth/key`.
- CORS allows only `http://localhost:<port>` and `http://127.0.0.1:<port>`. Same restriction applies to WebSocket origins.
- Response headers set: `Content-Security-Policy` (self only), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.
- Rate limiter caps mutating endpoints at 30 req/min per IP; `/api/shutdown` at 1 req per 10 s.
- `getSafe()` redacts `clientId` / `clientSecret` from any settings response.
- Settings are persisted to gitignored `config.local.json` by default. `config.example.json` is the only config file intended for source control.
- Settings updater rejects `__proto__` / `constructor` / `prototype` keys, validates types against defaults, and ignores writes to non-allowlisted sections.
- The source setup downloads Piper from the rhasspy GitHub release `2023.11.14-2` and voices from rhasspy's Piper voices repository at tag `v1.0.0`; downloaded files are hash-checked before use.

## License

MIT — see `LICENSE.md` for the full text and third-party / use-at-your-own-risk disclaimers.
