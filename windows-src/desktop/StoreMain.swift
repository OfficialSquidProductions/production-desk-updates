import AppKit

// Noninteractive runtime verification never opens the app UI or the disabled
// Update QA helper. Its only input is a synthetic PDF supplied on stdin.
@main
struct StoreMain {
    static func main() {
        // Read-only preflight: isolated QA must establish Foundation's storage
        // routing before starting the UI or creating a workspace.
        if CommandLine.arguments.contains("--store-storage-check") {
            let fm = FileManager.default
            let support = try! fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
                .appendingPathComponent(ProductionDeskDataLocation.folder(info: Bundle.main.infoDictionary ?? [:]))
            let value = ["home": fm.homeDirectoryForCurrentUser.path, "support": support.path,
                         "workspace": support.appendingPathComponent("workspace.json").path,
                         "temporary": NSTemporaryDirectory()]
            print(String(data: try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), encoding: .utf8)!)
            return
        }
        if CommandLine.arguments.contains("--store-runtime-check") {
            do {
                let process = Process()
                let bundle = Bundle.main.bundleURL
                let runtime = bundle.appendingPathComponent("Contents/Resources/runtime")
                process.executableURL = bundle.appendingPathComponent("Contents/Frameworks/Python3.framework/Versions/3.9/bin/python3.9")
                process.currentDirectoryURL = runtime
                process.environment = ["PATH": "/usr/bin:/bin", "HOME": FileManager.default.homeDirectoryForCurrentUser.path,
                                       "TMPDIR": NSTemporaryDirectory(), "LANG": "en_US.UTF-8"]
                process.arguments = ["-E", "-s", "-B", "-c", """
                import json, pathlib, subprocess, sys, tempfile, time, urllib.request
                import server
                pdf = sys.stdin.buffer.read()
                assert 'MAYA' in server.extract_pdf(pdf), 'Bundled PDFKit child did not extract the synthetic PDF'
                with tempfile.TemporaryDirectory(prefix='production-desk-store-check-') as directory:
                    root = pathlib.Path(directory); ready = root / 'ready.json'
                    with (root / 'server.log').open('wb') as log:
                        child = subprocess.Popen([sys.executable, '-E', '-s', '-B', 'store_server.py', '--port', '0', '--data', str(root / 'workspace.json'), '--ready-file', str(ready)], stdout=log, stderr=log)
                        try:
                            deadline = time.monotonic() + 15
                            while not ready.exists():
                                if child.poll() is not None or time.monotonic() > deadline:
                                    raise RuntimeError('Sandbox backend failed: ' + (root / 'server.log').read_text())
                                time.sleep(.05)
                            origin = json.loads(ready.read_text())['url']
                            assert origin.startswith('http://127.0.0.1:')
                            def request(path, data=None):
                                req = urllib.request.Request(origin + path, data=data, headers={'Content-Type':'application/json','X-Slate-Local':'1'})
                                return urllib.request.urlopen(req, timeout=10).read()
                            assert b'Production Desk' in request('/')
                            workspace = request('/api/workspace')
                            request('/api/workspace', workspace)
                            assert json.loads(request('/api/workspace')) == json.loads(workspace)
                            assert (root / 'workspace.json').exists()
                            print(json.dumps({'passed': True, 'checks': ['sandbox-inherited Python and PDFKit subprocess', 'loopback server and client', 'packaged editor served', 'workspace save and reload in temporary storage']}))
                        except Exception:
                            print((root / 'server.log').read_text(), file=sys.stderr)
                            raise
                        finally:
                            child.terminate(); child.wait(timeout=10)
                """]
                process.standardInput = FileHandle.standardInput
                process.standardOutput = FileHandle.standardOutput
                process.standardError = FileHandle.standardError
                try process.run(); process.waitUntilExit(); exit(process.terminationStatus)
            } catch { fputs("Store runtime check failed: \(error)\n", stderr); exit(1) }
        }
        let app = NSApplication.shared
        let delegate = ProductionDeskApp()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
