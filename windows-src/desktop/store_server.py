"""Mac Store entry point. Use Python's built-in MIME map inside App Sandbox."""
import mimetypes
from pathlib import Path
import runpy

# Python 3.9 otherwise probes /etc/apache2/mime.types, which a sandboxed app
# cannot read. The bundled editor needs only the standard built-in MIME types;
# server.Handler also fixes JavaScript and WebAssembly types explicitly.
mimetypes.knownfiles = []
mimetypes.init()
runpy.run_path(str(Path(__file__).with_name('server.py')), run_name='__main__')
