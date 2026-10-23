import AppKit
import Sparkle

// Sparkle owns download verification, replacement and relaunch. Workspace
// writes stay in the app's existing save/termination path.
final class ProductionDeskUpdates: NSObject, SPUUpdaterDelegate, NSMenuItemValidation {
    private var driver: SPUUserDriver!
    private(set) var updateEngine: SPUUpdater!
    private var pendingInstall: (() -> Void)?
    private var saving = false
    private var installing = false
    private var started = false
    private var starting = false
    private var launchCheckRequested = false
    private let startUpdater: (SPUUpdater) throws -> Void
    private var offeredBuilds = Set<String>()
    var saveWorkspace: ((@escaping (Bool) -> Void) -> Void)?
    weak var window: NSWindow?

    init(userDriver: SPUUserDriver? = nil, startUpdater: @escaping (SPUUpdater) throws -> Void = { try $0.start() }) {
        self.startUpdater = startUpdater
        super.init()
        driver = userDriver ?? SPUStandardUserDriver(hostBundle: .main, delegate: nil)
        updateEngine = SPUUpdater(hostBundle: .main, applicationBundle: .main, userDriver: driver, delegate: self)
    }

    @discardableResult
    private func prepare(reportError: Bool = false) -> Bool {
        if started { return true }
        guard !starting else { return false }
        starting = true
        defer { starting = false }
        do {
            try startUpdater(updateEngine)
            started = true
            return true
        } catch {
            NSLog("Production Desk update checking could not start: %@", error.localizedDescription)
            if reportError { driver.showUpdaterError(error, acknowledgement: {}) }
            return false
        }
    }

    @discardableResult
    func start() -> Bool {
        guard prepare() else { return false }
        guard !launchCheckRequested else { return true }
        launchCheckRequested = true
        // Start once after editor readiness; a manual check can consume this
        // launch check first. Sparkle owns session scheduling and cancellation.
        if updateEngine.automaticallyChecksForUpdates && !updateEngine.sessionInProgress {
            updateEngine.checkForUpdatesInBackground()
        }
        return true
    }

    func addMenuItems(to menu: NSMenu) {
        let check = menu.addItem(withTitle: "Check for Updates…", action: #selector(checkForUpdates), keyEquivalent: "")
        check.target = self
        let settings = NSMenu(title: "Updates")
        let checks = settings.addItem(withTitle: "Automatically Check for Updates", action: #selector(toggleChecks), keyEquivalent: "")
        checks.target = self
        let item = NSMenuItem(title: "Updates", action: nil, keyEquivalent: "")
        item.submenu = settings
        menu.addItem(item)
    }

    @objc private func checkForUpdates(_ sender: Any?) {
        guard !saving, !installing, !starting else { return }
        if pendingInstall != nil { finishInstallation() }
        else if prepare(reportError: true), updateEngine.canCheckForUpdates, !updateEngine.sessionInProgress {
            launchCheckRequested = true
            updateEngine.checkForUpdates()
        }
    }
    @objc private func toggleChecks(_ sender: Any?) {
        updateEngine.automaticallyChecksForUpdates.toggle()
    }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        if item.action == #selector(checkForUpdates) {
            item.title = pendingInstall == nil ? "Check for Updates…" : "Continue Installing Update…"
            return !saving && !installing && !starting && (pendingInstall != nil || !started || (updateEngine.canCheckForUpdates && !updateEngine.sessionInProgress))
        }
        if item.action == #selector(toggleChecks) {
            item.state = updateEngine.automaticallyChecksForUpdates ? .on : .off
            return true
        }
        return true
    }

    func updater(_ updater: SPUUpdater, shouldProceedWithUpdate item: SUAppcastItem, updateCheck: SPUUpdateCheck) throws {
        // A later scheduled check must not repeat a dismissed launch notice.
        // A deliberate menu check can still bring that update back.
        if updateCheck == .updatesInBackground && !offeredBuilds.insert(item.versionString).inserted {
            throw NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError,
                          userInfo: [NSLocalizedDescriptionKey: "This update was already offered during this launch."])
        }
    }

    func updater(_ updater: SPUUpdater, shouldPostponeRelaunchForUpdate item: SUAppcastItem, untilInvokingBlock installHandler: @escaping () -> Void) -> Bool {
        guard pendingInstall == nil, !installing else { return true }
        pendingInstall = installHandler
        // Return to Sparkle before asynchronously invoking its continuation.
        DispatchQueue.main.async { [weak self] in self?.finishInstallation() }
        return true
    }

    private func finishInstallation() {
        guard pendingInstall != nil, !saving, !installing, let saveWorkspace = saveWorkspace else { return }
        saving = true
        saveWorkspace { [weak self] saved in
            guard let self = self, self.saving else { return }
            self.saving = false
            if saved {
                self.installing = true
                let install = self.pendingInstall
                self.pendingInstall = nil
                install?()
            } else if let window = self.window {
                let alert = NSAlert()
                alert.messageText = "Save your changes before installing the update"
                alert.informativeText = "Finish or cancel any open editor dialog. Retry saving or export a backup, then choose Production Desk → Continue Installing Update…."
                alert.addButton(withTitle: "Keep Working")
                alert.beginSheetModal(for: window, completionHandler: nil)
            }
        }
    }
}
