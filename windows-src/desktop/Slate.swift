import AppKit
import WebKit

final class ProductionDeskApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
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
    let updates = ProductionDeskUpdates()

    func applicationDidFinishLaunching(_ notification: Notification) {
        createMenu()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(self, name: "slatePrint")
        configuration.userContentController.addUserScript(WKUserScript(source: "window.print = function(){ window.webkit.messageHandlers.slatePrint.postMessage('print'); };", injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 940), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Production Desk"
        window.minSize = NSSize(width: 900, height: 650)
        window.setFrameAutosaveName("SlateMainWindow")
        window.contentView = web
        window.delegate = self
        updates.window = window
        updates.saveWorkspace = { [weak self] completion in
            guard let self = self else { completion(false); return }
            self.flushWorkspace(completion)
        }
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        web.loadHTMLString("<html><body style='background:#fff;color:#241d21;font:16px Futura;padding:80px'><h1 style='font:40px Futura;color:#E60026'>Production Desk</h1><p>Opening your local workspace…</p></body></html>", baseURL: nil)
        do { try startServer() } catch { fail("Production Desk could not start", detail: error.localizedDescription) }
    }

    func createMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let menu = NSMenu(title: "Production Desk")
        menu.addItem(withTitle: "About Production Desk", action: #selector(showAbout), keyEquivalent: "")
        updates.addMenuItems(to: menu)
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
        file.addItem(withTitle: "Print Schedule…", action: #selector(printSchedule), keyEquivalent: "p")
        fileItem.submenu = file
        NSApp.mainMenu = main
    }

    func startServer() throws {
        let fm = FileManager.default
        let resources = Bundle.main.resourceURL!
        let runtime = resources.appendingPathComponent("runtime")
        support = try fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Slate", isDirectory: true)
        try fm.createDirectory(at: support, withIntermediateDirectories: true)
        let workspace = support.appendingPathComponent("workspace.json")
        // Migrate the original local workspace once; it is never embedded in the DMG.
        if !fm.fileExists(atPath: workspace.path), let source = try? String(contentsOf: resources.appendingPathComponent("migration-source.txt"), encoding: .utf8) {
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
        let pythonHome = Bundle.main.bundleURL.appendingPathComponent("Contents/Frameworks/Python3.framework/Versions/3.9")
        process.executableURL = pythonHome.appendingPathComponent("bin/python3.9")
        process.arguments = ["-E", "-s", "-B", runtime.appendingPathComponent("server.py").path, "--port", "0", "--data", workspace.path, "--ready-file", readyFile.path, "--parent-pid", String(ProcessInfo.processInfo.processIdentifier)]
        // Ignore Python environment variables and user packages; find the stdlib in the bundle.
        process.environment = ["PATH": "/usr/bin:/bin", "HOME": fm.homeDirectoryForCurrentUser.path, "TMPDIR": NSTemporaryDirectory(), "LANG": "en_US.UTF-8"]
        process.currentDirectoryURL = runtime
        process.standardOutput = logHandle
        process.standardError = logHandle
        process.terminationHandler = { [weak self] proc in
            DispatchQueue.main.async {
                guard let self = self, !self.isQuitting else { return }
                self.fail("The local workspace stopped", detail: "Exit status \(proc.terminationStatus). Your saved work is in the app data folder. See desktop.log for details.")
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
                self.web.load(URLRequest(url: url))
                self.updates.start()
            } else if Date() > self.startupDeadline {
                timer.invalidate()
                self.fail("Production Desk took too long to start", detail: "Check desktop.log in the app data folder.")
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "about" { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated,
           url.absoluteString == "mailto:alexanderhosier@squidproductions.org" {
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
    func printPage() {
        let info = NSPrintInfo.shared.copy() as! NSPrintInfo
        info.orientation = .landscape
        info.topMargin = 36; info.bottomMargin = 36; info.leftMargin = 36; info.rightMargin = 36
        web.printOperation(with: info).runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
    }
    @objc func printSchedule() { web.evaluateJavaScript("document.getElementById('export-open').click(); document.getElementById('export-print').click();", completionHandler: nil) }
    @objc func saveWorkspace() { web.evaluateJavaScript("window.slateDesktop?.flush().then(function(ok){if(!ok)alert('Your latest changes could not be saved. Please export a backup.');});", completionHandler: nil) }
    @objc func undoEdit() { web.evaluateJavaScript("if(/INPUT|TEXTAREA/.test(document.activeElement.tagName)){document.execCommand('undo');}else{document.getElementById('undo').click();}", completionHandler: nil) }
    @objc func redoEdit() { web.evaluateJavaScript("if(/INPUT|TEXTAREA/.test(document.activeElement.tagName)){document.execCommand('redo');}else{document.getElementById('redo').click();}", completionHandler: nil) }
    @objc func openData() { if let support = support { NSWorkspace.shared.open(support) } }
    @objc func showAbout() { NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "Production Desk", .applicationVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "", .credits: NSAttributedString(string: "A Squid Productions™ Software\nLocal film scheduling, breakdowns, and shot lists.")]) }
    func fail(_ title: String, detail: String) {
        let alert = NSAlert(); alert.messageText = title; alert.informativeText = detail
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window, completionHandler: nil)
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { window.makeKeyAndOrderFront(nil); return true }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func flushWorkspace(_ completion: @escaping (Bool) -> Void) {
        guard localOrigin != nil else { completion(false); return }
        web.callAsyncJavaScript("return await (window.slateDesktop?.flush() ?? false);", arguments: [:], in: nil, in: .page) { result in
            if case .success(let saved) = result { completion(saved as? Bool == true) }
            else { completion(false) }
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
        if server?.isRunning == true { server?.terminate(); server?.waitUntilExit() }
        if let file = readyFile { try? FileManager.default.removeItem(at: file) }
        try? logHandle?.close()
    }
}

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
