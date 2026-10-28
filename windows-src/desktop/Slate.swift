import AppKit
import WebKit

// Preview bundles never share the stable or beta data directory, even when opened directly.
enum ProductionDeskDataLocation {
    static func folder(info: [String: Any]) -> String {
        if info["ProductionDeskPreview"] as? Bool == true {
            let raw = info["CFBundleIdentifier"] as? String ?? "local"
            let safe = String(raw.map { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "." || $0 == "-") ? $0 : "_" }.prefix(100))
            return "ProductionDeskPreviews/preview-" + (safe.isEmpty ? "local" : safe)
        }
        return info["ProductionDeskBeta"] as? Bool == true ? "ProductionDeskBeta" : "Slate"
    }
}

final class ProductionDeskApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    var isDevelopmentPreview: Bool { Bundle.main.object(forInfoDictionaryKey: "ProductionDeskBeta") as? Bool == true || Bundle.main.object(forInfoDictionaryKey: "ProductionDeskPreview") as? Bool == true }
    var window: NSWindow!
    var web: WKWebView!
    var server: Process?
    var readyTimer: Timer?
    var readyFile: URL!
    var logHandle: FileHandle?
    var localOrigin: URL?
    var startupDeadline = Date()
    var support: URL!
    var isQuitting = false
    let updates: ProductionDeskUpdates
    private var editorReadinessTimer: Timer?
    private var editorReadinessGeneration = 0
    private var editorReadinessProbeInFlight = false
    private var updaterStartupRetryAfter = Date.distantPast
    private var updaterStartupRetryDelay: TimeInterval = 1
    var sessionFile: URL?
    #if APP_STORE
    let storeExports = StoreExports()
    #endif

    init(updates: ProductionDeskUpdates = ProductionDeskUpdates()) {
        self.updates = updates
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        createMenu()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.addUserScript(WKUserScript(source: "window.SquidPlatform='MacBook';", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let buildMetadata = ["version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
                             "build": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""]
        let buildJSON = String(data: try! JSONSerialization.data(withJSONObject: buildMetadata), encoding: .utf8)!
        configuration.userContentController.addUserScript(WKUserScript(source: "window.SquidBuild=" + buildJSON + ";", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #if APP_STORE
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "storeExport")
        let metadata = StoreExportPolicy.metadataScript(
            version: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
            build: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown")
        configuration.userContentController.addUserScript(WKUserScript(source: metadata, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        #endif
        configuration.userContentController.add(self, name: "slatePrint")
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "supportCopy")
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "supportEmail")
        configuration.userContentController.addUserScript(WKUserScript(source: "window.print = function(){ window.webkit.messageHandlers.slatePrint.postMessage('print'); };", injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 940), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "Production Desk"
        window.minSize = NSSize(width: 900, height: 650)
        window.setFrameAutosaveName("SlateMainWindow")
        window.contentView = web
        window.delegate = self
        updates.window = window
        updates.saveWorkspace = { [weak self] completion in
            guard let self = self else { completion(false); return }
            self.flushWorkspace(completion, forUpdate: true)
        }
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        web.loadHTMLString("<html><body style='background:#fff;color:#241d21;font:16px Futura;padding:80px'><h1 style='font:40px Futura;color:#E60026'>Production Desk</h1><p>Opening your local workspace…</p></body></html>", baseURL: nil)
        do { try startServer() } catch { fail("Production Desk could not start", detail: error.localizedDescription, crashKind: "startup") }
    }

    func createMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let menu = NSMenu(title: "Production Desk")
        menu.addItem(withTitle: "About Production Desk", action: #selector(showAbout), keyEquivalent: "")
        if !isDevelopmentPreview { updates.addMenuItems(to: menu) }
        menu.addItem(withTitle: "Open Data Folder", action: #selector(openData), keyEquivalent: "")
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Hide Production Desk", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Quit Production Desk", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = menu
        let editItem = NSMenuItem()
        main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: #selector(undoEdit), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: #selector(redoEdit), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(NSMenuItem.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        let fileItem = NSMenuItem()
        main.addItem(fileItem)
        let file = NSMenu(title: "File")
        file.addItem(withTitle: "Save", action: #selector(saveWorkspace), keyEquivalent: "s")
        let saveAs = file.addItem(withTitle: "Save As…", action: #selector(saveProjectAs), keyEquivalent: "s")
        saveAs.keyEquivalentModifierMask = [.command, .shift]
        file.addItem(withTitle: "Import…", action: #selector(importProject), keyEquivalent: "o")
        file.addItem(withTitle: "Print Schedule…", action: #selector(printSchedule), keyEquivalent: "p")
        fileItem.submenu = file
        NSApp.mainMenu = main
    }

    func startServer() throws {
        let fm = FileManager.default
        let resources = Bundle.main.resourceURL!
        let runtime = resources.appendingPathComponent("runtime")
        support = try fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent(ProductionDeskDataLocation.folder(info: Bundle.main.infoDictionary ?? [:]), isDirectory: true)
        try fm.createDirectory(at: support, withIntermediateDirectories: true)
        prepareSupportSession()
        let workspace = support.appendingPathComponent("workspace.json")
        // Migrate the original local workspace once; it is never embedded in the DMG.
        if !isDevelopmentPreview, !fm.fileExists(atPath: workspace.path), let source = try? String(contentsOf: resources.appendingPathComponent("migration-source.txt"), encoding: .utf8) {
            let original = URL(fileURLWithPath: source.trimmingCharacters(in: .whitespacesAndNewlines))
            if fm.fileExists(atPath: original.path) {
                let data = try Data(contentsOf: original)
                if let value = try JSONSerialization.jsonObject(with: data) as? [String: Any], value["projects"] is [[String: Any]] {
                    try data.write(to: workspace, options: .atomic)
                }
            }
        }
        readyFile = support.appendingPathComponent(".ready-\(UUID().uuidString).json")
        let logURL = support.appendingPathComponent("desktop.log")
        fm.createFile(atPath: logURL.path, contents: nil)
        logHandle = try FileHandle(forWritingTo: logURL)
        let process = Process()
        #if APP_STORE
        process.executableURL = Bundle.main.bundleURL.appendingPathComponent("Contents/Frameworks/Python.framework/Versions/3.14/bin/python3.14")
        let serverScript = "store_server.py"
        #else
        let pythonHome = Bundle.main.bundleURL.appendingPathComponent("Contents/Frameworks/Python3.framework/Versions/3.9")
        process.executableURL = pythonHome.appendingPathComponent("bin/python3.9")
        let serverScript = "server.py"
        #endif
        process.arguments = ["-E", "-s", "-B", runtime.appendingPathComponent(serverScript).path, "--port", "0", "--data", workspace.path, "--ready-file", readyFile.path, "--parent-pid", String(ProcessInfo.processInfo.processIdentifier)]
        // Ignore Python environment variables and user packages; find the stdlib in the bundle.
        process.environment = ["PATH": "/usr/bin:/bin", "HOME": fm.homeDirectoryForCurrentUser.path, "TMPDIR": NSTemporaryDirectory(), "LANG": "en_US.UTF-8"]
        process.currentDirectoryURL = runtime
        process.standardOutput = logHandle
        process.standardError = logHandle
        process.terminationHandler = { [weak self] proc in
            DispatchQueue.main.async {
                guard let self = self, !self.isQuitting else { return }
                self.fail("The local workspace stopped", detail: "Exit status \(proc.terminationStatus). Your saved work is in the app data folder. See desktop.log for details.", crashKind: "backend")
            }
        }
        server = process
        try process.run()
        startupDeadline = Date().addingTimeInterval(20)
        readyTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] timer in
            guard let self = self else { timer.invalidate(); return }
            if let data = try? Data(contentsOf: self.readyFile), let value = try? JSONSerialization.jsonObject(with: data) as? [String: String], let address = value["url"], let url = URL(string: address), url.host == "127.0.0.1" {
                timer.invalidate()
                try? fm.removeItem(at: self.readyFile)
                self.localOrigin = url
                self.observeEditorReadiness()
                self.web.load(URLRequest(url: url))
            } else if Date() > self.startupDeadline {
                timer.invalidate()
                self.fail("Production Desk took too long to start", detail: "Check desktop.log in the app data folder.", crashKind: "startup")
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        observeEditorReadiness()
    }

    // Observe independently of didFinish: modules can install the bridge later,
    // and navigation callbacks may be missed. Each probe returns immediately,
    // even while the editor's readiness promise is still pending.
    func observeEditorReadiness() {
        #if !APP_STORE
        guard !isDevelopmentPreview, !isQuitting, editorReadinessTimer == nil else { return }
        editorReadinessTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.probeEditorReadiness()
        }
        probeEditorReadiness()
        #endif
    }

    func stopEditorReadinessObservation() {
        editorReadinessTimer?.invalidate()
        editorReadinessTimer = nil
        editorReadinessGeneration += 1
        editorReadinessProbeInFlight = false
    }

    private func probeEditorReadiness() {
        #if !APP_STORE
        guard !isQuitting, !editorReadinessProbeInFlight, let web = web,
              Date() >= updaterStartupRetryAfter,
              let origin = localOrigin, origin.scheme == "http", origin.host == "127.0.0.1",
              web.url?.scheme == origin.scheme, web.url?.host == origin.host, web.url?.port == origin.port else { return }
        let generation = editorReadinessGeneration
        editorReadinessProbeInFlight = true
        web.evaluateJavaScript("""
            (() => {
                const ready = window.slateDesktop?.ready;
                if (!ready) return false;
                let state = window.__productionDeskNativeReadiness;
                if (!state || state.promise !== ready) {
                    state = {promise: ready, ready: false};
                    window.__productionDeskNativeReadiness = state;
                    Promise.resolve(ready).then(value => { state.ready = value === true; }, () => {});
                }
                return state.ready;
            })()
            """) { [weak self, weak web] value, _ in
                guard let self = self, self.editorReadinessGeneration == generation else { return }
                self.editorReadinessProbeInFlight = false
                guard !self.isQuitting, web?.url?.scheme == origin.scheme,
                      web?.url?.host == origin.host, web?.url?.port == origin.port,
                      self.localOrigin == origin, value as? Bool == true else { return }
                if self.updates.start() { self.stopEditorReadinessObservation() }
                else {
                    // A persistent Sparkle configuration error must not produce
                    // a tight retry/log loop. Manual checks can retry immediately.
                    self.updaterStartupRetryAfter = Date().addingTimeInterval(self.updaterStartupRetryDelay)
                    self.updaterStartupRetryDelay = min(30, self.updaterStartupRetryDelay * 2)
                }
            }
        #endif
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "about" { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated,
           navigationAction.sourceFrame.isMainFrame,
           isSupportMailto(url) {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        guard url.scheme == "http", url.host == "127.0.0.1", url.port == localOrigin?.port else {
            decisionHandler(.cancel)
            return
        }
        if navigationAction.shouldPerformDownload || url.path.hasPrefix("/api/download/") { decisionHandler(.download) }
        else { decisionHandler(.allow) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if let response = navigationResponse.response as? HTTPURLResponse, response.value(forHTTPHeaderField: "Content-Disposition")?.contains("attachment") == true { decisionHandler(.download) }
        else { decisionHandler(.allow) }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.canCreateDirectories = true
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if (error as NSError).code != NSURLErrorCancelled { fail("Export could not be saved", detail: error.localizedDescription) }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert(); alert.messageText = message
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { response in completionHandler(response == .alertFirstButtonReturn) }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "slatePrint" { printPage() }

    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        #if APP_STORE
        if message.name == "storeExport" {
            guard StoreExportPolicy.authorized(mainFrame: message.frameInfo.isMainFrame,
                    scheme: message.frameInfo.securityOrigin.protocol,
                    host: message.frameInfo.securityOrigin.host, port: message.frameInfo.securityOrigin.port,
                    origin: localOrigin), let origin = localOrigin, let path = message.body as? String else {
                replyHandler(nil, "A local main-frame export is required."); return
            }
            storeExports.save(path: path, origin: origin, window: window, reply: replyHandler)
            return
        }
        #endif
        guard ["supportCopy", "supportEmail"].contains(message.name), message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "http", message.frameInfo.securityOrigin.host == "127.0.0.1",
              message.frameInfo.securityOrigin.port == localOrigin?.port,
              let text = message.body as? String, text.count <= (message.name == "supportEmail" ? 32768 : 10000) else { replyHandler(nil, "Local support report required."); return }
        if message.name == "supportEmail" {
            guard let url = URL(string: text), isSupportMailto(url) else { replyHandler(nil, "Invalid support email."); return }
            replyHandler(NSWorkspace.shared.open(url), nil)
            return
        }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        replyHandler(true, nil)
    }
    func printPage() {
        let info = NSPrintInfo.shared.copy() as! NSPrintInfo
        info.orientation = .landscape
        info.topMargin = 36; info.bottomMargin = 36; info.leftMargin = 36; info.rightMargin = 36
        web.printOperation(with: info).runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
    }
    @objc func printSchedule() { web.evaluateJavaScript("document.getElementById('export-open').click(); document.getElementById('export-print').click();", completionHandler: nil) }
    @objc func saveProjectAs() { web.evaluateJavaScript("window.slateDesktop?.saveAs()", completionHandler: nil) }
    @objc func importProject() { web.evaluateJavaScript("window.slateDesktop?.importScript()", completionHandler: nil) }
    @objc func saveWorkspace() { web.evaluateJavaScript("window.slateDesktop?.flush().then(function(ok){if(!ok)alert('Your latest changes could not be saved. Please export a backup.');});", completionHandler: nil) }
    @objc func undoEdit() { web.evaluateJavaScript("window.slateDesktop?.undoEdit(false)", completionHandler: nil) }
    @objc func redoEdit() { web.evaluateJavaScript("window.slateDesktop?.undoEdit(true)", completionHandler: nil) }
    @objc func openData() { if let support = support { NSWorkspace.shared.open(support) } }
    @objc func showAbout() { NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "Production Desk", .applicationVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "", .credits: NSAttributedString(string: "A Squid Productions™ Software\nLocal film scheduling, breakdowns, and shot lists.")]) }
    func isSupportMailto(_ url: URL) -> Bool {
        guard url.scheme == "mailto", url.path.lowercased() == "alexanderhosier@squidproductions.org", url.absoluteString.count <= 32768 else { return false }
        return URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.allSatisfy({ ["subject", "body"].contains($0.name) }) ?? true
    }
    func recordCrash(_ kind: String, _ message: String) {
        guard let support = support else { return }
        let report: [String: String] = ["kind": kind, "time": ISO8601DateFormatter().string(from: Date()),
            "message": String(String.UnicodeScalarView(message.unicodeScalars.prefix(500))), "location": "", "version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"]
        let file = support.appendingPathComponent("support-crash.json")
        if let data = try? JSONSerialization.data(withJSONObject: report) {
            try? data.write(to: file, options: .atomic)
            try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        }
    }
    func prepareSupportSession() {
        let file = support.appendingPathComponent("support-session.json")
        if let raw = try? Data(contentsOf: file), let prior = try? JSONSerialization.jsonObject(with: raw) as? [String: Int],
           let pid = prior["pid"], NSRunningApplication(processIdentifier: pid_t(pid)) == nil {
            recordCrash("session", "The previous desktop session ended unexpectedly. This can follow a crash, force quit, or system shutdown.")
        }
        if let raw = try? JSONSerialization.data(withJSONObject: ["pid": Int(ProcessInfo.processInfo.processIdentifier)]) {
            try? raw.write(to: file, options: .atomic)
            sessionFile = file
        }
    }
    func composeCrashReport() {
        let alert = NSAlert(); alert.messageText = "Report a crash"
        alert.informativeText = "Describe what you were doing and what happened. An email draft to alexanderhosier@squidproductions.org will open for you to review and send."
        let scroll = NSScrollView(frame: NSRect(x: 0, y: 0, width: 480, height: 140))
        let text = NSTextView(frame: scroll.bounds); text.isRichText = false; text.font = .systemFont(ofSize: 13)
        scroll.documentView = text; scroll.hasVerticalScroller = true; alert.accessoryView = scroll
        alert.addButton(withTitle: "Open Email Draft"); alert.addButton(withTitle: "Cancel")
        while alert.runModal() == .alertFirstButtonReturn {
            let description = text.string.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !description.isEmpty else { alert.informativeText = "Please describe what happened before opening an email draft."; continue }
            let file = support?.appendingPathComponent("support-crash.json")
            let raw = file.flatMap { try? Data(contentsOf: $0) }
            let report = raw.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] } ?? [:]
            let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
            let body = "What happened:\n" + String(description.prefix(1800)) + "\n\nProduction Desk " + version + "\n" + ProcessInfo.processInfo.operatingSystemVersionString + "\nRecorded: " + (report["time"] ?? "unknown") + "\nProblem: " + (report["kind"] ?? "crash") + "\n" + (report["message"] ?? "Unexpected application failure")
            var address = URLComponents(); address.scheme = "mailto"; address.path = "alexanderhosier@squidproductions.org"
            address.queryItems = [URLQueryItem(name: "subject", value: "Production Desk " + version + " — crash report"), URLQueryItem(name: "body", value: body)]
            if let url = address.url, NSWorkspace.shared.open(url) { return }
            NSPasteboard.general.clearContents(); NSPasteboard.general.setString(body, forType: .string)
            let help = NSAlert(); help.messageText = "Report copied"; help.informativeText = "An email app could not be opened. Paste the copied report into an email to alexanderhosier@squidproductions.org."; help.runModal()
            return
        }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        recordCrash("renderer", "The app's web content process stopped unexpectedly.")
        let alert = NSAlert(); alert.messageText = "Production Desk’s view stopped"
        alert.informativeText = "Reload to reopen your saved work. Crash details have been saved locally for reporting."
        alert.addButton(withTitle: "Reload View"); alert.addButton(withTitle: "Report Crash…"); alert.addButton(withTitle: "Later")
        alert.beginSheetModal(for: window) { [weak self] response in
            if response == .alertFirstButtonReturn { webView.reload() }
            if response == .alertSecondButtonReturn { self?.composeCrashReport() }
        }
    }
    func fail(_ title: String, detail: String, crashKind: String? = nil) {
        if let kind = crashKind { recordCrash(kind, title + ": " + detail) }
        let alert = NSAlert(); alert.messageText = title; alert.informativeText = detail
        alert.addButton(withTitle: "OK")
        if crashKind != nil { alert.addButton(withTitle: "Report Crash…") }
        alert.beginSheetModal(for: window) { [weak self] response in
            if response == .alertSecondButtonReturn { self?.composeCrashReport() }
        }
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { window.makeKeyAndOrderFront(nil); return true }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func flushWorkspace(_ completion: @escaping (Bool) -> Void, forUpdate: Bool = false) {
        guard localOrigin != nil else { completion(false); return }
        var finished = false
        let finish: (Bool) -> Void = { saved in
            guard !finished else { return }
            finished = true
            completion(saved)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { finish(false) }
        let method = forUpdate ? "prepareForUpdate" : "flush"
        web.callAsyncJavaScript("return await (window.slateDesktop?.\(method)() ?? false);", arguments: [:], in: nil, in: .page) { result in
            if case .success(let saved) = result { finish(saved as? Bool == true) }
            else { finish(false) }
        }
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if isQuitting { return .terminateNow }
        guard localOrigin != nil else { isQuitting = true; return .terminateNow }
        flushWorkspace { [weak self] saved in
            guard let self = self else { sender.reply(toApplicationShouldTerminate: true); return }
            if saved { self.isQuitting = true; sender.reply(toApplicationShouldTerminate: true) }
            else {
                let alert = NSAlert(); alert.messageText = "Your latest changes have not been saved"; alert.informativeText = "Keep Production Desk open to retry saving or export a backup."
                alert.addButton(withTitle: "Keep Working"); alert.addButton(withTitle: "Quit Without Saving")
                alert.beginSheetModal(for: self.window) { response in
                    let quit = response == .alertSecondButtonReturn
                    self.isQuitting = quit; sender.reply(toApplicationShouldTerminate: quit)
                }
            }
        }
        return .terminateLater
    }
    func applicationWillTerminate(_ notification: Notification) {
        isQuitting = true; readyTimer?.invalidate()
        stopEditorReadinessObservation()
        if let file = sessionFile, let raw = try? Data(contentsOf: file),
           let value = try? JSONSerialization.jsonObject(with: raw) as? [String: Int],
           value["pid"] == Int(ProcessInfo.processInfo.processIdentifier) { try? FileManager.default.removeItem(at: file) }
        if server?.isRunning == true { server?.terminate(); server?.waitUntilExit() }
        if let file = readyFile { try? FileManager.default.removeItem(at: file) }
        try? logHandle?.close()
    }
}

#if !SUPPORT_TESTING
@main
struct ProductionDeskMain {
    static func main() {
        let app = NSApplication.shared
        let delegate = ProductionDeskApp()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

#endif
