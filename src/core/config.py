"""
Configuration and settings management for PulseEQ.
Handles band definitions, default presets, settings persistence, and Equalizer APO path detection.
"""

import os
import json
import winreg
from pathlib import Path
from typing import Dict, List, Any, Optional

DEFAULT_PORT = 8765
DEFAULT_HOST = "127.0.0.1"

# Standard 10-band ISO frequencies (in Hz)
DEFAULT_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
DEFAULT_Q = 1.414

GAIN_MIN = -15.0
GAIN_MAX = 15.0
PREAMP_MIN = -20.0
PREAMP_MAX = 20.0

DEFAULT_PRESETS: Dict[str, Dict[str, Any]] = {
    "Flat": {
        "preamp": 0.0,
        "gains": [0.0] * 10,
        "description": "Flat reference."
    }
}


def detect_equalizer_apo_dir() -> Optional[Path]:
    """Attempts to locate the Equalizer APO installation config directory."""
    candidates = [
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "EqualizerAPO" / "config",
        Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "EqualizerAPO" / "config",
    ]

    for p in candidates:
        if p.exists() and p.is_dir():
            return p

    reg_paths = [
        r"SOFTWARE\EqualizerAPO",
        r"SOFTWARE\WOW6432Node\EqualizerAPO"
    ]
    for reg_path in reg_paths:
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, reg_path) as key:
                val, _ = winreg.QueryValueEx(key, "InstallDir")
                if val:
                    cfg = Path(val) / "config"
                    if cfg.exists():
                        return cfg
        except (OSError, FileNotFoundError):
            continue

    return None


class SettingsManager:
    """Manages application state, presets, and configuration persistence."""

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            # Root project data/ directory
            self.data_dir = Path(__file__).resolve().parent.parent.parent / "data"
        else:
            self.data_dir = data_dir

        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.settings_file = self.data_dir / "eq_settings.json"

        # Discovered APO path or fallback to data_dir
        detected_apo = detect_equalizer_apo_dir()
        self.apo_installed = detected_apo is not None
        self.apo_config_dir = detected_apo if detected_apo else self.data_dir

        # State attributes
        self.frequencies = list(DEFAULT_FREQUENCIES)
        self.gains = [0.0] * len(self.frequencies)
        self.q_factors = [DEFAULT_Q] * len(self.frequencies)
        self.preamp = 0.0
        self.bypass = False
        self.active_preset = "Flat"
        self.custom_presets: Dict[str, Dict[str, Any]] = {}

        self.load()

    def get_output_config_path(self) -> Path:
        """Returns the target config path where py_equalizer.txt should be written."""
        return self.apo_config_dir / "py_equalizer.txt"

    def get_main_apo_config_path(self) -> Path:
        """Returns the main Equalizer APO config.txt path."""
        return self.apo_config_dir / "config.txt"

    def load(self):
        """Loads state and custom presets from JSON."""
        if not self.settings_file.exists():
            return

        try:
            with open(self.settings_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.gains = data.get("gains", self.gains)
            self.frequencies = data.get("frequencies", self.frequencies)
            self.q_factors = data.get("q_factors", self.q_factors)
            self.preamp = float(data.get("preamp", self.preamp))
            self.bypass = bool(data.get("bypass", self.bypass))
            self.active_preset = data.get("active_preset", self.active_preset)
            self.custom_presets = data.get("custom_presets", {})
            custom_dir = data.get("custom_apo_dir")
            if custom_dir and Path(custom_dir).exists():
                self.apo_config_dir = Path(custom_dir)
                self.apo_installed = True
        except Exception as e:
            print(f"[Config] Error loading settings: {e}")

    def save(self):
        """Persists current state and custom presets to JSON."""
        data = {
            "gains": self.gains,
            "frequencies": self.frequencies,
            "q_factors": self.q_factors,
            "preamp": self.preamp,
            "bypass": self.bypass,
            "active_preset": self.active_preset,
            "custom_presets": self.custom_presets,
            "custom_apo_dir": str(self.apo_config_dir) if self.apo_installed else None
        }
        try:
            temp_file = self.settings_file.with_suffix(".tmp")
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            temp_file.replace(self.settings_file)
        except Exception as e:
            print(f"[Config] Error saving settings: {e}")

    def get_all_presets(self) -> Dict[str, Dict[str, Any]]:
        """Returns merged dictionary of built-in and user presets."""
        merged = {}
        for name, preset in DEFAULT_PRESETS.items():
            merged[name] = {**preset, "builtin": True}
        for name, preset in self.custom_presets.items():
            merged[name] = {**preset, "builtin": False}
        return merged

    def to_dict(self) -> Dict[str, Any]:
        """Serializes current state for the Web UI API."""
        return {
            "frequencies": self.frequencies,
            "gains": self.gains,
            "q_factors": self.q_factors,
            "preamp": self.preamp,
            "bypass": self.bypass,
            "active_preset": self.active_preset,
            "presets": self.get_all_presets(),
            "apo_installed": self.apo_installed,
            "apo_config_path": str(self.get_output_config_path()),
            "apo_main_config_path": str(self.get_main_apo_config_path()),
        }
