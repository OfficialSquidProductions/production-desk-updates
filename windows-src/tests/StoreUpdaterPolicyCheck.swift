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
        subject.stopEditorReadinessObservation()
        print("PASS App Store: distribution-managed update menu remains disabled; no Sparkle implementation")
    }
}
