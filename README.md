# PulseEQ

A system equalizer for Windows with an AMOLED web interface and system tray controls. PulseEQ applies audio filters directly through Equalizer APO at the driver level, keeping audio latency at zero.

## Setup

### Automatic One-Click Setup (Recommended)
1. Install [Equalizer APO](https://sourceforge.net/projects/equalizerapo/) and select your audio device in its Configurator. Restart when prompted.
2. Double-click `setup.bat` (or run `setup\install.bat`). It installs dependencies, verifies the Equalizer APO config link, and launches the app.
3. Right-click the PulseEQ icon in your Windows system tray and select **Start with Windows** so it loads on boot.

### Manual Setup
1. Add this line to the bottom of `C:\Program Files\EqualizerAPO\config\config.txt`:
```text
Include: py_equalizer.txt
```
2. Install Python dependencies:
```powershell
pip install pystray pillow
```
3. Run `run.bat` or `pythonw main.py`.
4. Open `http://127.0.0.1:8765` in your browser.

## Features

- **10-Band EQ**: Adjust gain (-15 dB to +15 dB) and frequencies across all 10 bands.
- **Global Q Control**: Modify bandwidth across all points at once using the header steppers or mouse wheel.
- **Q Scroll Lock**: Toggle the lock icon to disable mouse wheel adjustments and prevent accidental changes.
- **AMOLED Interface**: High-contrast pure black and white theme designed for clarity and screen space.
- **Edge-to-Edge Response Curve**: Shows the real-time calculated filter curve across the full 20 Hz to 20,000 Hz spectrum.
- **Master Preamp Gain**: Adjust overall level from -20 dB to +20 dB.
- **Custom Presets**: Create, save, and delete custom profiles. Existing presets are never overwritten automatically.
- **YouTube Preview Preset**: Auditions the audio curve against YouTube's -14 LUFS loudness ceiling, vocal presence curve, and high-frequency compression cut.
- **System Tray Menu**: Right-click the tray icon to switch presets, toggle bypass, enable startup with Windows, or exit.

## Keyboard Shortcuts

Click inside the graph area to use keyboard shortcuts:

| Key | Action |
| --- | --- |
| `1` to `9`, `0` | Select band 1 to 10 |
| `[` and `]` | Cycle through bands |
| `Up` / `Down` | Adjust gain (hold `Shift` for 0.1 dB precision) |
| `Left` / `Right` | Adjust band frequency |
| `PageUp` / `PageDown` | Increase or decrease global Q factor |
| `Delete` / `Backspace` / `Home` | Reset selected band to 0.0 dB |
| `B` / `Space` | Toggle bypass |

## Architecture

```text
EQ/
├── main.py                  # Application entry point
├── run.bat                  # Background launcher
├── data/
│   └── eq_settings.json     # Saved user presets and current settings
├── src/
│   ├── core/
│   │   ├── config.py        # Settings storage and preset definitions
│   │   └── apo_bridge.py    # Equalizer APO file writer
│   ├── server/
│   │   └── http_server.py   # Local API and asset server
│   └── tray/
│       └── tray_app.py      # System tray icon and menu
├── web/
│   ├── index.html           # Structure and controls
│   ├── css/
│   │   └── style.css        # AMOLED styles
│   └── js/
│       ├── app.js           # Event coordinator
│       ├── state.js         # Reactive state store
│       ├── audio_math.js    # Biquad filter transfer calculations
│       ├── canvas_view.js   # Canvas curve and handle rendering
│       └── keyboard.js      # Keyboard navigation
└── tests/
    └── test_eq.py           # Unit and integration test suite
```

## Testing

Run the test suite:
```powershell
python -m unittest discover tests
```
