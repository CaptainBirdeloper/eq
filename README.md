# PulseEQ — Zero-Latency Studio Audio Equalizer for Windows

A lightweight, zero-latency system audio equalizer for Windows. PulseEQ runs quietly in your Windows notification tray with near-zero CPU and memory usage (<20MB RAM, 0% CPU idle). Clicking the tray icon opens a studio-grade web interface in your default browser.

---

## ⚡ How It Achieves Zero Latency

Unlike standard Python audio interceptors that introduce 15–30ms of buffer delay and potential audio crackles:
- **Audio DSP is processed at the Windows driver boundary** via **[Equalizer APO](https://sourceforge.net/projects/equalizerapo/)** in native C++.
- **PulseEQ** acts as the real-time background manager, calculating filter math, synchronizing presets, providing a tray icon, and serving the responsive Web UI on `http://127.0.0.1:8765`.
- Result: **0 ms added input delay, 100% glitch-free audio, and near-zero CPU consumption.**

---

## 🚀 Quick Start

### 1. Launch PulseEQ
Double-click `run.bat` or run:
```powershell
python main.py
```
*(To launch silently in the background without any command prompt window, use `pythonw main.py` or double-click `run.bat`).*

### 2. Open the Equalizer
- Click the **PulseEQ** icon in your Windows system tray (bottom-right notification area).
- Your default web browser will open `http://127.0.0.1:8765`.

---

## 🎧 Features

- **10-Band ISO Graphic & Parametric EQ**: 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz (-15 dB to +15 dB).
- **Master Preamp Gain**: -20 dB to +20 dB.
- **Dynamic 60fps Frequency Response Spectrum**: Real-time logarithmic canvas rendering of the composite filter curve.
- **Built-in Presets**:
  - *Flat* (Reference uncolored)
  - *Bass Boost* (Punchy lows)
  - *Sub-Bass Rumble* (Cinematic sub-bass)
  - *FPS / Footsteps* (Acoustic cues boosted, explosion rumble tamed)
  - *Vocal Clarity* (Dialogue and podcasts)
  - *Treble Crisp* (Cymbals and string sparkle)
  - *EDM Club* (Punchy V-curve)
  - *Rock / Guitar* (Mid punch and presence)
  - *Movie Dialogue* (Speech enhancement)
- **Custom User Presets**: Save and name your own tailored EQ curves.
- **Double-Click Reset**: Double-click any slider or the preamp to instantly snap back to `0.0 dB`.
- **Master Bypass**: One-click toggle between bypassed and active EQ with visual LED feedback.
- **Run on Windows Startup**: Toggle directly from the system tray context menu.

---

## 🛠️ Equalizer APO Setup (One-Time Setup)

PulseEQ automatically syncs live filters to `py_equalizer.txt`. If you have not yet installed Equalizer APO:

1. Download and install **[Equalizer APO](https://sourceforge.net/projects/equalizerapo/)** (Free & Open Source).
2. During setup, the **Configurator** will ask you to check the audio playback devices you want to equalize (e.g. *Speakers* or *Headphones*).
3. Restart your PC if prompted by Windows.
4. That's it! PulseEQ will automatically detect Equalizer APO and direct zero-latency audio filtering will be active.

---

## 📁 Architecture & File Structure

The project is structured into focused, modular domains to avoid context bloat:

```text
EQ/
├── main.py                  # Single entry point
├── run.bat                  # Silent background launcher
├── data/
│   └── eq_settings.json     # Persisted user settings and custom presets
├── src/
│   ├── core/
│   │   ├── config.py        # Settings management, ISO frequencies, presets
│   │   └── apo_bridge.py    # Atomic Equalizer APO syntax generator & bridge
│   ├── server/
│   │   └── http_server.py   # REST API server & static asset dispatcher
│   └── tray/
│       └── tray_app.py      # Windows system tray controller & icon generator
├── web/
│   ├── index.html           # Semantic HTML5 studio layout
│   ├── css/
│   │   └── style.css        # OLED dark theme & Fairlight design tokens
│   └── js/
│       ├── app.js           # Main coordinator & network synchronization
│       ├── state.js         # Reactive state & coordinate mapping
│       ├── audio_math.js    # Biquad filter response mathematics
│       ├── canvas_view.js   # Canvas graph rendering & draggable nodes
│       └── keyboard.js      # WCAG 2.2 AA keyboard navigation & steppers
└── tests/
    └── test_eq.py           # Comprehensive integration & unit tests
```

---

## 🧪 Testing

Run the automated test suite:
```powershell
python -m unittest discover tests
```
*(Tests settings persistence, APO syntax generation, REST API endpoints, ES module assets, and tray icon rendering).*

