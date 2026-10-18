import AppKit
import Sparkle

// The real Sparkle parser/scheduler and Production Desk delegate run against
// loopback fixtures. This driver always chooses Later and forbids downloading.
final class RecordingUpdateDriver: NSObject, SPUUserDriver {
    var found: [SUAppcastItem] = []
    var errors: [String] = []
    var manualChecks = 0
    func show(_ request: SPUUpdatePermissionRequest, reply: @escaping (SUUpdatePermissionResponse) -> Void) { preconditionFailure("Unexpected permissions prompt") }
    func showUserInitiatedUpdateCheck(cancellation: @escaping () -> Void) { manualChecks += 1 }
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
        precondition(["equal", "older", "newer", "incompatible", "offline", "malformed", "opt-out"].contains(mode), "Only noninteractive fixtures are supported")
        let driver = RecordingUpdateDriver()
        let updates = ProductionDeskUpdates(userDriver: driver)
        // Simulate an old opt-in. The bundle policy still requires an Install choice.
        UserDefaults.standard.set(true, forKey: "SUAutomaticallyUpdate")
        precondition(!updates.updateEngine.allowsAutomaticUpdates && !updates.updateEngine.automaticallyDownloadsUpdates)
        if mode == "opt-out" { updates.updateEngine.automaticallyChecksForUpdates = false }
        updates.start(); updates.start()
        precondition(driver.found.isEmpty, "Startup must not wait for the feed/UI")
        waitForCheck(updates)
        if mode == "newer" {
            precondition(driver.found.count == 1, "Expected exactly one compatible newer update, got \(driver.found.count)")
            precondition(driver.found[0].versionString == "24")
            precondition(driver.found[0].itemDescription?.contains("Launch update notice") == true)
            updates.updateEngine.checkForUpdatesInBackground(); waitForCheck(updates)
            precondition(driver.found.count == 1, "Later must suppress repeated scheduled offers in this launch")
            let menu = NSMenu(); updates.addMenuItems(to: menu)
            updates.perform(menu.items[0].action, with: menu.items[0]); waitForCheck(updates)
            precondition(driver.found.count == 2 && driver.manualChecks == 1, "Explicit menu check must reopen a dismissed offer")
        } else { precondition(driver.found.isEmpty, "No update should be offered for \(mode)") }
        precondition(driver.errors.isEmpty, "Background failures/no-update must be quiet: \(driver.errors)")
        if let identifier = Bundle.main.bundleIdentifier { UserDefaults.standard.removePersistentDomain(forName: identifier) }
        print("PASS \(mode): real Sparkle launch, compatible selection, quiet failure and Later policy; no download or installation")
    }
}
