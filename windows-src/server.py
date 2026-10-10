#!/usr/bin/env python3
"""Production Desk: a loopback-only, dependency-free film scheduling server."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import struct
import sys
import io
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from film import empty_project, import_script, validate_uss, element

ROOT = Path(__file__).resolve().parent
LOCK = threading.Lock()
EXPORTS = {}
MAX_BODY = 40 * 1024 * 1024

@lru_cache(maxsize=5)
def local_font(family='heading', style='regular'):
    """Find installed fonts without bundling or downloading another app's assets."""
    names = {'Reross-Quadratic', 'RerossStd-Quadratic'}
    roots = [Path.home() / 'Library/Fonts', Path('/Library/Fonts')]
    if sys.platform == 'win32':
        roots = [Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts',
                 Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'Microsoft/Windows/Fonts']
        if family == 'script':
            for variable in ('ProgramFiles', 'ProgramFiles(x86)'):
                base = Path(os.environ.get(variable, 'C:/Program Files'))
                for application in base.glob('Final Draft*'):
                    roots.extend([application, application / 'Fonts', application / 'Resources/Fonts'])
    adobe = Path.home() / 'Library/Application Support/Adobe/CoreSync/plugins/livetype'
    roots.extend(adobe / part for part in ('.r', '.w'))
    if family == 'script':
        names = {'regular': {'CourierFinalDraft'}, 'bold': {'CourierFinalDraft-Bold'},
                 'italic': {'CourierFinalDraft-Italic'}, 'bold-italic': {'CourierFinalDraft-BoldItalic'}}.get(style, set())
        for applications in (Path('/Applications'), Path.home() / 'Applications'):
            roots.extend(app / 'Contents/Resources' for app in applications.glob('Final Draft*.app'))
    for root in roots:
        for path in root.glob('*'):
            if path.suffix.lower() not in ('.otf', '.ttf'):
                continue
            try:
                raw = path.read_bytes()
                tables = struct.unpack_from('>H', raw, 4)[0]
                for n in range(tables):
                    tag, _, offset, length = struct.unpack_from('>4sIII', raw, 12 + n * 16)
                    if tag != b'name':
                        continue
                    _, count, strings = struct.unpack_from('>HHH', raw, offset)
                    for i in range(count):
                        platform, _, _, name_id, size, start = struct.unpack_from('>HHHHHH', raw, offset + 6 + 12 * i)
                        if name_id != 6:
                            continue
                        value = raw[offset + strings + start:offset + strings + start + size]
                        name = value.decode('utf-16-be' if platform in (0, 3) else 'mac_roman')
                        if name in names:
                            return path
            except (OSError, ValueError, struct.error):
                continue
    return None

def heading_font():
    return local_font()

DEMO = """Title: The Last Light

1 EXT. COASTAL ROAD - DAWN

A battered station wagon follows the coast. The lighthouse is a pin of light in the mist.

MAYA
We should have left yesterday.

ELI
And missed all this?

2 INT. STATION WAGON - DAY

Maya unfolds an old map. A red circle marks the lighthouse.

MAYA
That's where he said he'd be.

ELI
Then that's where we go.

3 EXT. LIGHTHOUSE - DAY

The car rolls to a stop. JONAH waits at the foot of the lighthouse, holding a brass key.

JONAH
I wasn't sure you'd come.

MAYA
Neither was I.

4 INT. LIGHTHOUSE STAIRWELL - DAY

Jonah leads Maya up a winding staircase. She runs a hand along the worn stone.

JONAH
One hundred and twelve steps. Your father counted every morning.

MAYA
Of course he did.

5 INT. LANTERN ROOM - DAY

Eli opens a wooden box. Inside: a letter, a photograph, and a compass.

ELI
This has your name on it.

MAYA
Let me see.

6 EXT. LIGHTHOUSE - DUSK

Maya and Jonah sit on the seawall. The tide comes in below them.

MAYA
How long do you think he waited?

JONAH
As long as he needed to.

7 INT. LANTERN ROOM - NIGHT

Maya turns the brass key. The old mechanism wakes with a low, steady hum.

MAYA
There you are.

8 EXT. COASTAL ROAD - NIGHT

Eli closes the car door. They look back. The lighthouse sweeps across the water.

ELI
Ready?

MAYA
Now I am.
"""

