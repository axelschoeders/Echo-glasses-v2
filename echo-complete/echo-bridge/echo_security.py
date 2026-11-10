"""ECHO security module (defensive only). Additive: imported by echo_bridge.py.

What it does
- Records failed logins per IP and temporarily blocks brute-forcers (auto prevention).
- Watches for NEW listening network ports on this PC and for Windows Defender / Firewall being switched off.
- Keeps a log (security.log) and a small status report.
- PANIC ("ECHO, stop alle processen"): stops everything ECHO itself started, cancels a pending
  shutdown, refuses all further commands until you resume with the token. It does NOT kill
  arbitrary Windows/system processes; that would be destructive and could crash your PC.
- Critical incidents are spoken out loud on the PC and pushed to your iPhone (remote page) and the glasses app,
  which speak them themselves. No third-party service; works while your phone is on the same Wi-Fi.
"""
import json
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOG = HERE / "security.log"
WIN = sys.platform == "win32"


class Security:
    MAX_FAILS, WINDOW, BLOCK_FOR = 5, 300, 900      # 5 fails / 5 min -> blocked 15 min

    def __init__(self, cfg):
        self.cfg = cfg
        self.fails = {}          # ip -> [timestamps]
        self.blocked = {}        # ip -> until
        self.children = []       # processes ECHO started
        self.halted = False
        self.away = False
        self.incidents = []
        self.known_ports = None
        self.alerts = []
        self.alert_id = 0
        self.lock = threading.Lock()

    # ---------- logging / incidents
    def log(self, msg):
        line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
        print("[security]", msg)
        try:
            with open(LOG, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass

    def incident(self, severity, msg):
        """severity: 'info' | 'warn' | 'critical'"""
        self.log(f"{severity.upper()}: {msg}")
        self.incidents = (self.incidents + [{"t": int(time.time()), "sev": severity, "msg": msg}])[-50:]
        if severity == "critical":
            self.notify_owner(msg)

    # ---------- login brute-force protection
    def is_blocked(self, ip):
        until = self.blocked.get(ip, 0)
        if until and until > time.time():
            return True
        self.blocked.pop(ip, None)
        return False

    def record_fail(self, ip):
        now = time.time()
        with self.lock:
            lst = [t for t in self.fails.get(ip, []) if now - t < self.WINDOW] + [now]
            self.fails[ip] = lst
            if len(lst) >= self.MAX_FAILS and ip not in self.blocked:
                self.blocked[ip] = now + self.BLOCK_FOR
                self.incident("critical", f"{ip} had {len(lst)} wrong tokens; blocked for {self.BLOCK_FOR // 60} min")

    # ---------- process tracking + panic
    def track(self, proc):
        self.children = [p for p in self.children if p.poll() is None] + [proc]
        return proc

    def panic(self):
        self.halted = True
        killed = 0
        for p in self.children:
            try:
                if p.poll() is None:
                    p.terminate()
                    killed += 1
            except Exception:
                pass
        self.children = []
        if WIN:
            try:
                subprocess.Popen(["shutdown", "/a"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass
        self.log(f"PANIC: stopped {killed} ECHO-started process(es), cancelled pending shutdown, commands halted")
        return {"stopped": killed, "halted": True}

    def resume(self):
        self.halted = False
        self.log("Resumed after panic")

    # ---------- monitors (read-only)
    def _listening_ports(self):
        if not WIN:
            return set()
        out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True, timeout=15).stdout
        return {m.group(1) for m in re.finditer(r"0\.0\.0\.0:(\d+)\s+0\.0\.0\.0:0\s+LISTENING", out)}

    def _defender_ok(self):
        if not WIN:
            return True
        ps = "(Get-MpComputerStatus).RealTimeProtectionEnabled"
        out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=20).stdout.strip()
        return out.lower() != "false"

    def _firewall_ok(self):
        if not WIN:
            return True
        out = subprocess.run(["netsh", "advfirewall", "show", "allprofiles", "state"], capture_output=True, text=True, timeout=15).stdout
        return " OFF" not in out.upper()

    def scan_once(self):
        try:
            ports = self._listening_ports()
            if self.known_ports is None:
                self.known_ports = ports
            else:
                new = ports - self.known_ports
                if new:
                    self.incident("warn", "New listening port(s) on this PC: " + ", ".join(sorted(new)))
                    self.known_ports |= new
            if not self._defender_ok():
                self.incident("critical", "Windows Defender real-time protection is OFF")
            if not self._firewall_ok():
                self.incident("critical", "Windows Firewall is OFF on at least one profile")
        except Exception as e:
            self.log(f"scan error: {type(e).__name__}: {e}")

    def start_monitor(self, every=60):
        def loop():
            while True:
                if not self.halted:
                    self.scan_once()
                time.sleep(every)
        threading.Thread(target=loop, daemon=True).start()

    # ---------- built-in alerts (no third-party service)
    # Critical incidents are (1) spoken out loud on this PC and (2) queued at /api/alerts.
    # The remote page on your iPhone and the glasses app poll that queue (same Wi-Fi) and speak
    # the alert themselves; in the glasses app it comes out of the glasses.
    def _speak_pc(self, text):
        if not WIN:
            return
        safe = re.sub(r"[^\w .,:%/-]", " ", text)[:300]
        ps = ("[console]::beep(1200,300);[console]::beep(900,300);Add-Type -AssemblyName System.Speech;"
              "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;$s.Volume=100;"
              f"$s.Speak('ECHO security alert. {safe}')")
        try:
            subprocess.Popen(["powershell", "-NoProfile", "-Command", ps],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            self.log(f"PC speech failed: {e}")

    def notify_owner(self, msg):
        self.alert_id += 1
        self.alerts = (self.alerts + [{"id": self.alert_id, "t": int(time.time()), "text": msg[:300]}])[-30:]
        self._speak_pc(msg)

    def alerts_since(self, since):
        if since < 0:                       # first poll: just report the current position
            return {"alerts": [], "last": self.alert_id}
        return {"alerts": [a["text"] for a in self.alerts if a["id"] > since], "last": self.alert_id}

    def status(self):
        return {"halted": self.halted, "away": self.away, "blocked": list(self.blocked),
                "incidents": self.incidents[-10:]}
