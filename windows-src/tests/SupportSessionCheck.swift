import AppKit
import WebKit

@main
struct SupportSessionCheck {
    static func main() throws {
        precondition(ProductionDeskDataLocation.folder(info: [:]) == "Slate")
        precondition(ProductionDeskDataLocation.folder(info: ["ProductionDeskBeta": true]) == "ProductionDeskBeta")
        let preview = ProductionDeskDataLocation.folder(info: ["ProductionDeskPreview": true, "CFBundleIdentifier": "local.productiondesk.qa"])
        precondition(preview == "ProductionDeskPreviews/preview-local.productiondesk.qa")
        precondition(ProductionDeskDataLocation.folder(info: ["ProductionDeskPreview": true, "ProductionDeskBeta": true]) == "ProductionDeskPreviews/preview-local")
        let unusual = ProductionDeskDataLocation.folder(info: ["ProductionDeskPreview": true, "CFBundleIdentifier": "../../private/test"])
        precondition(unusual.hasPrefix("ProductionDeskPreviews/preview-") && !unusual.dropFirst("ProductionDeskPreviews/".count).contains("/"))
        _ = NSApplication.shared
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let app = ProductionDeskApp()
        app.support = folder
        let marker = folder.appendingPathComponent("support-session.json")
        let report = folder.appendingPathComponent("support-crash.json")
        try Data("{\"pid\":999999999}".utf8).write(to: marker)
        app.prepareSupportSession()
        let value = try JSONSerialization.jsonObject(with: Data(contentsOf: report)) as! [String: String]
        precondition(value["kind"] == "session", "Unclean exit was not detected")
        precondition(value["message"]!.contains("ended unexpectedly"))
        app.applicationWillTerminate(Notification(name: NSApplication.willTerminateNotification))
        precondition(!FileManager.default.fileExists(atPath: marker.path), "Clean exit retained the session marker")
        try FileManager.default.removeItem(at: report)
        app.prepareSupportSession()
        precondition(!FileManager.default.fileExists(atPath: report.path), "Clean startup was reported as a crash")
        app.recordCrash("renderer", "Synthetic renderer termination")
        let renderer = try JSONSerialization.jsonObject(with: Data(contentsOf: report)) as! [String: String]
        precondition(renderer["kind"] == "renderer")
        precondition(app.isSupportMailto(URL(string:"mailto:alexanderhosier@squidproductions.org?subject=Crash&body=What%20happened%3A%20test")!))
        precondition(!app.isSupportMailto(URL(string:"mailto:someone@example.org?body=test")!))
        precondition(!app.isSupportMailto(URL(string:"mailto:alexanderhosier@squidproductions.org?bcc=someone@example.org")!))
        print("Preview folder isolation verified (stable, beta, preview, precedence, safe identifier). Mac support verified: interrupted session recovery, clean exit/startup, renderer diagnostics, recipient and draft-query validation.")
    }
}
