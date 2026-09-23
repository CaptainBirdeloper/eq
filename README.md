# PulseEQ

PulseEQ is a zero-latency system equalizer for Windows. It combines a high-contrast AMOLED web interface with a lightweight system tray controller. Audio filtering is handled at the driver level by Equalizer APO in native C++, adding zero buffer latency and keeping CPU usage near zero.

---

## How to Download from GitHub

If you are unfamiliar with GitHub:
1. Scroll to the top of this repository page.
2. Click the green **Code** button near the top right.
3. Click **Download ZIP** in the dropdown menu.
4. Locate the downloaded file (usually in your `Downloads` folder).
5. Right-click the `.zip` file and select **Extract All...**, then click **Extract**.
6. Open the extracted `eq-main` folder.

---

## Setup Guide

### Method 1: Automatic One-Click Setup (Recommended)

1. **Install Equalizer APO** (Required audio engine):
   - Download the installer from [Equalizer APO on SourceForge](https://sourceforge.net/projects/equalizerapo/).
   - Run the installer. During setup, the **Configurator** will open.
   - Check the box next to your playback device (for example, *Speakers* or *Headphones*).
   - Finish installation and restart Windows when prompted.

2. **Run PulseEQ Setup**:
   - In the extracted folder, double-click **`setup.bat`**.
   - The script installs required Python libraries (`pystray` and `pillow`), verifies that Equalizer APO is linked to PulseEQ, and starts the application in your system tray.
   - Your default browser will open `http://127.0.0.1:8765`.

3. **Enable Start with Windows**:
   - Look at the Windows notification tray in the bottom-right corner of your taskbar (near the clock).
   - Right-click the PulseEQ equalizer icon.
   - Click **Start with Windows**. PulseEQ will now launch silently in the background on PC startup.

---

### Method 2: Manual Setup

1. Link Equalizer APO to PulseEQ:
   Open `C:\Program Files\EqualizerAPO\config\config.txt` in Notepad and add this line to the bottom:
   ```text
   Include: py_equalizer.txt
   ```
   Save and close the file.

2. Install Python dependencies:
   ```powershell
   pip install pystray pillow
   ```

3. Launch PulseEQ:
   ```powershell
   pythonw main.py
   ```
   *(Using `pythonw` runs the process silently without a command prompt window).*

4. Open the interface in any web browser:
   ```text
   http://127.0.0.1:8765
   ```

---

## Interface Overview

PulseEQ uses an AMOLED monochrome layout designed for high contrast and minimal clutter.

- **Unified Top Bar**: Houses branding, the master power toggle, presets dock, save preset button, global Q factor stepper, and the Q scroll lock toggle.
- **Edge-to-Edge Spectrum Viewport**: The response curve and grid lines extend to the canvas edges with zero margin cutoffs, showing exact filter curves across 20 Hz to 20,000 Hz.
- **Master Output Gain Column**: Vertical slider on the right side controls system-wide digital preamp from -20 dB to +20 dB. Double-clicking the meter snaps gain back to 0.0 dB.

---

## Built-in Presets

PulseEQ includes permanent default presets suited for reference listening, bass extension, and video editing:

- **Flat**: Pure reference curve with 0.0 dB gain across all bands. Useful for checking audio without coloration.
- **Bass Boost**: Extended low-frequency curve with vocal presence. Features wide low-end lift (35 Hz to 400 Hz) with an upper-mid boost at 1.4 kHz to keep voices clear.
- **YouTube Preview**: Designed for video editors and creators. Auditions audio through common YouTube delivery conditions:
  - `-1.0 dB` Preamp: Simulates YouTube True Peak safety headroom to reveal inter-sample distortion before rendering.
  - `-2.0 dB @ 32 Hz`: Cuts sub-rumble that triggers YouTube loudness ducking.
  - `-1.0 dB @ 250 Hz`: Reduces low-mid boxiness heard on phone and laptop speakers.
  - `+1.2 dB @ 2 kHz & +0.8 dB @ 4 kHz`: Mimics vocal presence needed for clear speech.
  - `-3.0 dB @ 16 kHz`: Replicates lossy Opus/AAC high-frequency encoding compression cut.

---

## Custom Presets

- Click **Save** in the top bar to store your current curve under any name.
- PulseEQ never overwrites existing presets. Saving with an existing name automatically creates a numbered copy (for example, `Preset (1)`).
- Custom presets show an `x` button allowing single-click deletion.
- Edits made while listening to a preset do not alter the saved preset file until you explicitly click Save.

---

## Q Factor & Scroll Lock

- **Global Q Factor**: Adjusts the filter bandwidth across all 10 bands simultaneously. Lower values produce broad, gentle slopes; higher values produce narrow, surgical peaks.
- **Adjusting Q**: Use the `+` and `-` buttons in the header, press `PageUp` or `PageDown`, or scroll your mouse wheel over the graph.
- **Scroll Lock Button**: Click the small lock icon next to the Q counter. When active, mouse wheel scrolling over the graph is disabled to prevent accidental changes while navigating.

---

## Keyboard Shortcuts

Click inside the graph area to activate keyboard controls:

| Key | Action |
| --- | --- |
| `1` through `9`, `0` | Select band 1 through 10 |
| `[` and `]` | Cycle through bands |
| `Up` / `Down` | Adjust gain by 0.5 dB (hold `Shift` for 0.1 dB precision) |
| `Left` / `Right` | Adjust band center frequency |
| `PageUp` / `PageDown` | Adjust global Q factor across all bands |
| `Delete` / `Backspace` / `Home` | Reset selected band gain to 0.0 dB |
| `B` or `Space` | Toggle master equalizer bypass on or off |

---

## Troubleshooting

### Audio does not change when moving sliders
1. Make sure Equalizer APO is installed and your playback device was selected in the Equalizer APO Configurator.
2. Confirm you restarted your computer after installing Equalizer APO.
3. Check `C:\Program Files\EqualizerAPO\config\config.txt` and make sure `Include: py_equalizer.txt` is present at the end of the file.

### How do I close PulseEQ completely?
Right-click the PulseEQ icon in your Windows notification tray and select **Exit PulseEQ**.

### How do I reset a slider back to zero?
Double-click any band handle or the Master Out preamp readout to snap it back to 0.0 dB.

---

## Project Structure

```text
EQ/
├── main.py                  # Application entry point
├── run.bat                  # Background launcher
├── setup.bat                # Root one-click installer shortcut
├── setup/
│   ├── install.bat          # Dependency installer and launcher
│   ├── link_apo.ps1         # Equalizer APO auto-linker script
│   └── requirements.txt     # Python package dependencies
├── data/
│   ├── eq_settings.json     # User presets and persistent settings
│   └── py_equalizer.txt     # Generated Equalizer APO commands
├── src/
│   ├── core/
│   │   ├── config.py        # Settings manager and default presets
│   │   └── apo_bridge.py    # Equalizer APO syntax generator
│   ├── server/
│   │   └── http_server.py   # Zero-latency local HTTP server
│   └── tray/
│       └── tray_app.py      # System tray icon and menu handler
├── web/
│   ├── index.html           # AMOLED UI layout
│   ├── css/
│   │   └── style.css        # Minimal monochrome stylesheet
│   └── js/
│       ├── app.js           # Main event orchestrator
│       ├── state.js         # Centralized state management
│       ├── audio_math.js    # Biquad filter calculations
│       ├── canvas_view.js   # Edge-to-edge canvas graph renderer
│       └── keyboard.js      # Accessible keyboard navigation
└── tests/
    └── test_eq.py           # Test suite
```

---

## Running Tests

Run the test suite from the project root:
```powershell
python -m unittest discover tests
```
