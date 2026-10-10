import AppKit
import Sparkle

// Sparkle owns download verification, replacement and relaunch. Workspace
// writes stay in the app's existing save/termination path.
final class ProductionDeskUpdates: NSObject, SPUUpdaterDelegate, NSMenuItemValidation {
    private var controller: SPUStandardUpdaterController!
    private var pendingInstall: (() -> Void)?
    private var saving = false
    var saveWorkspace: ((@escaping (Bool) -> Void) -> Void)?
    weak var window: NSWindow?

    override init() {
        super.init()
        controller = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)
    }

    func start() { controller.startUpdater() }

    func addMenuItems(to menu: NSMenu) {
        let check = menu.addItem(withTitle: "Check for Updates…", action: #selector(checkForUpdates), keyEquivalent: "")
        check.target = self
        let settings = NSMenu(title: "Updates")
        let checks = settings.addItem(withTitle: "Automatically Check for Updates", action: #selector(toggleChecks), keyEquivalent: "")
        checks.target = self
        let downloads = settings.addItem(withTitle: "Automatically Download and Install Updates", action: #selector(toggleDownloads), keyEquivalent: "")
        downloads.target = self
        let item = NSMenuItem(title: "Updates", action: nil, keyEquivalent: "")
        item.submenu = settings
        menu.addItem(item)
    }

    @objc private func checkForUpdates(_ sender: Any?) {
        if pendingInstall != nil { finishInstallation() }
        else { controller.checkForUpdates(sender) }
    }
    @objc private func toggleChecks(_ sender: Any?) {
        controller.updater.automaticallyChecksForUpdates.toggle()
    }
    @objc private func toggleDownloads(_ sender: Any?) {
        controller.updater.automaticallyDownloadsUpdates.toggle()
    }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        if item.action == #selector(checkForUpdates) {
            item.title = pendingInstall == nil ? "Check for Updates…" : "Continue Installing Update…"
            return !saving && (pendingInstall != nil || controller.updater.canCheckForUpdates)
        }
        if item.action == #selector(toggleChecks) {
            item.state = controller.updater.automaticallyChecksForUpdates ? .on : .off
            return true
        }
        if item.action == #selector(toggleDownloads) {
            item.state = controller.updater.automaticallyDownloadsUpdates ? .on : .off
            return controller.updater.automaticallyChecksForUpdates && controller.updater.allowsAutomaticUpdates
        }
        return true
    }

    func updater(_ updater: SPUUpdater, shouldPostponeRelaunchForUpdate item: SUAppcastItem, untilInvokingBlock installHandler: @escaping () -> Void) -> Bool {
        pendingInstall = installHandler
        // Return to Sparkle before asynchronously invoking its continuation.
        DispatchQueue.main.async { [weak self] in self?.finishInstallation() }
        return true
    }

    private func finishInstallation() {
        guard pendingInstall != nil, !saving, let saveWorkspace = saveWorkspace else { return }
        saving = true
        saveWorkspace { [weak self] saved in
            guard let self = self else { return }
            self.saving = false
            if saved {
                let install = self.pendingInstall
                self.pendingInstall = nil
                install?()
            } else if let window = self.window {
                let alert = NSAlert()
                alert.messageText = "Save your changes before installing the update"
                alert.informativeText = "Your latest changes could not be saved. Keep working to retry saving or export a backup, then choose Production Desk → Continue Installing Update…."
                alert.addButton(withTitle: "Keep Working")
                alert.beginSheetModal(for: window, completionHandler: nil)
            }
        }
    }
}
