#!/usr/bin/env python3
"""Echo Bridge: bedien Samsung-tv's (LAN) en deze Windows-pc vanaf je iPhone.

- Draait op je Windows-pc, alleen bereikbaar vanaf je thuisnetwerk (privé IP-adressen).
- Elke opdracht vereist een geheime token.
- Er is geen "voer willekeurige opdracht uit": alleen de acties hieronder.
"""
import ctypes
import hmac
import ipaddress
import json
import secrets
import socket
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from echo_security import Security

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "config.json"
PAGE = HERE / "remote.html"
WIN = sys.platform == "win32"
SEC = None   # set in main()

# Toetsen die naar de tv gestuurd mogen worden (Samsung remote key names).
TV_KEYS = {
    "KEY_POWER", "KEY_VOLUP", "KEY_VOLDOWN", "KEY_MUTE", "KEY_CHUP", "KEY_CHDOWN",
    "KEY_HOME", "KEY_MENU", "KEY_SOURCE", "KEY_UP", "KEY_DOWN", "KEY_LEFT", "KEY_RIGHT",
    "KEY_ENTER", "KEY_RETURN", "KEY_EXIT", "KEY_PLAY", "KEY_PAUSE", "KEY_STOP",
    "KEY_FF", "KEY_REWIND", "KEY_INFO", "KEY_GUIDE",
}

# Tv-apps die gestart mogen worden. Samsung gebruikt per model/regio verschillende ID's,
# daarom proberen we ze in volgorde. Eigen lijst? Zet "tv_apps" in config.json, bijv.
#   "tv_apps": {"Netflix": ["3201907018807"], "YouTube": "111299001912"}
TV_APPS = {
    "Netflix": ["3201907018807", "11101200001"],
    "Disney+": ["3201901017640", "3202009021709", "3202204027038"],
}


def tv_apps(cfg):
    out = {}
    for name, ids in {**TV_APPS, **cfg.get("tv_apps", {})}.items():
        out[name] = [ids] if isinstance(ids, str) else list(ids)
    return out


# Windows media/volume virtual-key codes
VK = {"volume_up": 0xAF, "volume_down": 0xAE, "mute": 0xAD,
      "play_pause": 0xB3, "next": 0xB0, "prev": 0xB1}


# ---------------------------------------------------------------- config

def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))     # no packet is sent
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def first_run():
    cfg = {"port": 8765, "token": secrets.token_hex(12), "tvs": [],
           "apps": {"Kladblok": "notepad.exe", "Rekenmachine": "calc.exe"}}
    print("Eerste keer: ik stel je tv's in. Laat leeg om te stoppen.")
    print("(IP en MAC vind je op de tv bij Instellingen > Algemeen > Netwerk > Netwerkstatus.)")
    while sys.stdin.isatty():
        name = input("Naam van de tv (bijv. Woonkamer): ").strip()
        if not name:
            break
        ip = input("  IP-adres (bijv. 192.168.1.50): ").strip()
        mac = input("  MAC-adres (voor aanzetten, mag leeg): ").strip()
        cfg["tvs"].append({"name": name, "ip": ip, "mac": mac})
    CONFIG.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    return cfg


def load_config():
    if not CONFIG.exists():
        return first_run()
    return json.loads(CONFIG.read_text(encoding="utf-8"))


# ---------------------------------------------------------------- tv

def find_tv(cfg, name):
    for tv in cfg["tvs"]:
        if tv["name"] == name:
            return tv
    raise ValueError("Onbekende tv")


def _tv_remote(tv, delay):
    from samsungtvws import SamsungTVWS   # pip install samsungtvws
    safe = "".join(c for c in tv["name"] if c.isalnum()) or "tv"
    return SamsungTVWS(host=tv["ip"], port=8002, token_file=str(HERE / f"tv-{safe}.token"),
                       name="EchoBridge", timeout=8, key_press_delay=delay)


def _close(remote):
    try:
        remote.close()
    except Exception:
        pass


REPEATABLE = {"KEY_VOLUP", "KEY_VOLDOWN", "KEY_CHUP", "KEY_CHDOWN", "KEY_UP", "KEY_DOWN", "KEY_LEFT", "KEY_RIGHT"}


