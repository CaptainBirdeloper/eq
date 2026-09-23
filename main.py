"""
Main entry point for PulseEQ: Zero-Latency System Equalizer.
Initializes configuration, launches the background HTTP server,
and runs the system tray icon loop.
"""

import sys
import argparse
import webbrowser
from pathlib import Path

# Add src to sys.path
SRC_DIR = Path(__file__).resolve().parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from core.config import SettingsManager
from core.apo_bridge import ApoBridge
from server.http_server import EqualizerServer
from tray.tray_app import TrayApp


def main():
    parser = argparse.ArgumentParser(description="PulseEQ Zero-Latency Audio Equalizer")
    parser.add_argument("--no-tray", action="store_true", help="Run without system tray icon (headless server mode)")
    parser.add_argument("--open", action="store_true", help="Automatically open web interface in browser on start")
    parser.add_argument("--port", type=int, default=8765, help="HTTP server port (default: 8765)")
    args = parser.parse_args()

    print("=" * 60)
    print(" PulseEQ - Zero-Latency System Audio Equalizer")
    print("=" * 60)

    # 1. Initialize Settings and APO Bridge
    settings = SettingsManager()
    apo_bridge = ApoBridge(settings)

    # Sync initial config to APO file
    success, msg = apo_bridge.apply_config()
    print(f"[APO Bridge] {msg}")

    # 2. Launch HTTP server on background thread
    server = EqualizerServer(settings, apo_bridge, port=args.port)
    server.start()

    if args.open:
        webbrowser.open(f"http://127.0.0.1:{args.port}")

    # 3. Run System Tray or wait
    if args.no_tray:
        print("[Main] Running in headless mode. Press Ctrl+C to stop.")
        try:
            while True:
                import time
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[Main] Stopping server...")
            server.stop()
    else:
        tray = TrayApp(settings, apo_bridge, server)
        tray.run()


if __name__ == "__main__":
    main()
