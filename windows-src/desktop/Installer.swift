import AppKit

enum InstallError: LocalizedError {
    case invalidPackage, unrelatedDestination, linkedDestination
    var errorDescription: String? {
        switch self {
        case .invalidPackage: return "The bundled Production Desk app is missing or damaged. Unzip the complete share folder and try again."
        case .unrelatedDestination: return "An unrelated app already uses this destination. Rename it before installing Production Desk."
        case .linkedDestination: return "The installation destination is a symbolic link. Choose a regular Applications folder."
        }
    }
}

// Copy to a staging directory before replacing an existing installation. Never touch project data.
func installApplication(from source: URL, in directory: URL) throws -> URL {
    let fm = FileManager.default
    let destination = directory.appendingPathComponent("Production Desk.app", isDirectory: true)
    func isProductionDesk(_ url: URL) -> Bool {
        guard let data = try? Data(contentsOf: url.appendingPathComponent("Contents/Info.plist")),
              let info = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else { return false }
        return info["CFBundleIdentifier"] as? String == "local.slate.filmscheduler"
            && info["CFBundleExecutable"] as? String == "ProductionDesk"
            && fm.isExecutableFile(atPath: url.appendingPathComponent("Contents/MacOS/ProductionDesk").path)
    }
    guard isProductionDesk(source) else { throw InstallError.invalidPackage }
    let directoryValues = try? directory.resourceValues(forKeys: [.isSymbolicLinkKey])
    let destinationValues = try? destination.resourceValues(forKeys: [.isSymbolicLinkKey])
    guard directoryValues?.isSymbolicLink != true, destinationValues?.isSymbolicLink != true else { throw InstallError.linkedDestination }
    let existing = fm.fileExists(atPath: destination.path)
    if existing && !isProductionDesk(destination) { throw InstallError.unrelatedDestination }
    try fm.createDirectory(at: directory, withIntermediateDirectories: true)
    let staging = directory.appendingPathComponent(".ProductionDesk-install-\(UUID().uuidString).app")
    let previous = directory.appendingPathComponent(".ProductionDesk-previous-\(UUID().uuidString).app")
    defer { try? fm.removeItem(at: staging) }
    try fm.copyItem(at: source, to: staging)
    if existing { try fm.moveItem(at: destination, to: previous) }
    do { try fm.moveItem(at: staging, to: destination) }
    catch {
        if existing { try? fm.moveItem(at: previous, to: destination) }
        throw error
    }
    if existing { try? fm.removeItem(at: previous) }
    return destination
}