def demo_workspace():
    p = import_script(DEMO, "The Last Light.fountain")
    p["_demo"] = True
    p["_importNotes"] = None
    descriptions = ["Maya and Eli drive toward the lighthouse.", "An old map points to their destination.",
                    "Jonah greets Maya with her father's key.", "Maya retraces her father's morning ritual.",
                    "Eli discovers a letter addressed to Maya.", "Maya and Jonah talk as the tide comes in.",
                    "Maya brings the lighthouse back to life.", "Maya and Eli leave the coast behind."]
    for i, b in enumerate(p["breakdowns"]):
        b["description"] = descriptions[i]
        b["pages"] = [.375, .75, 1.125, .5, 1.25, .875, .625, .375][i]
        b["duration"] = [60, 75, 90, 45, 90, 60, 75, 45][i] * 60000
        b["_needsReview"] = False
        b["elements"].append(element(p, 6, "North coast" if i in (0, 1, 7) else "Point Harbor lighthouse"))
    for i, name in [(1, "Folded road map"), (2, "Brass key"), (4, "Letter"), (4, "Compass"), (6, "Brass key")]:
        p["breakdowns"][i]["elements"].append(element(p, 104, name))
    for i in (0, 1, 7):
        p["breakdowns"][i]["elements"].append(element(p, 103, "Station wagon"))
    ids = [b["id"] for b in p["breakdowns"]]
    p["stripboards"][0]["boards"][0]["breakdownIds"] = [[ids[2], ids[3], ids[4]], [ids[5], ids[6]]]
    p["stripboards"][0]["boards"][1]["breakdownIds"] = [ids[0], ids[1], ids[7]]
    return {"version": 1, "activeProject": p["id"], "projects": [p]}