def tv_send(tv, key, count=1):
    count = max(1, min(int(count), 40)) if key in REPEATABLE else 1   # nooit KEY_POWER herhalen
    remote = _tv_remote(tv, 0.3 if count == 1 else 0.12)
    try:
        remote.send_key(key, times=count)
    finally:
        _close(remote)


def tv_volume_set(tv, level):
    """Samsung geeft geen volumestand door: eerst helemaal omlaag, dan 'level' stapjes omhoog."""
    level = max(0, min(int(level), 100))
    remote = _tv_remote(tv, 0.06)
    try:
        remote.send_key("KEY_VOLDOWN", times=100)
        if level:
            remote.send_key("KEY_VOLUP", times=level)
    finally:
        _close(remote)


def tv_run_app(tv, app_ids):
    from samsungtvws import SamsungTVWS   # pip install samsungtvws
    safe = "".join(c for c in tv["name"] if c.isalnum()) or "tv"
    remote = SamsungTVWS(host=tv["ip"], port=8002, token_file=str(HERE / f"tv-{safe}.token"),
                         name="EchoBridge", timeout=8, key_press_delay=0.3)
    last = None
    try:
        for app_id in app_ids:               # eerste ID dat zonder fout gaat, wint
            try:
                remote.run_app(app_id)
                return
            except Exception as e:
                last = e
        raise last or RuntimeError("Geen app-ID")
    finally:
        try:
            remote.close()
        except Exception:
            pass


def tv_wake(tv):
    mac = tv.get("mac", "").replace(":", "").replace("-", "").strip()
    if len(mac) != 12 or any(c not in "0123456789abcdefABCDEF" for c in mac):
        raise ValueError("Geen geldig MAC-adres voor deze tv in config.json")
    packet = bytes.fromhex("FF" * 6 + mac * 16)
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.sendto(packet, ("255.255.255.255", 9))


# ---------------------------------------------------------------- pc

def press(vk):
    u = ctypes.windll.user32
    u.keybd_event(vk, 0, 0, 0)
    u.keybd_event(vk, 0, 2, 0)


def pc_action(cfg, action):
    if not WIN:
        raise RuntimeError("PC-opdrachten werken alleen op Windows")
    base, _, num = action.partition(":")
    if base in ("volume_up", "volume_down") and num.isdigit():
        for _ in range(min(int(num), 50)):          # 1 stapje = 2% in Windows
            press(VK[base])
            time.sleep(0.01)
    elif base == "volume_set" and num.isdigit():
        for _ in range(50):
            press(VK["volume_down"]); time.sleep(0.005)
        for _ in range(round(min(int(num), 100) / 2)):
            press(VK["volume_up"]); time.sleep(0.005)
    elif action in VK:
        press(VK[action])
    elif action == "lock":
        ctypes.windll.user32.LockWorkStation()
    elif action == "sleep":
        subprocess.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
    elif action == "shutdown":
        subprocess.Popen(["shutdown", "/s", "/t", "30"])      # 30 s om te annuleren
    elif action == "restart":
        subprocess.Popen(["shutdown", "/r", "/t", "30"])
    elif action == "panic":                    # voice: "ECHO, stop alle processen"
        SEC.panic()
    elif action == "cancel_shutdown":
        subprocess.Popen(["shutdown", "/a"])
    elif action.startswith("open:") and action[5:] in cfg.get("apps", {}):
        SEC.track(subprocess.Popen([cfg["apps"][action[5:]]]))             # alleen apps uit config.json
    else:
        raise ValueError("Onbekende actie")


# ---------------------------------------------------------------- http

