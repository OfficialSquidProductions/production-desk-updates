import AppKit
import Sparkle

// Exercise the real Sparkle delegate's asynchronous save gate without replacing
// an application or touching a workspace. Run with tools/check_macos_updates.py.
@main
struct UpdaterSaveCheck {
    static func main() {
        let updates = ProductionDeskUpdates()
        let fixture = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: nil, userDriverDelegate: nil)
        var saved = false
        var calls = 0
        var installed = 0
        var finishSave: ((Bool) -> Void)?
        updates.saveWorkspace = { completion in calls += 1; finishSave = completion }
        let delayed = updates.updater(fixture.updater, shouldPostponeRelaunchForUpdate: SUAppcastItem.empty(), untilInvokingBlock: { installed += 1 })
        precondition(delayed && calls == 0 && installed == 0, "Installation must wait asynchronously")
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        precondition(calls == 1 && installed == 0, "Installation must wait for a save result")
        finishSave?(false)
        precondition(installed == 0, "A failed save must block installation")
        let menu = NSMenu()
        updates.addMenuItems(to: menu)
        let check = menu.items[0]
        precondition(updates.validateMenuItem(check) && check.title == "Continue Installing Update…")
        updates.perform(check.action, with: check)
        precondition(calls == 2 && installed == 0, "Retry must still wait for the save")
        // A second click while saving must not start a concurrent save/install.
        updates.perform(check.action, with: check)
        precondition(calls == 2)
        saved = true
        finishSave?(saved)
        precondition(installed == 1, "A successful save must resume installation once")
        _ = updates.validateMenuItem(check)
        precondition(check.title == "Check for Updates…", "Retry state must be cleared")
        print("Updater verified: asynchronous save, failed-save protection, retry, concurrent-click protection, one-time install continuation.")
    }
}
