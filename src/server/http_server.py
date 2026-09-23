"""
Lightweight background HTTP server for the Equalizer Web UI.
Uses standard library ThreadingHTTPServer for minimal resource usage, zero dependencies,
and rock-solid performance on Python 3.14.
"""

import json
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Optional

from core.config import DEFAULT_HOST, DEFAULT_PORT, GAIN_MAX, GAIN_MIN, PREAMP_MAX, PREAMP_MIN, SettingsManager
from core.apo_bridge import ApoBridge


class EqualizerApiHandler(SimpleHTTPRequestHandler):
    """Handles both REST API calls and static file delivery for the Equalizer UI."""

    settings: SettingsManager = None
    apo_bridge: ApoBridge = None
    web_dir: Path = None

    extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    })

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(self.web_dir), **kwargs)

    def log_message(self, format, *args):
        pass

    def send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0]

        if clean_path == "/api/state":
            self.send_json(self.settings.to_dict())
            return

        if clean_path == "/" or clean_path == "":
            self.path = "/index.html"

        super().do_GET()

    def parse_json_body(self) -> Optional[dict]:
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                return {}
            raw_body = self.rfile.read(content_length).decode("utf-8")
            return json.loads(raw_body)
        except Exception:
            return None

    def do_POST(self):
        clean_path = self.path.split("?")[0]
        data = self.parse_json_body()

        if data is None:
            self.send_json({"error": "Invalid JSON body"}, 400)
            return

        if clean_path == "/api/band":
            idx = data.get("index")
            if idx is None or not (0 <= idx < len(self.settings.gains)):
                self.send_json({"error": "Invalid band index"}, 400)
                return

            gain = data.get("gain")
            if gain is not None:
                gain = max(GAIN_MIN, min(GAIN_MAX, float(gain)))
                self.settings.gains[idx] = round(gain, 1)

            freq = data.get("freq")
            if freq is not None:
                freq = max(20.0, min(20000.0, float(freq)))
                self.settings.frequencies[idx] = round(freq, 1)

            q_val = data.get("q")
            if q_val is not None:
                q_val = max(0.2, min(10.0, float(q_val)))
                self.settings.q_factors[idx] = round(q_val, 2)

            self.settings.active_preset = "Custom"
            self.apo_bridge.apply_config()
            self.settings.save()
            self.send_json(self.settings.to_dict())
            return

        if clean_path == "/api/bands":
            gains = data.get("gains")
            if not isinstance(gains, list) or len(gains) != len(self.settings.gains):
                self.send_json({"error": "Invalid gains list"}, 400)
                return

            self.settings.gains = [
                round(max(GAIN_MIN, min(GAIN_MAX, float(g))), 1) for g in gains
            ]
            self.settings.active_preset = "Custom"
            self.apo_bridge.apply_config()
            self.settings.save()
            self.send_json(self.settings.to_dict())
            return

        if clean_path == "/api/preamp":
            preamp = data.get("preamp")
            if preamp is None:
                self.send_json({"error": "Missing preamp value"}, 400)
                return

            self.settings.preamp = round(max(PREAMP_MIN, min(PREAMP_MAX, float(preamp))), 1)
            self.apo_bridge.apply_config()
            self.settings.save()
            self.send_json(self.settings.to_dict())
            return

        if clean_path == "/api/q":
            q_val = data.get("q")
            if q_val is None:
                self.send_json({"error": "Missing q value"}, 400)
                return

            q_val = round(max(0.2, min(10.0, float(q_val))), 2)
            self.settings.q_factors = [q_val] * len(self.settings.frequencies)
            self.settings.active_preset = "Custom"
            self.apo_bridge.apply_config()
            self.settings.save()
            self.send_json(self.settings.to_dict())
            return

        if clean_path == "/api/bypass":
            bypass = data.get("bypass")
            if bypass is None:
                self.send_json({"error": "Missing bypass value"}, 400)
                return

            self.settings.bypass = bool(bypass)
            self.apo_bridge.apply_config()
            self.settings.save()
            self.send_json(self.settings.to_dict())
            return

        if clean_path == "/api/preset":
            name = data.get("name")
            presets = self.settings.get_all_presets()
            if not name or name not in presets:
                self.send_json({"error": f"Preset '{name}' not found"}, 404)
                return

            preset = presets[name]
            self.settings.gains = list(preset["gains"])
            self.settings.preamp = float(preset["preamp"])
            if "frequencies" in preset and isinstance(preset["frequencies"], list) and len(preset["frequencies"]) == len(self.settings.frequencies):
                self.settings.frequencies = list(preset["frequencies"])
            if "q_factors" in preset and isinstance(preset["q_factors"], list) and len(preset["q_factors"]) == len(self.settings.q_factors):
                self.settings.q_factors = list(preset["q_factors"])
            self.settings.active_preset = name
            self.apo_bridge.apply_config()
            self.settings.save()
            self.send_json(self.settings.to_dict())
            return

        if clean_path == "/api/save-preset":
            name = str(data.get("name", "")).strip()
            if not name:
                self.send_json({"error": "Preset name cannot be empty"}, 400)
                return

            # Always create a new preset entry - NEVER overwrite an existing preset
            all_presets = self.settings.get_all_presets()
            target_name = name
            if target_name in all_presets:
                counter = 1
                while f"{name} ({counter})" in all_presets:
                    counter += 1
                target_name = f"{name} ({counter})"

            preamp = data.get("preamp", self.settings.preamp)
            gains = data.get("gains", list(self.settings.gains))
            frequencies = data.get("frequencies", list(self.settings.frequencies))
            q_factors = data.get("q_factors", list(self.settings.q_factors))

            self.settings.custom_presets[target_name] = {
                "preamp": float(preamp),
                "gains": list(gains),
                "frequencies": list(frequencies),
                "q_factors": list(q_factors),
                "description": data.get("description", "")
            }
            self.settings.active_preset = target_name
            self.settings.save()
            self.send_json(self.settings.to_dict())
            return

        if clean_path == "/api/delete-preset":
            name = str(data.get("name", "")).strip()
            if name in self.settings.custom_presets:
                del self.settings.custom_presets[name]
                if self.settings.active_preset == name:
                    self.settings.active_preset = "Custom"
                self.settings.save()
                self.send_json(self.settings.to_dict())
                return
            self.send_json({"error": f"Custom preset '{name}' not found"}, 404)
            return

        if clean_path == "/api/settings":
            custom_dir = data.get("custom_apo_dir")
            if custom_dir:
                p = Path(custom_dir)
                if p.exists() and p.is_dir():
                    self.settings.apo_config_dir = p
                    self.settings.apo_installed = True
                    self.apo_bridge.apply_config()
                    self.settings.save()
                    self.send_json(self.settings.to_dict())
                    return
                else:
                    self.send_json({"error": "Directory does not exist"}, 400)
                    return
            self.send_json(self.settings.to_dict())
            return

        self.send_json({"error": f"Endpoint '{clean_path}' not found"}, 404)


class EqualizerServer:
    """Threaded web server manager for the Equalizer backend."""

    def __init__(
        self,
        settings: SettingsManager,
        apo_bridge: ApoBridge,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT
    ):
        self.host = host
        self.port = port
        self.settings = settings
        self.apo_bridge = apo_bridge
        self.web_dir = Path(__file__).resolve().parent.parent.parent / "web"
        self.httpd: Optional[HTTPServer] = None
        self.thread: Optional[threading.Thread] = None

    def start(self):
        EqualizerApiHandler.settings = self.settings
        EqualizerApiHandler.apo_bridge = self.apo_bridge
        EqualizerApiHandler.web_dir = self.web_dir

        self.httpd = HTTPServer((self.host, self.port), EqualizerApiHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        print(f"[Server] Equalizer Web UI running at http://{self.host}:{self.port}")

    def stop(self):
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
            print("[Server] Equalizer server stopped.")