def make_handler(cfg):
    class Handler(BaseHTTPRequestHandler):
        server_version = "EchoBridge"

        def log_message(self, fmt, *args):
            print(time.strftime("%H:%M:%S"), self.client_address[0], fmt % args)

        def send_json(self, code, obj):
            body = json.dumps(obj, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def allowed(self):
            try:
                ip = ipaddress.ip_address(self.client_address[0])
            except ValueError:
                return False
            return (ip.is_private or ip.is_loopback) and not SEC.is_blocked(self.client_address[0])

        def authed(self):
            sent = self.headers.get("X-Echo-Token", "")
            ok = hmac.compare_digest(sent.encode(), cfg["token"].encode())
            if not ok:
                SEC.record_fail(self.client_address[0])
                time.sleep(1)              # slows down guessing
            return ok

        def do_GET(self):
            if not self.allowed():
                return self.send_json(403, {"error": "alleen thuisnetwerk"})
            if self.path.split("?")[0] == "/":
                body = PAGE.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Frame-Options", "DENY")
                self.end_headers()
                self.wfile.write(body)
            elif self.path.split("?")[0] in ("/echo-jarvis.js", "/echo-clap.js"):
                body = (HERE / self.path.split("?")[0].lstrip("/")).read_bytes()      # vaste lijst, geen vrij pad
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/api/state":
                if not self.authed():
                    return self.send_json(401, {"error": "token klopt niet"})
                self.send_json(200, {"security": SEC.status(), "tvs": [t["name"] for t in cfg["tvs"]],
                                     "apps": list(cfg.get("apps", {}).keys()),
                                     "tvApps": list(tv_apps(cfg).keys()),
                                     "windows": WIN})
            elif self.path.startswith("/api/alerts"):
                if not self.authed():
                    return self.send_json(401, {"error": "token klopt niet"})
                q = self.path.partition("since=")[2].split("&")[0]
                self.send_json(200, SEC.alerts_since(int(q) if q.lstrip("-").isdigit() else -1))
            elif self.path == "/api/security":
                if not self.authed():
                    return self.send_json(401, {"error": "token klopt niet"})
                self.send_json(200, SEC.status())
            else:
                self.send_json(404, {"error": "niet gevonden"})

        def do_POST(self):
            if not self.allowed():
                return self.send_json(403, {"error": "alleen thuisnetwerk"})
            if not self.authed():
                return self.send_json(401, {"error": "token klopt niet"})
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if n > 4096:
                    return self.send_json(413, {"error": "te groot"})
                data = json.loads(self.rfile.read(n) or b"{}")
                if self.path == "/api/panic":                    # "ECHO, stop alle processen"
                    return self.send_json(200, {"ok": True, **SEC.panic()})
                if self.path == "/api/panic/resume":
                    SEC.resume()
                    return self.send_json(200, {"ok": True, "halted": False})
                if self.path == "/api/security/away":
                    SEC.away = bool(data.get("away"))
                    SEC.log("Away mode " + ("ON" if SEC.away else "OFF"))
                    return self.send_json(200, {"ok": True, "away": SEC.away})
                if SEC.halted:
                    return self.send_json(423, {"error": "ECHO is gestopt (panic). Hervat met /api/panic/resume."})
                if self.path == "/api/tv":
                    key = data.get("key", "")
                    if key not in TV_KEYS:
                        raise ValueError("Toets niet toegestaan")
                    tv_send(find_tv(cfg, data.get("tv", "")), key, data.get("count", 1))
                elif self.path == "/api/tv/volume":
                    tv_volume_set(find_tv(cfg, data.get("tv", "")), data.get("level", 0))
                elif self.path == "/api/tv/app":
                    ids = tv_apps(cfg).get(str(data.get("app", "")))
                    if not ids:
                        raise ValueError("Onbekende tv-app")
                    tv_run_app(find_tv(cfg, data.get("tv", "")), ids)
                elif self.path == "/api/tv/wake":
                    tv_wake(find_tv(cfg, data.get("tv", "")))
                elif self.path == "/api/pc":
                    pc_action(cfg, str(data.get("action", "")))
                else:
                    return self.send_json(404, {"error": "niet gevonden"})
                self.send_json(200, {"ok": True})
            except ImportError:
                self.send_json(500, {"error": "samsungtvws ontbreekt (pip install samsungtvws)"})
            except (ValueError, RuntimeError) as e:
                self.send_json(400, {"error": str(e)})
            except Exception as e:                                 # tv offline, geweigerd, ...
                self.send_json(502, {"error": f"{type(e).__name__}: {e}"})

    return Handler


def main():
    global SEC
    cfg = load_config()
    SEC = Security(cfg)
    SEC.start_monitor()
    server = ThreadingHTTPServer(("0.0.0.0", int(cfg["port"])), make_handler(cfg))
    url = f"http://{lan_ip()}:{cfg['port']}/#t={cfg['token']}"
    print("\nEcho Bridge draait. Laat dit venster open.")
    print("Open dit adres op je iPhone (zelfde wifi) en zet het op je beginscherm:\n")
    print("   " + url + "\n")
    print("Niet delen: de token na #t= geeft toegang tot je pc en tv.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
