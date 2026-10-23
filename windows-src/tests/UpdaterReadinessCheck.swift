import AppKit
import WebKit
import Sparkle

// Real navigation delegate; no application launch delegate, project backend or production identity.
@main struct UpdaterReadinessCheck {
    static func spin(_ seconds: Double) {
        let end = Date().addingTimeInterval(seconds)
        while Date() < end { RunLoop.main.run(until: Date().addingTimeInterval(0.02)) }
    }

    static func main() {
        _ = NSApplication.shared
        let args = CommandLine.arguments
        let home = URL(fileURLWithPath: args[2]).resolvingSymlinksInPath()
        precondition(FileManager.default.homeDirectoryForCurrentUser.resolvingSymlinksInPath() == home)
        precondition(Bundle.main.bundleIdentifier?.hasPrefix("local.productiondesk.updater-readiness-qa.") == true)
        precondition(Bundle.main.object(forInfoDictionaryKey: "SUFeedURL") as? String == args[1] + "/appcast.xml")
        let mode = args[3]
        #if BASELINE_UPDATER
        let subject = ProductionDeskApp()
        #else
        var starts = 0
        let subject = ProductionDeskApp(updates: ProductionDeskUpdates(startUpdater: { engine in
            starts += 1
            if mode == "automatic-retry" && starts == 1 { throw NSError(domain: "ReadinessFixture", code: 1) }
            try engine.start()
        }))
        #endif
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 900, height: 650), configuration: config)
        subject.web = web
        subject.localOrigin = URL(string: args[1])!
        web.navigationDelegate = subject
        #if !BASELINE_UPDATER
        subject.observeEditorReadiness()
        subject.observeEditorReadiness()
        if mode == "missed-navigation" { web.navigationDelegate = nil }
        #endif
        web.load(URLRequest(url: URL(string: args[1] + "/" + mode)!))
        #if !BASELINE_UPDATER
        if mode == "interrupted" {
            spin(0.2)
            subject.stopEditorReadinessObservation()
            subject.observeEditorReadiness()
            subject.stopEditorReadinessObservation() // invalidate an in-flight probe, too
            web.navigationDelegate = nil
            spin(0.9)
            precondition(!subject.updates.updateEngine.canCheckForUpdates, "Stopped observation must not initialize updater")
            subject.observeEditorReadiness()
        }
        if mode == "navigation-retry" {
            spin(0.2)
            web.load(URLRequest(url: URL(string: args[1] + "/missing-bridge")!))
        }
        if mode == "untrusted-origin" {
            spin(0.2) // allow the trusted navigation, then invalidate its origin
            subject.localOrigin = URL(string: "http://127.0.0.1:1")!
        }
        if mode == "quitting" { subject.isQuitting = true }
        #endif
        spin(mode == "automatic-retry" ? 3.2 : 2.0)
        var ready = false
        web.evaluateJavaScript("window.fixtureReady === true") { value, _ in ready = (value as? Bool) == true }
        spin(0.2)
        precondition(ready, "Delayed editor fixture did not become ready")
        let menu = NSMenu()
        subject.updates.addMenuItems(to: menu)
        let enabled = subject.updates.validateMenuItem(menu.items[0])
        #if BASELINE_UPDATER
        precondition(!enabled, "Baseline recovered; reproduction invalid")
        print("REPRODUCED: unmodified native didFinish ran before the bridge existed; editor later ready=true, update command permanently disabled")
        #else
        if ["untrusted-origin", "quitting"].contains(mode) {
            precondition(starts == 0, "Untrusted/quitting page must never initialize updater")
            subject.stopEditorReadinessObservation()
            print("PASS \(mode): editor ready but updater not started")
            return
        }
        precondition(enabled, "Update command remained disabled after editor readiness")
        subject.updates.start()
        subject.updates.start()
        spin(0.3)
        precondition(subject.updates.validateMenuItem(menu.items[0]), "Repeated callbacks wedged menu")
        subject.stopEditorReadinessObservation()
        precondition(starts == (mode == "automatic-retry" ? 2 : 1), "Readiness must initialize once except after failure")
        print("PASS \(mode): real WK navigation, readiness recovery and repeated callbacks safe")
        #endif
    }
}
