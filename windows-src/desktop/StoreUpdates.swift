import AppKit

// This file replaces Updates.swift only in the Mac App Store build.
// TestFlight and the App Store own distribution; no Sparkle code is linked.
final class ProductionDeskUpdates {
    weak var window: NSWindow?
    var saveWorkspace: ((@escaping (Bool) -> Void) -> Void)?
    func start() {}
    func addMenuItems(to menu: NSMenu) {
        let item = NSMenuItem(title: "Updates managed by TestFlight or the App Store", action: nil, keyEquivalent: "")
        item.isEnabled = false
        menu.addItem(item)
    }
}
