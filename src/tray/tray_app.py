"""
System tray application controller using pystray and Pillow.
Lives silently in the Windows notification area with minimal resource usage.
Left-clicking or double-clicking the tray icon opens the Equalizer Web UI in the default browser.
"""

import sys
import os
import webbrowser
import winreg
from pathlib import Path
from typing import Optional

import pystray
from PIL import Image, ImageDraw

try:
    from core.config import DEFAULT_HOST, DEFAULT_PORT, SettingsManager
    from core.apo_bridge import ApoBridge
    from server.http_server import EqualizerServer
except ImportError:
    from ..core.config import DEFAULT_HOST, DEFAULT_PORT, SettingsManager
    from ..core.apo_bridge import ApoBridge
    from ..server.http_server import EqualizerServer

REG_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_REG_NAME = "PulseEqualizer"


def is_run_at_startup_enabled() -> bool:
    """Checks if the application is registered in Windows Startup."""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_READ) as key:
            winreg.QueryValueEx(key, APP_REG_NAME)
            return True
    except (OSError, FileNotFoundError):
        return False


def set_run_at_startup(enable: bool):
    """Adds or removes the application from Windows Startup."""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            if enable:
                # Use pythonw if available for silent background startup
                python_exe = sys.executable
                if "python.exe" in python_exe.lower():
                    pythonw_exe = python_exe.lower().replace("python.exe", "pythonw.exe")
                    if os.path.exists(pythonw_exe):
                        python_exe = pythonw_exe

                script_path = str(Path(__file__).resolve().parent.parent.parent / "main.py")
                cmd = f'"{python_exe}" "{script_path}"'
                winreg.SetValueEx(key, APP_REG_NAME, 0, winreg.REG_SZ, cmd)
                print(f"[Tray] Enabled run at startup: {cmd}")
            else:
                try:
                    winreg.DeleteValue(key, APP_REG_NAME)
                    print("[Tray] Disabled run at startup.")
                except FileNotFoundError:
                    pass
    except Exception as e:
        print(f"[Tray] Error modifying startup registry: {e}")


def create_tray_icon_image(bypassed: bool = False) -> Image.Image:
    """
    Generates a crisp 64x64 RGBA Equalizer icon using Pillow.
    Color is high-contrast white when active, or subdued gray when bypassed.
    """
    size = (64, 64)
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Monochrome scheme
    if bypassed:
        bar_color = (120, 120, 120, 255)
        glow_color = (120, 120, 120, 50)
        accent_color = (160, 160, 160, 255)
    else:
        bar_color = (255, 255, 255, 255)
        glow_color = (255, 255, 255, 60)
        accent_color = (255, 255, 255, 255)

    # 4 Equalizer bars heights and positions
    bars = [
        (8, 36, 18, 54),   # x1, y1, x2, y2
        (22, 16, 32, 54),
        (36, 26, 46, 54),
        (50, 10, 60, 54)
    ]

    # Draw rounded bars
    radius = 4
    for x1, y1, x2, y2 in bars:
        # Subtle glow
        draw.rounded_rectangle([x1 - 2, y1 - 2, x2 + 2, y2 + 2], radius=radius + 1, fill=glow_color)
        # Bar body
        draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=bar_color)
        # Top cap accent
        draw.rounded_rectangle([x1, y1, x2, y1 + 6], radius=radius, fill=accent_color)

    return image


class TrayApp:
    """Manages the background system tray icon, menu actions, and browser launch."""

    def __init__(self, settings: SettingsManager, apo_bridge: ApoBridge, server: EqualizerServer):
        self.settings = settings
        self.apo_bridge = apo_bridge
        self.server = server
        self.url = f"http://{server.host}:{server.port}"
        self.icon: Optional[pystray.Icon] = None

    def open_web_ui(self, icon=None, item=None):
        """Opens the web equalizer interface in the user's default web browser."""
        print(f"[Tray] Opening Web UI in browser: {self.url}")
        webbrowser.open(self.url)

    def toggle_bypass(self, icon=None, item=None):
        """Toggles EQ bypass and updates the tray icon."""
        self.settings.bypass = not self.settings.bypass
        self.apo_bridge.apply_config()
        self.settings.save()
        self.update_icon_image()

    def update_icon_image(self):
        """Refreshes the tray icon appearance."""
        if self.icon:
            self.icon.icon = create_tray_icon_image(bypassed=self.settings.bypass)

    def apply_preset(self, preset_name: str):
        """Applies a preset from the tray context menu."""
        presets = self.settings.get_all_presets()
        if preset_name in presets:
            preset = presets[preset_name]
            self.settings.gains = list(preset["gains"])
            self.settings.preamp = float(preset["preamp"])
            self.settings.active_preset = preset_name
            self.apo_bridge.apply_config()
            self.settings.save()
            print(f"[Tray] Switched to preset '{preset_name}'")

    def toggle_startup(self, icon=None, item=None):
        """Toggles Windows startup registration."""
        enabled = is_run_at_startup_enabled()
        set_run_at_startup(not enabled)

    def exit_app(self, icon=None, item=None):
        """Cleanly stops the background server and removes the tray icon."""
        print("[Tray] Exiting application...")
        if self.icon:
            self.icon.stop()
        self.server.stop()

    def build_menu(self) -> pystray.Menu:
        """Constructs the system tray right-click menu."""

        # Submenu for presets
        preset_items = [
            pystray.MenuItem(
                name,
                lambda _, n=name: self.apply_preset(n),
                checked=lambda item, n=name: self.settings.active_preset == n
            )
            for name in self.settings.get_all_presets().keys()
        ]

        apo_status_text = (
            "Status: APO Active (0ms)" if self.settings.apo_installed else "Status: APO Standby"
        )

        menu = pystray.Menu(
            pystray.MenuItem("Open Equalizer Web UI", self.open_web_ui, default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Bypass EQ", self.toggle_bypass, checked=lambda item: self.settings.bypass),
            pystray.MenuItem("Quick Presets", pystray.Menu(*preset_items)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(apo_status_text, lambda: None, enabled=False),
            pystray.MenuItem(
                "Run on Windows Startup",
                self.toggle_startup,
                checked=lambda item: is_run_at_startup_enabled()
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Exit PulseEQ", self.exit_app)
        )
        return menu

    def run(self):
        """Starts the system tray icon main loop."""
        initial_img = create_tray_icon_image(bypassed=self.settings.bypass)
        self.icon = pystray.Icon(
            name="PulseEQ",
            icon=initial_img,
            title="PulseEQ - Zero Latency Studio Equalizer (Click to open)",
            menu=self.build_menu()
        )
        print("[Tray] PulseEQ tray icon started.")
        self.icon.run()
