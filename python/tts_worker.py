"""
TTS Worker — Long-lived subprocess communicating via NDJSON over stdin/stdout.
Supports Piper (local neural), edge-tts (online neural), and pyttsx3 (SAPI).
Audio playback via Windows MCI API (zero dependencies).
"""

import sys
import json
import asyncio

# Force UTF-8 on stdio. Node sends JSON commands as UTF-8 bytes, but on Windows
# sys.stdin defaults to the system locale (often cp1252), which mangles any
# non-Latin1 byte into a lone surrogate (e.g. \udc81). That surrogate then
# crashes downstream encoders (edge-tts, piper) with "surrogates not allowed".
for stream in (sys.stdin, sys.stdout):
    try:
        stream.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass
import tempfile
import os
import ctypes
import atexit
import subprocess
import glob as glob_module
import wave
import struct
import threading
import time

# Silence pyttsx3/comtypes debug output
import logging
logging.disable(logging.CRITICAL)

TEMP_AUDIO_MP3 = os.path.join(tempfile.gettempdir(), 'blabbercast_audio.mp3')
TEMP_AUDIO_WAV = os.path.join(tempfile.gettempdir(), 'blabbercast_audio.wav')
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
USE_AUDIO_HOST = os.environ.get('BLABBERCAST_USE_AUDIO_HOST') == '1'

# Valid command types that this worker accepts
VALID_COMMANDS = {'speak', 'list_voices', 'pause', 'resume', 'stop', 'shutdown'}

# Windows MCI for audio playback
winmm = None
try:
    winmm = ctypes.windll.winmm
except Exception:
    pass

send_lock = threading.Lock()
state_lock = threading.Lock()
stop_requested = threading.Event()
pause_requested = threading.Event()
active_thread = None
active_proc = None
active_engine = None
active_msg_id = ''


def cleanup_temp_files():
    """Remove temp audio files on exit."""
    for f in (TEMP_AUDIO_MP3, TEMP_AUDIO_WAV):
        try:
            os.remove(f)
        except OSError:
            pass

atexit.register(cleanup_temp_files)


def send(msg):
    """Send NDJSON message to Node.js via stdout."""
    with send_lock:
        sys.stdout.write(json.dumps(msg) + '\n')
        sys.stdout.flush()


def send_error(msg_id, error_text):
    send({'type': 'error', 'id': msg_id, 'message': error_text})


def build_temp_audio_path(msg_id, ext):
    safe_id = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '_' for ch in (msg_id or 'tts'))
    return os.path.join(tempfile.gettempdir(), f'blabbercast_{safe_id}{ext}')


def play_audio(filepath, volume=80):
    """Play audio file using Windows MCI API. Blocks until done, paused, or stopped."""
    if not winmm:
        send_error('', 'Windows MCI not available')
        return False

    # Close any previous instance
    winmm.mciSendStringW('close tts_audio', None, 0, 0)

    # Auto-detect file type
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.wav':
        media_type = 'waveaudio'
    else:
        media_type = 'mpegvideo'

    ret = winmm.mciSendStringW(f'open "{filepath}" type {media_type} alias tts_audio', None, 0, 0)
    if ret != 0:
        return False

    stopped = False
    try:
        # Set volume (MCI range 0-1000)
        mci_vol = max(0, min(1000, int(volume * 10)))
        winmm.mciSendStringW(f'setaudio tts_audio volume to {mci_vol}', None, 0, 0)

        while pause_requested.is_set() and not stop_requested.is_set():
            time.sleep(0.05)

        ret = winmm.mciSendStringW('play tts_audio', None, 0, 0)
        if ret != 0:
            return False

        status = ctypes.create_unicode_buffer(64)
        while True:
            if stop_requested.is_set():
                stopped = True
                winmm.mciSendStringW('stop tts_audio', None, 0, 0)
                break

            if pause_requested.is_set():
                winmm.mciSendStringW('pause tts_audio', None, 0, 0)
                while pause_requested.is_set() and not stop_requested.is_set():
                    time.sleep(0.05)

                if stop_requested.is_set():
                    stopped = True
                    winmm.mciSendStringW('stop tts_audio', None, 0, 0)
                    break

                ret = winmm.mciSendStringW('resume tts_audio', None, 0, 0)
                if ret != 0:
                    winmm.mciSendStringW('play tts_audio', None, 0, 0)

            ret = winmm.mciSendStringW('status tts_audio mode', status, 64, 0)
            mode = status.value.lower()
            if ret != 0 or mode not in ('playing', 'paused'):
                break

            time.sleep(0.05)
    finally:
        winmm.mciSendStringW('close tts_audio', None, 0, 0)

    return not stopped


