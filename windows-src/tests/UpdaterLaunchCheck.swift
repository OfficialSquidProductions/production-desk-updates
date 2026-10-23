import AppKit
import Sparkle

// The real Sparkle parser/scheduler and Production Desk delegate run against
// loopback fixtures. This driver always chooses Later and forbids downloading.
final class RecordingUpdateDriver: NSObject, SPUUserDriver {
    var found: [SUAppcastItem] = []
    var errors: [String] = []
    var manualChecks = 0
    var cancelNextCheck = false
    func show(_ request: SPUUpdatePermissionRequest, reply: @escaping (SUUpdatePermissionResponse) -> Void) { preconditionFailure("Unexpected permissions prompt") }
    func showUserInitiatedUpdateCheck(cancellation: @escaping () -> Void) {
        manualChecks += 1
        if cancelNextCheck { cancelNextCheck = false; cancellation() }
    }
    func showUpdateFound(with item: SUAppcastItem, state: SPUUserUpdateState, reply: @escaping (SPUUserUpdateChoice) -> Void) { found.append(item); reply(.dismiss) }
    func showUpdateReleaseNotes(with downloadData: SPUDownloadData) {}
    func showUpdateReleaseNotesFailedToDownloadWithError(_ error: Error) { errors.append(error.localizedDescription) }
    func showUpdateNotFoundWithError(_ error: Error, acknowledgement: @escaping () -> Void) { errors.append(error.localizedDescription); acknowledgement() }
    func showUpdaterError(_ error: Error, acknowledgement: @escaping () -> Void) { errors.append(error.localizedDescription); acknowledgement() }
    func showDownloadInitiated(cancellation: @escaping () -> Void) { preconditionFailure("A fixture must never download an update") }
    func showDownloadDidReceiveExpectedContentLength(_ expectedContentLength: UInt64) { preconditionFailure("Unexpected download") }
    func showDownloadDidReceiveData(ofLength length: UInt64) { preconditionFailure("Unexpected download") }
    func showDownloadDidStartExtractingUpdate() { preconditionFailure("Unexpected extraction") }
    func showExtractionReceivedProgress(_ progress: Double) { preconditionFailure("Unexpected extraction") }
    func showReady(toInstallAndRelaunch reply: @escaping (SPUUserUpdateChoice) -> Void) { preconditionFailure("Unexpected installation") }
    func showInstallingUpdate(withApplicationTerminated applicationTerminated: Bool, retryTerminatingApplication: @escaping () -> Void) { preconditionFailure("Unexpected installation") }
    func showUpdateInstalledAndRelaunched(_ relaunched: Bool, acknowledgement: @escaping () -> Void) { preconditionFailure("Unexpected installation") }
    func dismissUpdateInstallation() {}
}

@main struct UpdaterLaunchCheck {
    static func waitForCheck(_ updates: ProductionDeskUpdates) {
        let deadline = Date().addingTimeInterval(12)
        while updates.updateEngine.sessionInProgress && Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.02))
        }
        precondition(!updates.updateEngine.sessionInProgress, "Update check did not finish")
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
    }

    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let mode = CommandLine.arguments.dropFirst().first ?? "newer"
        precondition(["equal", "older", "newer", "incompatible", "offline", "malformed", "opt-out", "startup-retry", "manual-retry", "manual-before-ready", "cancel-retry"].contains(mode), "Only noninteractive fixtures are supported")
        let driver = RecordingUpdateDriver()
        var starts = 0
        var reenter: (() -> Void)?
        let updates = ProductionDeskUpdates(userDriver: driver, startUpdater: { updater in
            starts += 1
            reenter?()
            if starts == 1 && ["startup-retry", "manual-retry"].contains(mode) {
                throw NSError(domain: "ReadinessFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Synthetic initialization failure"])
            }
            try updater.start()
        })
        let menu = NSMenu(); updates.addMenuItems(to: menu)
        let check = menu.items[0]
        let click = { updates.perform(check.action, with: check); () }
        reenter = {
            precondition(!updates.validateMenuItem(check), "Initialization must disable concurrent checks")
            click()
            precondition(!updates.start(), "Reentrant startup must not initialize twice")
        }
        // Simulate an old opt-in. The bundle policy still requires an Install choice.
        UserDefaults.standard.set(true, forKey: "SUAutomaticallyUpdate")
        precondition(!updates.updateEngine.allowsAutomaticUpdates && !updates.updateEngine.automaticallyDownloadsUpdates)
        if mode == "opt-out" { updates.updateEngine.automaticallyChecksForUpdates = false }
        if mode == "startup-retry" {
            precondition(!updates.start())
            precondition(updates.validateMenuItem(check), "Failed startup must leave manual retry available")
        }
        if ["manual-retry", "manual-before-ready", "cancel-retry"].contains(mode) {
            precondition(updates.validateMenuItem(check), "Manual check must be available before editor readiness")
            if mode == "manual-retry" {
                click()
                precondition(starts == 1 && driver.errors.count == 1)
                precondition(updates.validateMenuItem(check), "Manual startup failure must allow retry")
                driver.errors.removeAll()
            }
            if mode == "cancel-retry" { driver.cancelNextCheck = true }
            click()
            if mode != "cancel-retry" {
                precondition(!updates.validateMenuItem(check))
                for _ in 0..<20 { click(); updates.start() }
            }
            waitForCheck(updates)
            precondition(updates.validateMenuItem(check), "Completed/cancelled check must enable retry")
            if mode == "cancel-retry" { click(); waitForCheck(updates) }
            updates.start(); updates.start(); waitForCheck(updates)
            precondition(driver.found.count == 1 && driver.manualChecks == (mode == "cancel-retry" ? 2 : 1))
            precondition(starts == (mode == "manual-retry" ? 2 : 1))
            precondition(driver.errors.isEmpty, "Unexpected manual errors: \(driver.errors)")
            print("PASS \(mode): manual initialization/retry, reentrant startup, repeated clicks, cancellation recovery and one update session; no installation")
            return
        }
        updates.start(); updates.start()
        precondition(driver.found.isEmpty, "Startup must not wait for the feed/UI")
        waitForCheck(updates)
        if mode == "newer" || mode == "startup-retry" {
            precondition(driver.found.count == 1, "Expected exactly one compatible newer update, got \(driver.found.count)")
            precondition(driver.found[0].versionString == "24")
            precondition(driver.found[0].itemDescription?.contains("Launch update notice") == true)
            updates.updateEngine.checkForUpdatesInBackground(); waitForCheck(updates)
            precondition(driver.found.count == 1, "Later must suppress repeated scheduled offers in this launch")
            updates.perform(menu.items[0].action, with: menu.items[0]); waitForCheck(updates)
            precondition(driver.found.count == 2 && driver.manualChecks == 1, "Explicit menu check must reopen a dismissed offer")
        } else { precondition(driver.found.isEmpty, "No update should be offered for \(mode)") }
        precondition(driver.errors.isEmpty, "Background failures/no-update must be quiet: \(driver.errors)")
        precondition(starts == (mode == "startup-retry" ? 2 : 1), "Initialization must run once except after a failure")
        if let identifier = Bundle.main.bundleIdentifier { UserDefaults.standard.removePersistentDomain(forName: identifier) }
        print("PASS \(mode): real Sparkle launch, compatible selection, quiet failure and Later policy; no download or installation")
    }
}