func verifyInstallEngine(at root: URL, bundledApp: URL? = nil) throws {
    let fm = FileManager.default
    try fm.createDirectory(at: root, withIntermediateDirectories: true)
    let source = root.appendingPathComponent("Fixture.app")
    let contents = source.appendingPathComponent("Contents")
    try fm.createDirectory(at: contents.appendingPathComponent("MacOS"), withIntermediateDirectories: true)
    let info = ["CFBundleIdentifier": "local.slate.filmscheduler", "CFBundleExecutable": "ProductionDesk"]
    try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0).write(to: contents.appendingPathComponent("Info.plist"))
    let executable = contents.appendingPathComponent("MacOS/ProductionDesk")
    try Data("fixture".utf8).write(to: executable)
    try fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: executable.path)
    let projects = root.appendingPathComponent("workspace.json")
    let original = Data("Existing projects must be preserved".utf8)
    try original.write(to: projects)
    let applications = root.appendingPathComponent("Applications")
    let installed = try installApplication(from: source, in: applications)
    func require(_ condition: Bool, _ message: String) throws {
        if !condition { throw NSError(domain: "ProductionDeskInstallerTests", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    }
    try require(fm.isExecutableFile(atPath: installed.appendingPathComponent("Contents/MacOS/ProductionDesk").path), "Executable was not installed")
    try Data("new version".utf8).write(to: contents.appendingPathComponent("version.txt"))
    _ = try installApplication(from: source, in: applications)
    let version = try Data(contentsOf: installed.appendingPathComponent("Contents/version.txt"))
    try require(version == Data("new version".utf8), "Update did not replace the app")
    let saved = try Data(contentsOf: projects)
    try require(saved == original, "Update changed project data")
    let unrelated = root.appendingPathComponent("Unrelated")
    try fm.createDirectory(at: unrelated.appendingPathComponent("Production Desk.app"), withIntermediateDirectories: true)
    do { _ = try installApplication(from: source, in: unrelated); fatalError("An unrelated destination was replaced") }
    catch InstallError.unrelatedDestination { }
    let linked = root.appendingPathComponent("Linked")
    try fm.createSymbolicLink(at: linked, withDestinationURL: applications)
    do { _ = try installApplication(from: source, in: linked); fatalError("A linked destination was accepted") }
    catch InstallError.linkedDestination { }
    do { _ = try installApplication(from: root.appendingPathComponent("Missing.app"), in: applications); fatalError("An invalid package was accepted") }
    catch InstallError.invalidPackage { }
    let finalData = try Data(contentsOf: projects)
    try require(finalData == original, "Rejected installs changed project data")
    if let bundledApp = bundledApp {
        let actual = try installApplication(from: bundledApp, in: root.appendingPathComponent("Bundled Applications"))
        let runtime = actual.appendingPathComponent("Contents/Resources/runtime")
        let check = Process()
        check.executableURL = actual.appendingPathComponent("Contents/Frameworks/Python3.framework/Versions/3.9/bin/python3.9")
        check.arguments = ["-E", "-s", "-B", runtime.appendingPathComponent("server.py").path, "--help"]
        check.standardOutput = FileHandle.nullDevice
        try check.run(); check.waitUntilExit()
        try require(check.terminationStatus == 0, "The installed runtime could not start")
        try require(fm.isExecutableFile(atPath: runtime.appendingPathComponent("tools/extract_pdf").path), "The installed PDF importer is missing")
        print("Installed bundled app verified: Python runtime, server, and PDF importer.")
    }
    print("Installer verified: fresh install, update, project preservation, unrelated app protection, symlink protection, invalid package rejection.")
}

final class ProductionDeskInstaller: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var status: NSTextField!
    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let item = NSMenuItem()
        menu.addItem(item)
        let appMenu = NSMenu(title: "Install Production Desk")
        appMenu.addItem(withTitle: "Quit Installer", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        item.submenu = appMenu
        NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 500, height: 245), styleMask: [.titled], backing: .buffered, defer: false)
        window.title = "Install Production Desk"
        window.backgroundColor = .white
        let title = NSTextField(labelWithString: "Production Desk")
        title.font = NSFont(name: "Futura-Medium", size: 28) ?? .systemFont(ofSize: 28, weight: .bold)
        title.textColor = NSColor(srgbRed: 0.902, green: 0, blue: 0.149, alpha: 1)
        title.frame = NSRect(x: 32, y: 170, width: 436, height: 40)
        window.contentView?.addSubview(title)
        status = NSTextField(wrappingLabelWithString: "Installing into your Applications folder…\nYour existing projects stay on this computer.")
        status.textColor = .black
        status.font = .systemFont(ofSize: 15)
        status.frame = NSRect(x: 32, y: 68, width: 436, height: 80)
        window.contentView?.addSubview(status)
        window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.main.async { self.beginInstall() }
    }
    func beginInstall() {
        guard NSRunningApplication.runningApplications(withBundleIdentifier: "local.slate.filmscheduler").isEmpty else {
            fail("Production Desk is open", detail: "Save your work, quit Production Desk, then open this installer again. Your installed app has not been changed.")
            return
        }
        let source = Bundle.main.resourceURL!.appendingPathComponent("Production Desk.app")
        let directory = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Applications", isDirectory: true)
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let installed = try installApplication(from: source, in: directory)
                DispatchQueue.main.async {
                    self.status.stringValue = "Installed. Opening Production Desk…"
                    let configuration = NSWorkspace.OpenConfiguration()
                    configuration.activates = true
                    NSWorkspace.shared.openApplication(at: installed, configuration: configuration) { _, error in
                        DispatchQueue.main.async {
                            if let error = error { self.fail("Installed, but could not open", detail: "Open \(installed.path) from Finder.\n\n\(error.localizedDescription)") }
                            else { NSApp.terminate(nil) }
                        }
                    }
                }
            } catch { DispatchQueue.main.async { self.fail("Could not install Production Desk", detail: error.localizedDescription) } }
        }
    }
    func fail(_ title: String, detail: String) {
        status.stringValue = title
        let alert = NSAlert(); alert.messageText = title; alert.informativeText = detail
        alert.addButton(withTitle: "Close")
        alert.beginSheetModal(for: window) { _ in NSApp.terminate(nil) }
    }
}

if (3...4).contains(CommandLine.arguments.count) && CommandLine.arguments[1] == "--self-test" {
    let bundledApp = CommandLine.arguments.count == 4 ? URL(fileURLWithPath: CommandLine.arguments[3]) : nil
    do { try verifyInstallEngine(at: URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true), bundledApp: bundledApp); exit(0) }
    catch { fputs("Installer verification failed: \(error)\n", stderr); exit(1) }
}
let installerApp = NSApplication.shared
let installerDelegate = ProductionDeskInstaller()
installerApp.setActivationPolicy(.regular)
installerApp.delegate = installerDelegate
installerApp.run()