def prepend_silence_to_wav(filepath, silence_ms=250):
    """Prepend silence to a WAV file to prevent MCI audio device clipping the start."""
    try:
        with wave.open(filepath, 'rb') as wf:
            params = wf.getparams()
            frames = wf.readframes(wf.getnframes())

        silence_frames = int(params.framerate * silence_ms / 1000)
        silence = struct.pack('<' + ('h' * params.nchannels * silence_frames),
                              *([0] * params.nchannels * silence_frames))

        with wave.open(filepath, 'wb') as wf:
            wf.setparams(params)
            wf.writeframes(silence + frames)
    except Exception:
        pass  # If it fails, just play without silence padding


def stop_audio():
    """Stop currently playing audio."""
    stop_requested.set()
    pause_requested.clear()
    if winmm:
        winmm.mciSendStringW('stop tts_audio', None, 0, 0)
        winmm.mciSendStringW('close tts_audio', None, 0, 0)


def pause_audio():
    """Pause currently playing audio without closing it."""
    pause_requested.set()
    if winmm:
        winmm.mciSendStringW('pause tts_audio', None, 0, 0)


def resume_audio():
    """Resume paused audio."""
    pause_requested.clear()
    if winmm:
        ret = winmm.mciSendStringW('resume tts_audio', None, 0, 0)
        if ret != 0:
            winmm.mciSendStringW('play tts_audio', None, 0, 0)


def find_piper_executable():
    """Find the piper executable. Checks local models dir first, then PATH."""
    # Check for piper.exe in the project's models directory
    local_piper = os.path.join(MODELS_DIR, 'piper.exe')
    if os.path.isfile(local_piper):
        return local_piper

    # Check PATH
    import shutil
    piper_path = shutil.which('piper')
    if piper_path:
        return piper_path

    return None


def _resolve_piper_speaker(model_path, speaker):
    """Resolve a speaker (name or index) to a numeric index for this model.
    Returns an integer index, or None if the model is single-speaker or
    the speaker can't be resolved."""
    if speaker in (None, '', 0, '0'):
        # Empty speaker means default; 0 is also the default index — skip --speaker flag
        return None
    try:
        with open(model_path + '.json', 'r', encoding='utf-8') as f:
            cfg = json.load(f)
    except (OSError, ValueError, json.JSONDecodeError):
        return None

    if cfg.get('num_speakers', 1) <= 1:
        return None

    speaker_map = cfg.get('speaker_id_map', {}) or {}

    # Speaker may arrive as a name ("p3922") or a numeric index (as int or str)
    if isinstance(speaker, str) and speaker in speaker_map:
        return int(speaker_map[speaker])
    try:
        idx = int(speaker)
    except (TypeError, ValueError):
        return None
    if 0 <= idx < cfg.get('num_speakers', 1):
        return idx
    return None


