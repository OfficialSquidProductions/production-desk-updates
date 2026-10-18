import UIKit
import WebKit
import UniformTypeIdentifiers

final class DeskViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
    private(set) var webView: WKWebView!
    private let fileQueue = DispatchQueue(label: "local.slate.filmscheduler.files")
    private let store = WorkspaceStore(directory: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0])
    private var shareInProgress = false
    private var pickerReply: ((Any?, String?) -> Void)?
    private var pickerExportURL: URL?
    private var pendingOpenURLs = [URL]()
    private var webReady = false
    private var recovering = false
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    private let errorLabel = UILabel()
    private let retryButton = UIButton(type: .system)
    private let topFill = CAGradientLayer()
    private let bottomFill = CAGradientLayer()
    private var sidebarFraction: CGFloat = 1
    private var fixedSidebar = false
    private var darkAppearance = UserDefaults.standard.string(forKey: "productionDeskNativeTheme") == "dark"
    private var canvasColor = UIColor.white
    private var sidebarColor = UIColor.white
    private var paperColor = UIColor.white
    private var lastWebPortrait: Bool?

    override var preferredStatusBarStyle: UIStatusBarStyle { darkAppearance ? .lightContent : .darkContent }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        layoutAppearanceFills()
        syncWindowLayout()
    }

    private func syncWindowLayout() {
        guard let webView, webView.url != nil, view.bounds.width > 0 else { return }
        // The native window keeps its size when a keyboard occludes WebKit.
        // CSS viewport orientation can change during keyboard presentation.
        let portrait = view.bounds.height >= view.bounds.width
        guard lastWebPortrait != portrait else { return }
        lastWebPortrait = portrait
        webView.callAsyncJavaScript("window.productionDeskPortrait = portrait; window.dispatchEvent(new Event('productiondesk-layout'));", arguments: ["portrait": portrait], in: nil, in: .page) { [weak self] result in
            if case .failure = result, self?.lastWebPortrait == portrait { self?.lastWebPortrait = nil }
        }
    }

    private func layoutAppearanceFills() {
        guard let webView else { return }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        topFill.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: webView.frame.minY)
        bottomFill.frame = CGRect(x: 0, y: webView.frame.maxY, width: view.bounds.width, height: max(0, view.bounds.height - webView.frame.maxY))
        let edge = NSNumber(value: Double(sidebarFraction))
        topFill.colors = [sidebarColor.cgColor, sidebarColor.cgColor, paperColor.cgColor, paperColor.cgColor]
        topFill.locations = [0, edge, edge, 1]
        bottomFill.colors = [sidebarColor.cgColor, sidebarColor.cgColor, canvasColor.cgColor, canvasColor.cgColor]
        let bottomEdge = fixedSidebar ? edge : 0
        bottomFill.locations = [0, bottomEdge, bottomEdge, 1]
        CATransaction.commit()
    }

    private func applyAppearance(_ theme: String, background: String, sidebar: String, paper: String) {
        darkAppearance = theme == "dark"
        canvasColor = Self.themeColor(background) ?? (darkAppearance ? UIColor(red: 25/255, green: 20/255, blue: 25/255, alpha: 1) : UIColor(red: 250/255, green: 248/255, blue: 249/255, alpha: 1))
        sidebarColor = Self.themeColor(sidebar) ?? canvasColor
        paperColor = Self.themeColor(paper) ?? canvasColor
        overrideUserInterfaceStyle = darkAppearance ? .dark : .light
        view.backgroundColor = canvasColor
        view.window?.backgroundColor = canvasColor
        webView?.backgroundColor = canvasColor
        webView?.scrollView.backgroundColor = canvasColor
        webView?.underPageBackgroundColor = canvasColor
        errorLabel.textColor = darkAppearance ? .white : .label
        setNeedsStatusBarAppearanceUpdate()
        layoutAppearanceFills()
    }

    private static func themeColor(_ hex: String) -> UIColor? {
        var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.hasPrefix("#") else { return nil }; text.removeFirst()
        if text.count == 3 { text = text.map { "\($0)\($0)" }.joined() }
        guard text.count == 6, let rgb = UInt32(text, radix: 16) else { return nil }
        return UIColor(red: CGFloat((rgb >> 16) & 255)/255, green: CGFloat((rgb >> 8) & 255)/255, blue: CGFloat(rgb & 255)/255, alpha: 1)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        topFill.name = "theme-top-safe-area"; bottomFill.name = "theme-bottom-safe-area"
        topFill.startPoint = CGPoint(x: 0, y: 0.5); topFill.endPoint = CGPoint(x: 1, y: 0.5)
        bottomFill.startPoint = topFill.startPoint; bottomFill.endPoint = topFill.endPoint
        view.layer.addSublayer(topFill); view.layer.addSublayer(bottomFill)
        let configuration = WKWebViewConfiguration()
        let root = Bundle.main.url(forResource: "Web", withExtension: nil)!
        configuration.setURLSchemeHandler(LocalWebScheme(root: root), forURLScheme: LocalWebScheme.scheme)
        configuration.userContentController.addScriptMessageHandler(WeakSchedulerHandler(controller: self), contentWorld: .page, name: "scheduler")
        let tablet = UIDevice.current.userInterfaceIdiom == .pad
        let portrait = view.bounds.height >= view.bounds.width
        configuration.userContentController.addUserScript(WKUserScript(source: "window.productionDeskTablet = \(tablet ? "true" : "false"); window.productionDeskPortrait = \(portrait ? "true" : "false");", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // Keep appearance preferences between launches; workspace data uses the
        // native store rather than browser local storage.
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        applyAppearance(darkAppearance ? "dark" : "light", background: darkAppearance ? "#191419" : "#faf8f9", sidebar: darkAppearance ? "#211a20" : "#ffffff", paper: darkAppearance ? "#251d23" : "#ffffff")
        webView.accessibilityIdentifier = "production-desk-webview"
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor), webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        errorLabel.numberOfLines = 0
        errorLabel.textAlignment = .center
        errorLabel.accessibilityIdentifier = "native-load-error"
        retryButton.setTitle("Reopen Production Desk", for: .normal)
        retryButton.accessibilityIdentifier = "native-retry"
        retryButton.addTarget(self, action: #selector(reopen), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [errorLabel, retryButton])
        stack.axis = .vertical; stack.spacing = 20; stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([stack.centerXAnchor.constraint(equalTo: view.centerXAnchor), stack.centerYAnchor.constraint(equalTo: view.centerYAnchor), stack.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -48)])
        errorLabel.isHidden = true; retryButton.isHidden = true
        reopen()
    }

    @objc private func reopen() {
        webReady = false
        errorLabel.isHidden = true; retryButton.isHidden = true
        webView.load(URLRequest(url: LocalWebScheme.startURL))
    }

    func flushBeforeBackground() {
        guard backgroundTask == .invalid else { return }
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "Save Production Desk") { [weak self] in self?.endBackgroundSave() }
        webView.callAsyncJavaScript("return await window.slateDesktop?.flush?.();", arguments: [:], in: nil, in: .page) { [weak self] _ in self?.endBackgroundSave() }
    }

    private func endBackgroundSave() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == LocalWebScheme.scheme,
              message.frameInfo.request.url?.host == "app",
              let body = message.body as? [String: Any], let operation = body["operation"] as? String else {
            replyHandler(nil, NativeFileError.invalidRequest.localizedDescription); return
        }
        switch operation {
        case "appearance":
            guard let theme = body["theme"] as? String, ["light", "dark"].contains(theme),
                  let background = body["background"] as? String, let sidebar = body["sidebar"] as? String, let paper = body["paper"] as? String else {
                replyHandler(nil, NativeFileError.invalidRequest.localizedDescription); return
            }
            sidebarFraction = min(1, max(0, (body["sidebarFraction"] as? Double) ?? 1))
            fixedSidebar = body["fixedSidebar"] as? Bool ?? false
            UserDefaults.standard.set(theme, forKey: "productionDeskNativeTheme")
            applyAppearance(theme, background: background, sidebar: sidebar, paper: paper)
            replyHandler(true, nil)
        case "load", "save", "pdf", "export", "storePDF", "readPDF", "backupPDFs", "restorePDFs", "support":
            fileQueue.async { [weak self] in
                guard let self else { return }
                do {
                    var result: Any = true
                    var sharedFile: URL?
                    var recovered = false
                    switch operation {
                    case "support":
                        let file = self.store.directory.appendingPathComponent("support.json")
                        if let request = body["request"] as? [String: Any] {
                            let report: [String: Any] = request["action"] as? String == "clear" ? [:] : ["report": request["report"] ?? [:]]
                            try FileManager.default.createDirectory(at: self.store.directory, withIntermediateDirectories: true)
                            try JSONSerialization.data(withJSONObject: report).write(to: file, options: .atomic)
                        }
                        result = (try? JSONSerialization.jsonObject(with: Data(contentsOf: file))) ?? [:]
                    case "storePDF":
                        guard let encoded = body["base64"] as? String, encoded.utf8.count <= 56 * 1024 * 1024,
                              let data = Data(base64Encoded: encoded), let filename = body["filename"] as? String else { throw NativeFileError.invalidRequest }
                        result = try PDFRepository.store(data, filename: filename, directory: self.store.directory)
                    case "readPDF":
                        guard let hash = body["sha256"] as? String else { throw NativeFileError.invalidRequest }
                        result = try PDFRepository.read(hash, directory: self.store.directory).base64EncodedString()
                    case "backupPDFs":
                        guard let workspace = body["workspace"] as? [String: Any] else { throw NativeFileError.invalidRequest }
                        result = try PDFRepository.backup(workspace, directory: self.store.directory)
                    case "restorePDFs":
                        guard let workspace = body["workspace"] as? [String: Any] else { throw NativeFileError.invalidRequest }
                        try PDFRepository.restore(workspace, directory: self.store.directory)
                    case "load":
                        if let data = try self.store.load() { result = try JSONSerialization.jsonObject(with: data) }
                        else { result = NSNull() }
                        recovered = self.store.lastRecovery != nil
                    case "save":
                        guard let workspace = body["workspace"] as? [String: Any] else { throw NativeFileError.invalidRequest }
                        var stripped = workspace; stripped.removeValue(forKey: "_pdfDocuments")
                        let data = try JSONSerialization.data(withJSONObject: stripped, options: [.sortedKeys])
                        guard data.count <= NativeFiles.maximumBytes else { throw NativeFileError.tooLarge }
                        try self.store.save(data)
                    case "pdf":
                        guard let base64 = body["base64"] as? String, base64.utf8.count <= NativeFiles.maximumBytes * 4 / 3 + 8,
                              let data = Data(base64Encoded: base64) else { throw NativeFileError.invalidRequest }
                        result = try NativeFiles.extractPDF(data)
                    case "export":
                        guard let filename = body["filename"] as? String, let content = body["content"] as? String else { throw NativeFileError.invalidRequest }
                        let data: Data
                        if body["encoding"] as? String == "base64" { guard let decoded = Data(base64Encoded: content) else { throw NativeFileError.invalidRequest }; data = decoded }
                        else { data = Data(content.utf8) }
                        sharedFile = try NativeFiles.export(data, filename: filename)
                    default: break
                    }
                    DispatchQueue.main.async {
                        if let sharedFile {
                            do {
                                if body["destination"] as? String == "files" { try self.saveToFiles(sharedFile, reply: replyHandler) }
                                else if body["destination"] as? String == "share" { try self.shareProject(sharedFile, reply: replyHandler) }
                                else { try self.share(sharedFile, completion: { replyHandler(true, nil) }) }
                            }
                            catch { replyHandler(nil, error.localizedDescription) }
                        } else if recovered {
                            let warning = "Production Desk recovered the previous saved workspace. The latest edits may be missing. The original damaged file, if present, was preserved in Documents/Recovered. Export a full backup now."
                            self.webView.callAsyncJavaScript("window.productionDeskRecovery = warning; return true;", arguments: ["warning": warning], in: nil, in: .page) { _ in replyHandler(result, nil) }
                        } else { replyHandler(result, nil) }
                    }
                } catch { DispatchQueue.main.async { replyHandler(nil, error.localizedDescription) } }
            }
        case "pickImport":
            guard presentedViewController == nil, pickerReply == nil else { replyHandler(nil, "Finish the current file action first."); return }
            pickerReply = replyHandler
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.productionDeskProject, .json, .pdf, .plainText, .xml, .data], asCopy: true)
            picker.delegate = self; picker.allowsMultipleSelection = false
            picker.directoryURL = store.directory
            present(picker, animated: true)
            picker.presentationController?.delegate = self
        case "copy":
            guard let value = body["content"] as? String else { replyHandler(nil, "Missing report."); return }; UIPasteboard.general.string = value; replyHandler(true, nil)
        case "print":
            makeReportPDF(replyHandler)
        default: replyHandler(nil, NativeFileError.invalidRequest.localizedDescription)
        }
    }

    private func saveToFiles(_ url: URL, reply: @escaping (Any?, String?) -> Void) throws {
        guard presentedViewController == nil, pickerReply == nil else { throw NativeFileError.invalidRequest }
        pickerReply = reply; pickerExportURL = url
        let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
        picker.delegate = self
        picker.directoryURL = store.directory
        present(picker, animated: true)
        picker.presentationController?.delegate = self
    }

    private func shareProject(_ url: URL, reply: @escaping (Any?, String?) -> Void) throws {
        guard !shareInProgress, presentedViewController == nil else { throw NativeFileError.invalidRequest }
        shareInProgress = true
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = webView
        controller.popoverPresentationController?.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.midY, width: 1, height: 1)
        controller.popoverPresentationController?.permittedArrowDirections = []
        controller.completionWithItemsHandler = { [weak self] _, completed, _, error in
            self?.shareInProgress = false
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
            reply(error == nil ? ["native": true, "cancelled": !completed] : nil, error?.localizedDescription)
        }
        present(controller, animated: true)
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        if let picker = presentationController.presentedViewController as? UIDocumentPickerViewController, pickerReply != nil {
            documentPickerWasCancelled(picker)
        }
        consumeOpenURL()
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        controller.view.endEditing(true)
        view.endEditing(true)
        let reply = pickerReply; pickerReply = nil
        if let url = pickerExportURL {
            pickerExportURL = nil
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
            reply?(["native": true, "cancelled": true], nil)
        } else { reply?(NSNull(), nil) }
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let reply = pickerReply; pickerReply = nil
        if let url = pickerExportURL {
            pickerExportURL = nil
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
            reply?(["native": true, "cancelled": false], nil)
            return
        }
        guard let url = urls.first else { reply?(NSNull(), nil); return }
        fileQueue.async {
            do {
                let file = try NativeFiles.importFile(url)
                DispatchQueue.main.async { reply?(file, nil) }
            } catch { DispatchQueue.main.async { reply?(nil, error.localizedDescription) } }
        }
    }

    func openProjectFile(_ url: URL) {
        pendingOpenURLs.append(url)
        consumeOpenURL()
    }

    private func consumeOpenURL() {
        guard webReady, presentedViewController == nil, let url = pendingOpenURLs.first else { return }
        pendingOpenURLs.removeFirst()
        fileQueue.async { [weak self] in
            do {
                guard ["productiondesk", "json", "uss"].contains(url.pathExtension.lowercased()) else { throw NativeFileError.invalidRequest }
                let file = try NativeFiles.importFile(url)
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.webView.callAsyncJavaScript("""
                    const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));
                    await window.slateDesktop.importProjectFile(new File([bytes],file.filename));
                    return true;
                    """, arguments: ["file": file], in: nil, in: .page) { result in
                        if case .failure(let error) = result { self.showImportError(error) }
                        self.consumeOpenURL()
                    }
                }
            } catch { DispatchQueue.main.async { self?.showImportError(error) } }
        }
    }

    private func showImportError(_ error: Error) {
        let alert = UIAlertController(title: "Could not import project", message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in self?.consumeOpenURL() })
        present(alert, animated: true)
    }

    private func share(_ url: URL, completion: @escaping () -> Void) throws {
        guard !shareInProgress, presentedViewController == nil else { throw NativeFileError.invalidRequest }
        shareInProgress = true
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = webView
        controller.popoverPresentationController?.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.midY, width: 1, height: 1)
        controller.popoverPresentationController?.permittedArrowDirections = []
        controller.completionWithItemsHandler = { [weak self] _, _, _, _ in
            self?.shareInProgress = false
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
            completion()
        }
        present(controller, animated: true)
    }

    private func makeReportPDF(_ reply: @escaping (Any?, String?) -> Void) {
        webView.evaluateJavaScript("document.querySelector('#print-area')?.innerHTML || ''") { [weak self] value, error in
            guard let self else { return }
            guard error == nil, let report = value as? String, !report.isEmpty else {
                reply(nil, NativeFileError.emptyReport.localizedDescription); return
            }
            do {
                // Explicit report styling avoids screen-only display:none and scroll clipping.
                let html = """
                <!doctype html><html><head><meta charset="utf-8"><style>
                body{font-family:Helvetica,Arial,sans-serif;font-size:9px;color:#241d21}h1{font-size:24px;color:#E60026}h2{font-size:16px}p{color:#64555e}table{border-collapse:collapse;width:100%;table-layout:auto}th{background:#fff0f4;text-align:left}th,td{border-bottom:1px solid #ddd;padding:5px;vertical-align:top}tr{page-break-inside:avoid}thead{display:table-header-group}button{display:none}.badges{white-space:normal}.strip{padding:8px;background:#fff0f4}.strip.banner{background:#E60026;color:white}.strip-color-button{display:none}
                </style></head><body>\(report)</body></html>
                """
                let renderer = ReportRenderer()
                renderer.addPrintFormatter(UIMarkupTextPrintFormatter(markupText: html), startingAtPageAt: 0)
                let data = renderer.pdfData()
                guard !data.isEmpty else { throw NativeFileError.emptyReport }
                let url = try NativeFiles.export(data, filename: "Production-Desk-report.pdf")
                try self.share(url) { reply(true, nil) }
            } catch { reply(nil, error.localizedDescription) }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == LocalWebScheme.scheme, url.host == "app" {
            // Home links should retain current editing state. Resource requests
            // are handled independently by the custom URL scheme.
            if navigationAction.navigationType == .linkActivated { decisionHandler(.cancel) }
            else if navigationAction.navigationType == .reload || navigationAction.navigationType == .backForward { decisionHandler(.cancel) }
            else { decisionHandler(.allow) }
        } else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated, ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") { UIApplication.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        recovering = true
        reopen()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        recovering = false
        lastWebPortrait = nil
        syncWindowLayout()
        Task { @MainActor in
            for _ in 0..<150 {
                if (try? await webView.evaluateJavaScript("document.body?.dataset.appReady==='true'")) as? Bool == true {
                    webReady = true; consumeOpenURL(); return
                }
                try? await Task.sleep(for: .milliseconds(100))
            }
        }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showLoadError(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showLoadError(error) }
    private func showLoadError(_ error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        errorLabel.text = "Production Desk could not open. Your saved workspace is kept on this device.\n\(error.localizedDescription)"
        errorLabel.isHidden = false; retryButton.isHidden = false
    }
}

private final class WeakSchedulerHandler: NSObject, WKScriptMessageHandlerWithReply {
    weak var controller: DeskViewController?
    init(controller: DeskViewController) { self.controller = controller }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let controller else { replyHandler(nil, "Production Desk is closing."); return }
        controller.userContentController(userContentController, didReceive: message, replyHandler: replyHandler)
    }
}

final class ReportRenderer: UIPrintPageRenderer {
    override var paperRect: CGRect { CGRect(x: 0, y: 0, width: 792, height: 612) }
    override var printableRect: CGRect { paperRect.insetBy(dx: 28, dy: 28) }
    func pdfData() -> Data {
        let result = NSMutableData()
        UIGraphicsBeginPDFContextToData(result, paperRect, nil)
        prepare(forDrawingPages: NSRange(location: 0, length: numberOfPages))
        for page in 0..<numberOfPages {
            UIGraphicsBeginPDFPage()
            drawPage(at: page, in: UIGraphicsGetPDFContextBounds())
        }
        UIGraphicsEndPDFContext()
        return result as Data
    }
}
