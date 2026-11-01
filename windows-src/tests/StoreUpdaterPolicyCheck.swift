import AppKit

// Compile with the actual App Store sources, never the Sparkle implementation.
@main struct StoreUpdaterPolicyCheck {
    static func main() {
        precondition(Bundle.main.bundleIdentifier?.hasPrefix("local.productiondesk.store-updater-qa.") == true)
        let home = URL(fileURLWithPath: CommandLine.arguments[1]).resolvingSymlinksInPath()
        precondition(FileManager.default.homeDirectoryForCurrentUser.resolvingSymlinksInPath() == home)
        _ = NSApplication.shared
        let subject = ProductionDeskApp()
        subject.observeEditorReadiness()
        subject.observeEditorReadiness()
        subject.updates.start()
        let menu = NSMenu()
        subject.updates.addMenuItems(to: menu)
        precondition(menu.items.count == 1)
        precondition(!menu.items[0].isEnabled && menu.items[0].action == nil)
        precondition(menu.items[0].title == "Updates managed by TestFlight or the App Store")
        subject.localOrigin = URL(string: "http://127.0.0.1:54321")
        for text in ["itms-services://?action=download-manifest&url=https://example.com/install.plist",
                     "itms-services://example.com/install.plist", "https://example.com/app.pkg",
                     "file:///tmp/installer.app", "javascript:alert(1)", "http://127.0.0.1:54322/",
                     "http://localhost:54321/", "mailto:other@example.com"] {
            for clicked in [false, true] {
                precondition(subject.editorNavigationDestination(URL(string:text), linkActivated:clicked,
                    mainFrame:true, download:false) == .cancel, text)
            }
        }
        precondition(subject.editorNavigationDestination(URL(string:"http://127.0.0.1:54321/"), linkActivated:false, mainFrame:true, download:false) == .allow)
        precondition(subject.editorNavigationDestination(URL(string:"http://127.0.0.1:54321/api/download/token"), linkActivated:true, mainFrame:true, download:false) == .download)
        let mail = URL(string:"mailto:alexanderhosier@squidproductions.org?subject=Support")!
        precondition(subject.editorNavigationDestination(mail, linkActivated:true, mainFrame:true, download:false) == .supportEmail)
        precondition(subject.editorNavigationDestination(mail, linkActivated:false, mainFrame:true, download:false) == .cancel)
        precondition(subject.editorNavigationDestination(mail, linkActivated:true, mainFrame:false, download:false) == .cancel)
        subject.stopEditorReadinessObservation()
        print("PASS App Store: disabled Apple-managed updater; installer/external URL navigation cancelled; loopback exports and explicit support mail allowed")
    }
}