def speak_piper(text, voice, rate, volume, msg_id, speaker=None):
    """Generate and play audio using Piper TTS (local neural)."""
    global active_proc
    output_path = build_temp_audio_path(msg_id, '.wav') if USE_AUDIO_HOST else TEMP_AUDIO_WAV
    try:
        piper_exe = find_piper_executable()
        if not piper_exe:
            send_error(msg_id, 'Piper TTS runtime is missing from the models folder.')
            return

        # Resolve model path
        model_path = voice
        if not os.path.isabs(voice):
            model_path = os.path.join(MODELS_DIR, voice)
            # Add .onnx extension if not present
            if not model_path.endswith('.onnx'):
                model_path += '.onnx'

        if not os.path.isfile(model_path):
            send_error(msg_id, f'Piper model not found: {model_path}')
            return

        # Build piper command
        cmd = [
            piper_exe,
            '--model', model_path,
            '--output_file', output_path
        ]

        # Multi-speaker: pass --speaker <index> if the model supports it
        speaker_idx = _resolve_piper_speaker(model_path, speaker)
        if speaker_idx is not None:
            cmd.extend(['--speaker', str(speaker_idx)])

        # Map rate to length_scale (inverse: higher rate = lower scale)
        # rate: -50..+50, default 0. length_scale default = 1.0
        # rate +50 -> speak fast -> scale 0.5
        # rate -50 -> speak slow -> scale 1.5
        if rate != 0:
            length_scale = max(0.3, min(2.0, 1.0 - (rate / 100.0)))
            cmd.extend(['--length_scale', str(length_scale)])

        if stop_requested.is_set():
            send({'type': 'done', 'id': msg_id})
            return

        # Run piper, feeding text via stdin.
        # Force UTF-8 (not locale/cp1252) — otherwise any char outside cp1252
        # (combining marks, emoji, non-Latin scripts) crashes the worker.
        # errors='replace' turns any stray unpaired surrogates into U+FFFD
        # so a malformed message never kills the subprocess.
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace'
        )

        with state_lock:
            active_proc = proc

        if stop_requested.is_set():
            try:
                proc.terminate()
            except Exception:
                pass

        try:
            stdout, stderr = proc.communicate(input=text, timeout=30)
        finally:
            with state_lock:
                if active_proc is proc:
                    active_proc = None

        if stop_requested.is_set():
            send({'type': 'done', 'id': msg_id})
            return

        if proc.returncode != 0:
            send_error(msg_id, f'Piper error: {stderr.strip()}')
            return

        prepend_silence_to_wav(output_path)
        if USE_AUDIO_HOST:
            send({'type': 'audio_ready', 'id': msg_id, 'path': output_path, 'volume': volume})
            return

        send({'type': 'speaking', 'id': msg_id})
        play_audio(output_path, volume)
        send({'type': 'done', 'id': msg_id})

        # Clean up
        try:
            os.remove(output_path)
        except OSError:
            pass

    except subprocess.TimeoutExpired:
        with state_lock:
            proc_to_kill = active_proc
            active_proc = None
        if proc_to_kill:
            try:
                proc_to_kill.kill()
            except Exception:
                pass
        send_error(msg_id, 'Piper TTS timed out')
    except Exception as e:
        send_error(msg_id, str(e))


async def speak_edge_tts(text, voice, rate, volume, msg_id):
    """Generate and play audio using edge-tts."""
    output_path = build_temp_audio_path(msg_id, '.mp3') if USE_AUDIO_HOST else TEMP_AUDIO_MP3
    try:
        import edge_tts

        # Format rate for edge-tts (e.g., "+10%", "-20%")
        rate_str = f'{rate:+d}%' if rate != 0 else '+0%'

        communicate = edge_tts.Communicate(text, voice, rate=rate_str)
        await communicate.save(output_path)

        if stop_requested.is_set():
            send({'type': 'done', 'id': msg_id})
            return

        if USE_AUDIO_HOST:
            send({'type': 'audio_ready', 'id': msg_id, 'path': output_path, 'volume': volume})
            return

        send({'type': 'speaking', 'id': msg_id})
        play_audio(output_path, volume)
        send({'type': 'done', 'id': msg_id})

        # Clean up temp file
        try:
            os.remove(output_path)
        except OSError:
            pass

    except Exception as e:
        send_error(msg_id, str(e))