def atomic_save(path, value):
    raw = json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Keep the previous successfully saved version for recovery.
    if path.exists():
        shutil.copy2(path, path.with_suffix(".previous.json"))
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".slate-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(raw)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def extract_pdf(raw):
    if sys.platform != 'darwin':
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            if reader.is_encrypted and not reader.decrypt(''):
                raise ValueError('This PDF is password-protected. Export an unencrypted PDF first.')
            text = '\n\f\n'.join(page.extract_text() or '' for page in reader.pages)
        except ImportError as error:
            raise ValueError('The PDF reader is missing. Reinstall Production Desk.') from error
        except Exception as error:
            raise ValueError('Could not read this PDF: ' + str(error)) from error
        if not text.strip():
            raise ValueError('This PDF has no extractable text. Export a searchable PDF or use Final Draft (.fdx).')
        return text
    executable = ROOT / "tools" / "extract_pdf"
    if not executable.exists():
        compiler = shutil.which("swiftc")
        if not compiler:
            raise ValueError("PDF import on this computer requires macOS PDFKit and Swift. Final Draft and text import are available.")
        env = dict(os.environ, CLANG_MODULE_CACHE_PATH=str(ROOT / ".cache" / "clang"))
        result = subprocess.run([compiler, "-module-cache-path", str(ROOT / ".cache" / "swift"),
                                 str(ROOT / "tools" / "extract_pdf.swift"), "-o", str(executable)],
                                capture_output=True, env=env, timeout=120)
        if result.returncode:
            raise ValueError("The local PDF reader could not be built. Use an FDX file or a text export. See the terminal for setup details.")
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(raw)
        f.flush()
        result = subprocess.run([str(executable), f.name], capture_output=True, timeout=60)
    if result.returncode:
        raise ValueError(result.stderr.decode("utf-8", "replace").strip())
    return result.stdout.decode("utf-8")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "web"), **kwargs)

    def log_request(self, code='-', size='-'):
        # Keep query parameters out of the desktop log.
        self.log_message('"%s %s" %s %s', self.command, urlsplit(self.path).path, code, size)

    def preferences(self):
        path = self.server.datafile.parent / 'app-settings.json'
        try:
            value = json.loads(path.read_text())
        except (OSError, ValueError):
            value = {}
        theme = value.get('theme') if isinstance(value, dict) else None
        return {'theme': theme if theme in ('light', 'dark') else 'light'}

    def end_headers(self):
        self.send_header("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def local_request(self, mutation=False):
        allowed = {"127.0.0.1:" + str(self.server.server_port), "localhost:" + str(self.server.server_port)}
        if self.headers.get("Host") not in allowed:
            self.reply({"error": "Only localhost requests are allowed."}, 403)
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in {"http://" + host for host in allowed}:
            self.reply({"error": "Cross-origin requests are blocked."}, 403)
            return False
        if mutation and self.headers.get("X-Slate-Local") != "1":
            self.reply({"error": "Local app request header is required."}, 403)
            return False
        return True

    def reply(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if not self.local_request():
            return
        path = urlsplit(self.path).path
        font_routes = {'/fonts/heading.otf': ('heading', 'regular'),
                       '/fonts/script-regular.ttf': ('script', 'regular'),
                       '/fonts/script-bold.ttf': ('script', 'bold'),
                       '/fonts/script-italic.ttf': ('script', 'italic'),
                       '/fonts/script-bold-italic.ttf': ('script', 'bold-italic')}
        if path in font_routes:
            font = local_font(*font_routes[path])
            if not font:
                self.reply({"error": "The requested local font is unavailable."}, 404)
                return
            try:
                raw = font.read_bytes()
            except OSError:
                self.reply({"error": "Local font could not be read."}, 404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "font/ttf" if path.endswith('.ttf') else "font/otf")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        elif path.startswith("/api/download/"):
            token = path.rsplit("/", 1)[-1]
            with LOCK:
                item = EXPORTS.get(token)
            if not item or time.monotonic() - item[3] > 300:
                self.reply({"error": "Export expired. Export the file again."}, 404)
                return
            filename, mime, raw, _ = item
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Disposition", 'attachment; filename="' + filename + '"')
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        elif path == '/api/settings':
            with LOCK:
                self.reply({'preferences': self.preferences()})
        elif path == "/api/workspace":
            try:
                with LOCK:
                    if not self.server.datafile.exists():
                        atomic_save(self.server.datafile, demo_workspace())
                    value = json.loads(self.server.datafile.read_text(encoding="utf-8"))
                self.reply(value)
            except (OSError, ValueError) as e:
                self.reply({"error": "Could not read local workspace: " + str(e)}, 500)
        elif path.startswith("/api/"):
            self.reply({"error": "Not found"}, 404)
        else:
            super().do_GET()

    def do_POST(self):
        if not self.local_request(mutation=True):
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                self.reply({"error": "Choose a file smaller than 40 MB."}, 413)
                return
            raw = self.rfile.read(length)
            path = urlsplit(self.path).path
            if path == '/api/settings':
                value = json.loads(raw)
                if not isinstance(value, dict) or value.get('theme') not in ('light', 'dark'):
                    raise ValueError('Choose Light or Dark appearance.')
                with LOCK:
                    preferences = {'theme': value['theme']}
                    atomic_save(self.server.datafile.parent / 'app-settings.json', preferences)
                self.reply({'preferences': preferences})
            elif path == "/api/export":
                value = json.loads(raw)
                filename = value.get("filename", "")
                content = value.get("content")
                mime = value.get("mime")
                import re
                if not isinstance(filename, str) or not re.fullmatch(r"[\w .-]{1,200}", filename, re.ASCII):
                    raise ValueError("Invalid export filename.")
                if not isinstance(content, str) or mime not in ("application/json", "text/csv;charset=utf-8"):
                    raise ValueError("Invalid export contents.")
                token = uuid.uuid4().hex
                with LOCK:
                    expired = [key for key, item in EXPORTS.items() if time.monotonic()-item[3] > 300]
                    for key in expired:
                        del EXPORTS[key]
                    EXPORTS[token] = (filename, mime, content.encode("utf-8"), time.monotonic())
                self.reply({"url": "/api/download/" + token})
            elif path == "/api/workspace":
                value = json.loads(raw)
                if not isinstance(value, dict) or not isinstance(value.get("projects"), list):
                    raise ValueError("Invalid workspace.")
                ids = []
                for p in value["projects"]:
                    validate_uss(p)
                    ids.append(p["id"])
                if len(set(ids)) != len(ids) or value.get("activeProject") not in ids:
                    raise ValueError("Invalid active project or duplicate project IDs.")
                with LOCK:
                    atomic_save(self.server.datafile, value)
                self.reply({"saved": True})
            elif path == "/api/new":
                self.reply(empty_project(json.loads(raw).get("title") or "Untitled production"))
            elif path == "/api/import":
                filename = self.headers.get("X-Filename", "script.txt")
                from urllib.parse import unquote
                filename = Path(unquote(filename)).name
                if filename.lower().endswith((".uss", ".json")):
                    value = json.loads(raw)
                    if "universalScheduleStandard" in value:
                        p = validate_uss(value["universalScheduleStandard"])
                        # Add scheduling containers for breakdown-only USS files.
                        if not p["stripboards"]:
                            defaults = empty_project()
                            p["stripboards"] = defaults["stripboards"]
                            p["calendars"] += defaults["calendars"]
                            p["stripboards"][0]["boards"][1]["breakdownIds"] = [b["id"] for b in p["breakdowns"]]
                        self.reply({"project": p})
                    elif value.get("version") == 1 and isinstance(value.get("projects"), list):
                        for p in value["projects"]:
                            validate_uss(p)
                        self.reply({"workspace": value})
                    else:
                        raise ValueError("Select a USS file or a Production Desk workspace backup.")
                else:
                    text = extract_pdf(raw) if filename.lower().endswith(".pdf") else raw.decode("utf-8-sig")
                    self.reply({"project": import_script(text, filename)})
            else:
                self.reply({"error": "Not found"}, 404)
        except (ValueError, KeyError, TypeError, UnicodeError, subprocess.TimeoutExpired) as e:
            self.reply({"error": str(e) or "Could not read that file."}, 400)
        except OSError as e:
            self.reply({"error": "Local file operation failed: " + str(e)}, 500)

def main():
    parser = argparse.ArgumentParser(description="Production Desk — offline film scheduling")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "workspace.json")
    parser.add_argument("--ready-file", type=Path, help="Write the local URL for the desktop launcher")
    parser.add_argument("--parent-pid", type=int, help="Stop when the desktop launcher exits")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.datafile = args.data.resolve()
    if args.ready_file:
        args.ready_file.parent.mkdir(parents=True, exist_ok=True)
        args.ready_file.write_text(json.dumps({"url": "http://127.0.0.1:%s" % server.server_port}), encoding="utf-8")
    if args.parent_pid:
        def watch_parent():
            if sys.platform == 'win32':
                # Windows keeps the original parent PID after it exits; wait on its handle.
                import ctypes
                kernel = ctypes.WinDLL('kernel32', use_last_error=True)
                kernel.OpenProcess.restype = ctypes.c_void_p
                kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
                kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
                kernel.CloseHandle.argtypes = [ctypes.c_void_p]
                handle = kernel.OpenProcess(0x00100000, False, args.parent_pid)
                if handle:
                    kernel.WaitForSingleObject(handle, 0xFFFFFFFF)
                    kernel.CloseHandle(handle)
            else:
                while os.getppid() == args.parent_pid:
                    time.sleep(1)
            server.shutdown()
        threading.Thread(target=watch_parent, daemon=True).start()
    print("\nProduction Desk is running at http://127.0.0.1:%s" % server.server_port, flush=True)
    print("Data: " + str(server.datafile) + "\nPress Control-C to stop.\n", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

if __name__ == "__main__":
    main()
