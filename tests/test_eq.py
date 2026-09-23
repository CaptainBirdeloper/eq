"""
Comprehensive unit and integration test suite for PulseEQ.
Tests settings persistence, APO configuration syntax generation,
HTTP REST API endpoints, and system tray icon generation.
"""

import unittest
import json
import urllib.request
import tempfile
import shutil
import sys
from pathlib import Path

# Ensure src is on sys.path
SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from core.config import SettingsManager, DEFAULT_FREQUENCIES, DEFAULT_PRESETS
from core.apo_bridge import ApoBridge
from server.http_server import EqualizerServer
from tray.tray_app import create_tray_icon_image


class TestPulseEQ(unittest.TestCase):
    def setUp(self):
        # Create isolated temporary directory for test data and config
        self.test_dir = Path(tempfile.mkdtemp(prefix="pulse_eq_test_"))
        self.settings = SettingsManager(data_dir=self.test_dir)
        self.apo_bridge = ApoBridge(self.settings)

    def tearDown(self):
        # Cleanup temporary files
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_settings_initialization(self):
        """Verify default frequencies, gains, and presets are correctly loaded."""
        self.assertEqual(self.settings.frequencies, DEFAULT_FREQUENCIES)
        self.assertEqual(len(self.settings.gains), 10)
        self.assertEqual(self.settings.preamp, 0.0)
        self.assertFalse(self.settings.bypass)

        all_presets = self.settings.get_all_presets()
        self.assertIn("Flat", all_presets)

    def test_apo_config_generation(self):
        """Verify Equalizer APO configuration syntax format."""
        self.settings.preamp = -2.5
        self.settings.gains[0] = 5.0
        self.settings.gains[5] = -3.0
        self.settings.bypass = False

        content = self.apo_bridge.generate_apo_config_content()
        self.assertIn("Preamp: -2.5 dB", content)
        self.assertIn("Filter 1: ON PK Fc 32 Hz Gain 5.0 dB Q 1.41", content)
        self.assertIn("Filter 6: ON PK Fc 1000 Hz Gain -3.0 dB Q 1.41", content)

        # Test bypass mode
        self.settings.bypass = True
        bypassed_content = self.apo_bridge.generate_apo_config_content()
        self.assertIn("Master Equalizer Bypass is ACTIVE", bypassed_content)
        self.assertIn("Preamp: 0.0 dB", bypassed_content)

    def test_apo_file_writing(self):
        """Verify atomic config file write succeeds."""
        success, msg = self.apo_bridge.apply_config()
        self.assertTrue(success)
        output_file = self.settings.get_output_config_path()
        self.assertTrue(output_file.exists())

        with open(output_file, "r", encoding="utf-8") as f:
            text = f.read()
        self.assertIn("Preamp:", text)

    def test_custom_preset_lifecycle(self):
        """Verify creating, persisting, and reloading custom presets."""
        self.settings.custom_presets["My Custom Preset"] = {
            "preamp": -1.0,
            "gains": [1.0, 2.0, 3.0, 4.0, 3.0, 2.0, 1.0, 0.0, -1.0, -2.0],
            "description": "Test profile"
        }
        self.settings.save()

        # Reload in a fresh instance
        reloaded = SettingsManager(data_dir=self.test_dir)
        self.assertIn("My Custom Preset", reloaded.custom_presets)
        self.assertEqual(reloaded.custom_presets["My Custom Preset"]["preamp"], -1.0)

    def test_tray_icon_generation(self):
        """Verify Pillow icon generator creates a valid 64x64 RGBA image."""
        img_active = create_tray_icon_image(bypassed=False)
        self.assertEqual(img_active.size, (64, 64))
        self.assertEqual(img_active.mode, "RGBA")

        img_bypassed = create_tray_icon_image(bypassed=True)
        self.assertEqual(img_bypassed.size, (64, 64))
        self.assertEqual(img_bypassed.mode, "RGBA")


class TestEqualizerServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_dir = Path(tempfile.mkdtemp(prefix="pulse_eq_server_test_"))
        cls.settings = SettingsManager(data_dir=cls.test_dir)
        cls.apo_bridge = ApoBridge(cls.settings)
        # Use a non-standard port for tests to avoid port conflicts
        cls.port = 18765
        cls.server = EqualizerServer(cls.settings, cls.apo_bridge, port=cls.port)
        cls.server.start()
        cls.base_url = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        shutil.rmtree(cls.test_dir, ignore_errors=True)

    def post_json(self, path: str, data: dict) -> dict:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def get_json(self, path: str) -> dict:
        url = f"{self.base_url}{path}"
        with urllib.request.urlopen(url) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def test_api_state(self):
        """Test GET /api/state returns valid state schema."""
        state = self.get_json("/api/state")
        self.assertIn("frequencies", state)
        self.assertIn("gains", state)
        self.assertIn("preamp", state)
        self.assertIn("bypass", state)
        self.assertIn("presets", state)

    def test_api_single_band_update(self):
        """Test POST /api/band updates specific band gain."""
        res = self.post_json("/api/band", {"index": 2, "gain": 4.5})
        self.assertEqual(res["gains"][2], 4.5)

    def test_api_all_bands_update(self):
        """Test POST /api/bands updates all 10 bands simultaneously."""
        new_gains = [1.0, 2.0, 3.0, 2.0, 1.0, 0.0, -1.0, -2.0, -1.0, 0.0]
        res = self.post_json("/api/bands", {"gains": new_gains})
        self.assertEqual(res["gains"], new_gains)

    def test_api_preamp_and_bypass(self):
        """Test POST /api/preamp and POST /api/bypass."""
        res = self.post_json("/api/preamp", {"preamp": -3.5})
        self.assertEqual(res["preamp"], -3.5)

        res = self.post_json("/api/bypass", {"bypass": True})
        self.assertTrue(res["bypass"])

        res = self.post_json("/api/bypass", {"bypass": False})
        self.assertFalse(res["bypass"])

    def test_api_global_q_update(self):
        """Test POST /api/q updates Q factor across all 10 bands simultaneously."""
        res = self.post_json("/api/q", {"q": 2.5})
        self.assertEqual(res["q_factors"], [2.5] * 10)

    def test_api_preset_activation(self):
        """Test POST /api/preset switches active preset."""
        res = self.post_json("/api/preset", {"name": "Flat"})
        self.assertEqual(res["active_preset"], "Flat")
        self.assertEqual(res["preamp"], 0.0)

    def test_api_save_and_delete_custom_preset(self):
        """Test POST /api/save-preset and POST /api/delete-preset."""
        res = self.post_json("/api/save-preset", {
            "name": "Unit Test EQ",
            "description": "Created in unit test"
        })
        self.assertIn("Unit Test EQ", res["presets"])

        # Delete preset
        res = self.post_json("/api/delete-preset", {"name": "Unit Test EQ"})
        self.assertNotIn("Unit Test EQ", res["presets"])

    def test_save_preset_never_overwrites(self):
        """Verify saving with an existing name creates a new unique preset entry without overwriting."""
        # Create base preset
        self.post_json("/api/save-preset", {"name": "Gaming", "description": "Base"})
        # Modify band gain
        self.post_json("/api/band", {"index": 0, "gain": 8.0})
        # Save again with same name "Gaming"
        res = self.post_json("/api/save-preset", {"name": "Gaming", "description": "Modified"})

        # Must have both "Gaming" and "Gaming (1)"
        self.assertIn("Gaming", res["presets"])
        self.assertIn("Gaming (1)", res["presets"])
        # Original "Gaming" must NOT be overwritten
        self.assertNotEqual(res["presets"]["Gaming"]["gains"][0], 8.0)
        self.assertEqual(res["presets"]["Gaming (1)"]["gains"][0], 8.0)

    def test_static_html_served(self):
        """Test GET / and GET /index.html returns index content."""
        with urllib.request.urlopen(f"{self.base_url}/") as resp:
            content = resp.read().decode("utf-8")
            self.assertIn("PulseEQ", content)
            self.assertIn("fairlightCanvas", content)
            self.assertIn('href="css/style.css"', content)
            self.assertIn('src="js/app.js"', content)

    def test_modular_static_assets_and_mimetypes(self):
        """Verify CSS and ES module JS assets are served with accurate MIME types."""
        assets = [
            ("/css/style.css", "text/css"),
            ("/js/app.js", "application/javascript"),
            ("/js/state.js", "application/javascript"),
            ("/js/audio_math.js", "application/javascript"),
            ("/js/canvas_view.js", "application/javascript"),
            ("/js/keyboard.js", "application/javascript"),
        ]
        for path, expected_type in assets:
            with urllib.request.urlopen(f"{self.base_url}{path}") as resp:
                self.assertEqual(resp.status, 200, f"Failed to fetch {path}")
                content_type = resp.headers.get("Content-Type", "")
                self.assertTrue(
                    expected_type in content_type,
                    f"Asset {path} returned '{content_type}', expected '{expected_type}'"
                )
                body = resp.read()
                self.assertGreater(len(body), 50, f"Asset {path} body is too small")


if __name__ == "__main__":
    unittest.main()