def speak_sapi(text, voice, rate, volume, msg_id):
    """Generate and play audio using pyttsx3 (SAPI5)."""
    global active_engine
    output_path = build_temp_audio_path(msg_id, '.wav') if USE_AUDIO_HOST else TEMP_AUDIO_WAV
    try:
        import pyttsx3

        engine = pyttsx3.init()
        with state_lock:
            active_engine = engine

        # Set voice if specified
        if voice:
            voices = engine.getProperty('voices')
            for v in voices:
                if v.id == voice or v.name == voice:
                    engine.setProperty('voice', v.id)
                    break

        # Map rate: 0 = default (200 wpm), range roughly -50..+50 maps to 100..300
        wpm = 200 + (rate * 2)
        wpm = max(50, min(400, wpm))
        engine.setProperty('rate', wpm)

        # Volume: 0-100 maps to 0.0-1.0
        engine.setProperty('volume', max(0.0, min(1.0, volume / 100.0)))

        if stop_requested.is_set():
            send({'type': 'done', 'id': msg_id})
            return

        engine.save_to_file(text, output_path)
        engine.runAndWait()
        engine.stop()

        if stop_requested.is_set():
            send({'type': 'done', 'id': msg_id})
            return

        if USE_AUDIO_HOST:
            send({'type': 'audio_ready', 'id': msg_id, 'path': output_path, 'volume': volume})
            return

        send({'type': 'speaking', 'id': msg_id})
        play_audio(output_path, volume)
        send({'type': 'done', 'id': msg_id})

        try:
            os.remove(output_path)
        except OSError:
            pass

    except Exception as e:
        send_error(msg_id, str(e))
    finally:
        with state_lock:
            active_engine = None


def list_piper_voices():
    """List available Piper voice models from the models directory."""
    voices = []
    if not os.path.isdir(MODELS_DIR):
        return voices

    for onnx_file in glob_module.glob(os.path.join(MODELS_DIR, '*.onnx')):
        name = os.path.splitext(os.path.basename(onnx_file))[0]
        voice = {
            'id': name,
            'name': f'Piper: {name}',
            'engine': 'piper',
            'locale': name.split('-')[0] + '-' + name.split('-')[1] if '-' in name else '',
            'gender': ''
        }

        # Attach speaker list for multi-speaker models (from the .onnx.json sidecar)
        try:
            with open(onnx_file + '.json', 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            if cfg.get('num_speakers', 1) > 1:
                speaker_map = cfg.get('speaker_id_map', {}) or {}
                if speaker_map:
                    ordered = sorted(speaker_map.items(), key=lambda kv: kv[1])
                    voice['speakers'] = [name for name, _ in ordered]
        except (OSError, ValueError, json.JSONDecodeError):
            pass  # Sidecar missing or malformed — treat as single-speaker

        voices.append(voice)

    return voices


async def list_voices():
    """Enumerate voices from all engines."""
    voices = []

    # Piper voices (local models)
    voices.extend(list_piper_voices())

    # Edge-TTS voices
    try:
        import edge_tts
        edge_voices = await edge_tts.list_voices()
        # Keep the dropdown manageable: English + Japanese (Piper has no Japanese)
        allowed_locale_prefixes = ('en-', 'ja-')
        for v in edge_voices:
            locale = v.get('Locale', '')
            if locale.startswith(allowed_locale_prefixes):
                voices.append({
                    'id': v['ShortName'],
                    'name': v['FriendlyName'],
                    'engine': 'edge-tts',
                    'locale': locale,
                    'gender': v.get('Gender', '')
                })
    except Exception as e:
        send_error('', f'Failed to list edge-tts voices: {e}')

    # SAPI voices
    try:
        import pyttsx3
        engine = pyttsx3.init()
        sapi_voices = engine.getProperty('voices')
        for v in sapi_voices:
            voices.append({
                'id': v.id,
                'name': v.name,
                'engine': 'sapi',
                'locale': '',
                'gender': ''
            })
        engine.stop()
    except Exception as e:
        send_error('', f'Failed to list SAPI voices: {e}')

    return voices


def validate_command(cmd):
    """Validate that a parsed command has expected structure."""
    if not isinstance(cmd, dict):
        return False, 'Command must be a JSON object'

    cmd_type = cmd.get('type')
    if not cmd_type or cmd_type not in VALID_COMMANDS:
        return False, f'Unknown command type: {cmd_type}'

    if cmd_type == 'speak':
        text = cmd.get('text')
        if not isinstance(text, str) or not text.strip():
            return False, 'Speak command requires non-empty text string'
        engine = cmd.get('engine', '')
        if engine and engine not in ('piper', 'edge-tts', 'sapi'):
            return False, f'Unknown engine: {engine}'

    return True, ''


def finish_active(msg_id):
    global active_msg_id
    with state_lock:
        if active_msg_id == msg_id:
            active_msg_id = ''


def run_speak_command(cmd):
    msg_id = cmd.get('id', '')
    try:
        text = cmd.get('text', '')
        engine = cmd.get('engine', 'piper')
        voice = cmd.get('voice', 'en_US-lessac-medium')
        rate = cmd.get('rate', 0)
        volume = cmd.get('volume', 80)
        speaker = cmd.get('speaker', '')

        # Clamp numeric values
        rate = max(-50, min(50, int(rate)))
        volume = max(0, min(100, int(volume)))

        if stop_requested.is_set():
            send({'type': 'done', 'id': msg_id})
            return

        if engine == 'piper':
            speak_piper(text, voice, rate, volume, msg_id, speaker=speaker)
        elif engine == 'edge-tts':
            asyncio.run(speak_edge_tts(text, voice, rate, volume, msg_id))
        elif engine == 'sapi':
            speak_sapi(text, voice, rate, volume, msg_id)
        else:
            send_error(msg_id, f'Unknown engine: {engine}')
    finally:
        finish_active(msg_id)


def start_speaking(cmd):
    global active_thread, active_msg_id
    previous_thread = None

    with state_lock:
        if active_thread and active_thread.is_alive():
            previous_thread = active_thread

    if previous_thread:
        previous_thread.join(timeout=1.0)

    with state_lock:
        if active_thread and active_thread.is_alive():
            return False

        stop_requested.clear()
        active_msg_id = cmd.get('id', '')
        active_thread = threading.Thread(target=run_speak_command, args=(cmd,), daemon=True)
        active_thread.start()
        return True


def stop_current_speech():
    stop_audio()

    with state_lock:
        proc = active_proc
        engine = active_engine

    if proc:
        try:
            proc.terminate()
        except Exception:
            pass

    if engine:
        try:
            engine.stop()
        except Exception:
            pass


def main():
    """Main loop — read NDJSON from stdin, process commands."""
    # List voices on startup
    voices = asyncio.run(list_voices())

    send({'type': 'ready'})

    # Read commands from stdin line by line
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break  # stdin closed

            line = line.strip()
            if not line:
                continue

            cmd = json.loads(line)

            # Validate command structure
            valid, err_msg = validate_command(cmd)
            if not valid:
                send_error(cmd.get('id', ''), err_msg)
                continue

            cmd_type = cmd.get('type', '')
            msg_id = cmd.get('id', '')

            if cmd_type == 'speak':
                if not start_speaking(cmd):
                    send_error(msg_id, 'TTS worker is already speaking')

            elif cmd_type == 'list_voices':
                send({'type': 'voices', 'id': msg_id, 'voices': voices})

            elif cmd_type == 'pause':
                if not USE_AUDIO_HOST:
                    pause_audio()

            elif cmd_type == 'resume':
                if not USE_AUDIO_HOST:
                    resume_audio()

            elif cmd_type == 'stop':
                stop_current_speech()

            elif cmd_type == 'shutdown':
                stop_current_speech()
                break

        except json.JSONDecodeError:
            send_error('', 'Invalid JSON')
        except Exception as e:
            send_error('', str(e))

    sys.exit(0)


if __name__ == '__main__':
    main()
