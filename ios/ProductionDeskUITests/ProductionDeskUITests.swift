import XCTest
import UIKit

final class ProductionDeskUITests: XCTestCase {
    @MainActor func testTouchNavigationOrderingAndColdLaunch() throws {
        let app=XCUIApplication();XCUIDevice.shared.orientation = .portrait;app.launch()
        let web=app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout:15))
        func reveal(_ button: XCUIElement) {
            for _ in 0..<5 {if button.isHittable {break};web.swipeUp()}
            XCTAssertTrue(button.isHittable,app.debugDescription)
        }
        func restoreDefault() {
            let reset=web.buttons["Restore default order"]
            XCTAssertTrue(reset.waitForExistence(timeout:5))
            if reset.isEnabled {
                reveal(reset);reset.tap()
                XCTAssertTrue(web.staticTexts["Default tab order restored."].waitForExistence(timeout:5))
            }
        }
        func linedIsFirst() {
            let lined=web.buttons.matching(NSPredicate(format:"label ENDSWITH %@","Lined script")).firstMatch
            let main=web.buttons.matching(NSPredicate(format:"label ENDSWITH %@","Main breakdown")).firstMatch
            XCTAssertTrue(lined.waitForExistence(timeout:10)&&main.exists)
            XCTAssertTrue(lined.frame.minY<main.frame.minY || (abs(lined.frame.minY-main.frame.minY)<2 && lined.frame.minX<main.frame.minX),app.debugDescription)
        }
        web.buttons["Settings"].tap();restoreDefault()
        let up=web.buttons["Move Lined script up"];reveal(up)
        XCTAssertGreaterThanOrEqual(up.frame.width,44);XCTAssertGreaterThanOrEqual(up.frame.height,44)
        up.tap()
        XCTAssertTrue(web.staticTexts["Lined script is now tab 1 of 6. Tab order saved."].waitForExistence(timeout:5))
        let controls=XCTAttachment(screenshot:app.screenshot());controls.name="Touch navigation order controls";controls.lifetime = .keepAlways;add(controls)
        web.buttons["Close dialog"].tap();linedIsFirst()
        app.terminate();app.launch();linedIsFirst()
        web.buttons["Settings"].tap();restoreDefault();web.buttons["Close dialog"].tap()
        let defaults=XCTAttachment(screenshot:app.screenshot());defaults.name="Default navigation restored after cold launch";defaults.lifetime = .keepAlways;add(defaults)
    }

    @MainActor private func importSyntheticScript(_ web: XCUIElement, app: XCUIApplication) {
        XCTAssertFalse(web.buttons["Load The Last Light demo"].exists)
        XCTAssertFalse(web.buttons["Demo guide"].exists)
        let button=web.buttons["Import…"];XCTAssertTrue(button.waitForExistence(timeout:10));button.tap()
        let paste=web.textViews.firstMatch;XCTAssertTrue(paste.waitForExistence(timeout:5));paste.tap()
        paste.typeText("1 INT. TEST ROOM - DAY\n\nMAYA\nSynthetic test.\n\n2 EXT. TEST ROAD - NIGHT\n\nA second scene.\n\n3 INT. TEST HALL - DAY\n\nA third scene.\n\n4 EXT. TEST PARK - DAY\n\nA fourth scene.")
        let done=app.toolbars.buttons["Done"].firstMatch
        if done.exists && done.isHittable {done.tap()}
        let hide=app.keyboards.buttons.matching(NSPredicate(format:"label CONTAINS[c] %@","hide")).firstMatch
        if hide.exists && hide.isHittable {hide.tap()}
        web.buttons["Import locally"].tap()
        let closed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:web.buttons["Close dialog"])
        XCTAssertEqual(XCTWaiter.wait(for:[closed],timeout:10),.completed)
    }

    @MainActor private func revealSaveAs(_ web: XCUIElement) {
        let save = web.buttons["Save As…"]
        XCTAssertTrue(save.waitForExistence(timeout: 10))
        if !save.isHittable { web.swipeUp() }
        XCTAssertTrue(save.isHittable)
    }

    @MainActor func testTouchScheduleDragWithoutShippingDemo() throws {
        let app=XCUIApplication();XCUIDevice.shared.orientation = .portrait;app.launch()
        let web=app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout:15))
        importSyntheticScript(web, app:app)
        web.buttons["Shooting schedule"].tap()
        let source=web.buttons["Move scene 3"].firstMatch
        let target=web.buttons["Move scene 4"].firstMatch
        XCTAssertTrue(source.waitForExistence(timeout:10))
        for _ in 0..<6 {if source.isHittable && target.isHittable {break};web.swipeUp()}
        XCTAssertTrue(source.isHittable && target.isHittable)
        source.press(forDuration:1.2,thenDragTo:target)
        XCTAssertTrue(web.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","Strip moved.")).firstMatch.waitForExistence(timeout:8),app.debugDescription)
        let board=XCTAttachment(screenshot:app.screenshot());board.name="Touch drag between schedule strips";board.lifetime = .keepAlways;add(board)

    }

    @MainActor func testPopulatedMobileViewsAndKeyboard() throws {
        let app = XCUIApplication(); app.launch()
        let web = app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout:15))
        let tools = web.buttons["Production tools"]
        if tools.exists && tools.isHittable { tools.tap() }
        let importButton = web.buttons.matching(NSPredicate(format:"label CONTAINS %@", "Import…")).firstMatch
        XCTAssertTrue(importButton.waitForExistence(timeout:10)); importButton.tap()
        let paste = web.textViews.firstMatch
        XCTAssertTrue(paste.waitForExistence(timeout:5)); paste.tap()
        paste.typeText("1 INT. LIGHTHOUSE - DAWN\n\nThe first light crosses the water.\n\nMAYA\nWe have one chance.\n\n2 EXT. HARBOUR - DAY\n\nA boat waits at the dock.")
        // On iPad the keyboard accessory can cover the dialog footer.
        // Dismiss it explicitly so the tap reaches the import action.
        let dismissKeyboard = {
            let done = app.toolbars.buttons["Done"].firstMatch
            if done.exists && done.isHittable {
                done.tap()
                let dismissed = XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"), object:app.keyboards.firstMatch)
                XCTAssertEqual(XCTWaiter.wait(for:[dismissed], timeout:5), .completed)
                return
            }
            let hideKeyboard = app.keyboards.buttons.matching(NSPredicate(format:"label CONTAINS[c] %@", "hide")).firstMatch
            if hideKeyboard.exists && hideKeyboard.isHittable {
                hideKeyboard.tap()
                let dismissed = XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"), object:app.keyboards.firstMatch)
                XCTAssertEqual(XCTWaiter.wait(for:[dismissed], timeout:5), .completed)
            }
        }
        dismissKeyboard()
        let submit = web.buttons["Import locally"]
        XCTAssertTrue(submit.exists && submit.isHittable); submit.tap()
        let imported = XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"), object:web.buttons["Close dialog"])
        XCTAssertEqual(XCTWaiter.wait(for:[imported], timeout:10), .completed)
        let breakdown = web.buttons["Main breakdown"]
        XCTAssertTrue(breakdown.waitForExistence(timeout:10))
        XCTAssertTrue(web.staticTexts.matching(NSPredicate(format:"label CONTAINS %@", "LIGHTHOUSE")).firstMatch.waitForExistence(timeout:10))
        for label in ["Main breakdown", "Shooting schedule", "Shot list"] {
            web.buttons[label].tap()
            if label == "Shot list" {
                web.buttons.matching(NSPredicate(format:"label CONTAINS %@", "New shot")).firstMatch.tap()
                let description = web.textViews.firstMatch
                XCTAssertTrue(description.waitForExistence(timeout:5))
                description.typeText("Maya watches the first light over the harbour")
                let keyboard = XCTAttachment(screenshot:app.screenshot())
                keyboard.name="Shot creation with keyboard"; keyboard.lifetime = .keepAlways; add(keyboard)
                dismissKeyboard()
                web.buttons["Add shot"].tap()
                let closed = XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:web.buttons["Close dialog"])
                if XCTWaiter.wait(for:[closed],timeout:2) != .completed { web.buttons["Add shot"].tap() }
                let saved = XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:web.buttons["Close dialog"])
                XCTAssertEqual(XCTWaiter.wait(for:[saved],timeout:5),.completed)
                XCTAssertTrue(web.staticTexts["Maya watches the first light over the harbour"].firstMatch.waitForExistence(timeout:10))
            }
            // Re-select after modal/keyboard dismissal so evidence starts at the top.
            web.buttons[label].tap()
            let shot = XCTAttachment(screenshot:app.screenshot())
            shot.name="Branded populated \(label)"; shot.lifetime = .keepAlways; add(shot)
        }
        web.buttons["Main breakdown"].tap()
        let search = web.buttons["Search script"]
        if search.exists && search.isHittable {
            search.tap()
            let field=web.textFields["Search scenes"]
            XCTAssertTrue(field.waitForExistence(timeout:5)); field.typeText("LIGHTHOUSE")
            XCTAssertTrue(web.buttons["Search script"].exists)
        }
    }
    @MainActor func testJSONAndPDFShareSheetsCanBeDismissedAndReopened() throws {
        let app = XCUIApplication()
        app.launch()
        let web = app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout: 15))
        let export = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Export")).firstMatch
        XCTAssertTrue(export.waitForExistence(timeout: 15))
        for option in ["Full Production Desk backup", "Print / Save as PDF", "Full Production Desk backup"] {
            export.tap()
            let choice = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", option)).firstMatch
            XCTAssertTrue(choice.waitForExistence(timeout: 5))
            choice.tap()
            let sheet = app.otherElements["ActivityListView"]
            XCTAssertTrue(sheet.waitForExistence(timeout: 10), app.debugDescription)
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = "Native share sheet — \(option)"
            screenshot.lifetime = .keepAlways
            add(screenshot)
            let close = app.buttons.matching(NSPredicate(format: "label == 'Close' OR label == 'Cancel'")).firstMatch
            if close.exists { close.tap() }
            else { app.otherElements["PopoverDismissRegion"].coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.1)).tap() }
            // Export modal remains open after file sharing, but PDF closes it.
            let modalClose = web.buttons["Close dialog"]
            if modalClose.exists { modalClose.tap() }
        }
    }

    @MainActor func testNavigationBackgroundAndRelaunch() throws {
        let app = XCUIApplication()
        app.launch()
        let web = app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout: 15))
        let breakdown = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Main breakdown")).firstMatch
        XCTAssertTrue(breakdown.waitForExistence(timeout: 15))
        let productionTitle = "Simulator \(UUID().uuidString.prefix(8))"
        let tools = web.buttons["Production tools"]
        if tools.exists && tools.isHittable { tools.tap() }
        web.buttons.matching(NSPredicate(format: "label CONTAINS %@", "New production")).firstMatch.tap()
        let titleField = web.textFields.firstMatch
        XCTAssertTrue(titleField.waitForExistence(timeout: 5))
        // The production dialog focuses and selects its default title.
        titleField.typeText(productionTitle + "\n")
        XCTAssertTrue(web.staticTexts[productionTitle].firstMatch.waitForExistence(timeout: 5), app.debugDescription)
        for _ in 0..<3 {
            for label in ["Shooting schedule", "Shot list", "Elements", "Reports", "Main breakdown"] {
                let button = web.buttons.matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch
                XCTAssertTrue(button.exists, label)
                button.tap()
            }
        }
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(breakdown.waitForExistence(timeout: 10))
        XCTAssertTrue(web.staticTexts[productionTitle].firstMatch.exists)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Main breakdown")).firstMatch.waitForExistence(timeout: 15))
        XCTAssertTrue(app.webViews.staticTexts[productionTitle].firstMatch.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["native-load-error"].exists)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Production Desk after repeated navigation and relaunch"
        shot.lifetime = .keepAlways
        add(shot)
    }
    @MainActor func testPortableSaveAsImportAndShareCancellation() throws {
        let app=XCUIApplication();app.launch()
        let web=app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout:15))
        revealSaveAs(web)
        let save=web.buttons["Save As…"]
        XCTAssertTrue(save.waitForExistence(timeout:10));XCTAssertTrue(save.isHittable)
        save.tap()
        let cancelPicker = {
            // Files hides Cancel while browsing inside a folder on iPhone.
            // Go back to its root; do not use the stale host "Cancel" AX overlay.
            var cancelled=false
            for _ in 0..<5 {
                let cancel=app.navigationBars.buttons["Cancel"].firstMatch
                if cancel.waitForExistence(timeout:1) && cancel.isHittable { cancel.tap();cancelled=true;break }
                let back=app.navigationBars.buttons["BackButton"].firstMatch
                if back.exists { back.tap() }
                else { break }
            }
            XCTAssertTrue(cancelled,app.debugDescription)
            let dismissed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.otherElements["Browse View (Picker)"].firstMatch)
            XCTAssertEqual(XCTWaiter.wait(for:[dismissed],timeout:10),.completed)
        }
        XCTAssertTrue(app.navigationBars.buttons["Save"].firstMatch.waitForExistence(timeout:10),app.debugDescription)
        var shot=XCTAttachment(screenshot:app.screenshot());shot.name="Save As native Files picker";shot.lifetime = .keepAlways;add(shot)
        cancelPicker()
        XCTAssertTrue(save.waitForExistence(timeout:5))
        let importButton=web.buttons["Import…"]
        XCTAssertTrue(importButton.waitForExistence(timeout:5));importButton.tap()
        let browse=web.buttons["Browse Files…"]
        XCTAssertTrue(browse.waitForExistence(timeout:5));browse.tap()
        XCTAssertTrue(app.otherElements["Browse View (Picker)"].firstMatch.waitForExistence(timeout:10),app.debugDescription)
        shot=XCTAttachment(screenshot:app.screenshot());shot.name="Import native Files picker";shot.lifetime = .keepAlways;add(shot)
        cancelPicker()
        XCTAssertTrue(browse.waitForExistence(timeout:5))
        XCTAssertTrue(web.buttons["Import locally"].exists)
        web.buttons["Close dialog"].tap()
        web.buttons.matching(NSPredicate(format:"label CONTAINS %@","Export")).firstMatch.tap()
        web.buttons.matching(NSPredicate(format:"label CONTAINS %@","Share project")).firstMatch.tap()
        XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout:10),app.debugDescription)
        shot=XCTAttachment(screenshot:app.screenshot());shot.name="Portable project anchored share sheet";shot.lifetime = .keepAlways;add(shot)
        let close=app.buttons.matching(NSPredicate(format:"label == 'Close' OR label == 'Cancel'")).firstMatch
        if close.exists { close.tap() }
        else { app.otherElements["PopoverDismissRegion"].coordinate(withNormalizedOffset:CGVector(dx:0.02,dy:0.1)).tap() }
        XCTAssertTrue(web.buttons["Close dialog"].waitForExistence(timeout:5));web.buttons["Close dialog"].tap()
        XCTAssertTrue(save.isHittable)
    }

    @MainActor func testPortableFileSaveAndImportThroughFiles() throws {
        let app=XCUIApplication();app.launch()
        let web=app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout:15))
        let stem="Portable-UI-"+String(UUID().uuidString.prefix(8))
        revealSaveAs(web)
        web.buttons["Save As…"].tap()
        let filename=app.textFields["DOCPicker.filenameTextField"]
        XCTAssertTrue(filename.waitForExistence(timeout:10),app.debugDescription)
        filename.tap()
        let old=filename.value as? String ?? ""
        filename.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:old.count)+stem)
        XCTAssertEqual(filename.value as? String,stem)
        let nativeSave=app.navigationBars.buttons["Save"].firstMatch
        XCTAssertTrue(nativeSave.waitForExistence(timeout:5));nativeSave.tap()
        let gone=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.otherElements["Browse View (Picker)"].firstMatch)
        XCTAssertEqual(XCTWaiter.wait(for:[gone],timeout:15),.completed)
        XCTAssertTrue(web.buttons["Import…"].waitForExistence(timeout:5));web.buttons["Import…"].tap()
        web.buttons["Browse Files…"].tap()
        let file=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@",stem+".productiondesk")).firstMatch
        XCTAssertTrue(file.waitForExistence(timeout:15),app.debugDescription)
        XCTAssertTrue(file.isEnabled,"The registered Production Desk file type must be selectable")
        let saved=XCTAttachment(screenshot:app.screenshot());saved.name="Saved portable file selectable in native Files";saved.lifetime = .keepAlways;add(saved)
        file.tap()
        let selected=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.otherElements["Browse View (Picker)"].firstMatch)
        XCTAssertEqual(XCTWaiter.wait(for:[selected],timeout:10),.completed)
        let importAction=web.buttons["Import locally"]
        XCTAssertTrue(importAction.waitForExistence(timeout:5));importAction.tap()
        let closed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:web.buttons["Close dialog"])
        XCTAssertEqual(XCTWaiter.wait(for:[closed],timeout:15),.completed)
        XCTAssertTrue(web.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","imported copy")).firstMatch.waitForExistence(timeout:10),app.debugDescription)
        let imported=XCTAttachment(screenshot:app.screenshot());imported.name="Portable production imported from Files";imported.lifetime = .keepAlways;add(imported)
    }

    @MainActor func testThemeSafeAreasPortraitToggleAndRotation() throws {
        let app=XCUIApplication();XCUIDevice.shared.orientation = .portrait;app.launch()
        let web=app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout:15))
        let isPad=UIDevice.current.userInterfaceIdiom == .pad
        let capture = { (name:String) in
            let image=XCTAttachment(screenshot:XCUIScreen.main.screenshot());image.name=name;image.lifetime = .keepAlways;self.add(image)
        }
        let chooseTheme = { (name:String) in
            let settings=web.buttons["Settings"]
            XCTAssertTrue(settings.waitForExistence(timeout:10));settings.tap()
            let choice=web.switches.matching(NSPredicate(format:"label CONTAINS %@",name)).firstMatch
            XCTAssertTrue(choice.waitForExistence(timeout:5));choice.tap()
            web.buttons["Close dialog"].tap()
        }
        for theme in ["Dark","Light","Dark"] {
            chooseTheme(theme)
            web.buttons.matching(NSPredicate(format:"label CONTAINS %@","Main breakdown")).firstMatch.tap()
            if isPad {
                let script=web.buttons["Script"],sheet=web.buttons["Breakdown"]
                XCTAssertTrue(script.waitForExistence(timeout:5),app.debugDescription)
                XCTAssertTrue(sheet.exists)
                sheet.tap();capture("iPad portrait \(theme) Breakdown")
                script.tap();capture("iPad portrait \(theme) Script")
            } else { capture("iPhone portrait \(theme)") }
            XCUIDevice.shared.orientation = .landscapeLeft
            web.buttons.matching(NSPredicate(format:"label CONTAINS %@","Main breakdown")).firstMatch.tap()
            capture("\(isPad ? "iPad" : "iPhone") landscape \(theme)")
            if isPad { XCTAssertFalse(web.buttons["Breakdown"].exists) }
            XCUIDevice.shared.orientation = .portrait
        }

        let dismissKeyboard = {
            let done=app.toolbars.buttons["Done"].firstMatch
            let hide=app.keyboards.buttons.matching(NSPredicate(format:"label CONTAINS[c] %@","hide")).firstMatch
            let doneExists=done.exists
            let doneFrame=doneExists ? done.frame : .zero
            let doneHittable=doneExists && done.isHittable
            let trace=XCTAttachment(string:"Done exists=\(doneExists), hittable=\(doneHittable), frame=\(doneFrame), screen=\(app.frame)")
            trace.name="Native keyboard dismissal target after rotation";trace.lifetime = .keepAlways;self.add(trace)
            if doneExists && !doneFrame.isEmpty && app.frame.contains(CGPoint(x:doneFrame.midX,y:doneFrame.midY)) {
                // After rotation AX can report the visible native Done control
                // as unhittable. Its current frame still identifies the button.
                done.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()
            } else if hide.exists && hide.isHittable {hide.tap()}
            else if app.keyboards.firstMatch.exists {
                web.buttons.matching(NSPredicate(format:"label CONTAINS %@","Main breakdown")).firstMatch.tap()
            }
            let gone=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.keyboards.firstMatch)
            XCTAssertEqual(XCTWaiter.wait(for:[gone],timeout:5),.completed)
        }
        let search=web.textFields["Search scenes"]
        if isPad {web.buttons["Script"].tap()}
        XCTAssertTrue(search.waitForExistence(timeout:5));search.tap();search.typeText("harbour")
        XCTAssertTrue((search.value as? String)?.lowercased().contains("harbour") == true,"Search value: \(String(describing:search.value))\n\(app.debugDescription)")
        if app.keyboards.firstMatch.waitForExistence(timeout:2) {capture("\(isPad ? "iPad" : "iPhone") dark software keyboard safe areas")}
        else {capture("\(isPad ? "iPad" : "iPhone") dark editor with hardware keyboard")}
        if isPad {
            XCTAssertTrue(web.buttons["Script"].exists && web.buttons["Breakdown"].exists,"Portrait tabs must survive keyboard presentation")
            web.buttons["Breakdown"].tap()
            let synopsis=web.textViews["SYNOPSIS"]
            XCTAssertTrue(synopsis.waitForExistence(timeout:5));synopsis.tap()
            let marker=" Keyboard retained "+String(UUID().uuidString.prefix(5))
            synopsis.typeText(marker)
            XCTAssertTrue((synopsis.value as? String)?.contains(marker.trimmingCharacters(in:.whitespaces)) == true)
            capture("iPad portrait breakdown edit with keyboard")
            web.buttons["Script"].tap()
            XCTAssertTrue((search.value as? String)?.lowercased().contains("harbour") == true)
            web.buttons["Breakdown"].tap()
            XCTAssertTrue((synopsis.value as? String)?.contains(marker.trimmingCharacters(in:.whitespaces)) == true)
            web.buttons["Script"].tap()
        }
        search.tap()
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(search.waitForExistence(timeout:5))
        XCTAssertTrue((search.value as? String)?.lowercased().contains("harbour") == true)
        if isPad {XCTAssertFalse(web.buttons["Breakdown"].exists)}
        capture("\(isPad ? "iPad" : "iPhone") landscape with search keyboard")
        XCUIDevice.shared.orientation = .portrait
        if isPad {XCTAssertTrue(web.buttons["Script"].waitForExistence(timeout:5));XCTAssertTrue(web.buttons["Breakdown"].exists)}
        XCTAssertTrue((search.value as? String)?.lowercased().contains("harbour") == true)
        capture("\(isPad ? "iPad" : "iPhone") portrait restored with search keyboard")
        dismissKeyboard()
        capture("\(isPad ? "iPad" : "iPhone") portrait keyboard dismissed")
        app.terminate();app.launch()
        XCTAssertTrue(app.webViews.buttons.matching(NSPredicate(format:"label CONTAINS %@","Main breakdown")).firstMatch.waitForExistence(timeout:15))
        capture("\(isPad ? "iPad" : "iPhone") saved dark appearance after cold launch")
    }

    @MainActor func testLightAppearancePersistsAcrossColdLaunch() throws {
        let app=XCUIApplication();XCUIDevice.shared.orientation = .portrait;app.launch()
        let web=app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout:15))
        web.buttons["Settings"].tap()
        let light=web.switches.matching(NSPredicate(format:"label CONTAINS %@","Light")).firstMatch
        XCTAssertTrue(light.waitForExistence(timeout:5));light.tap()
        web.buttons["Close dialog"].tap()
        app.terminate();app.launch()
        XCTAssertTrue(web.buttons.matching(NSPredicate(format:"label CONTAINS %@","Main breakdown")).firstMatch.waitForExistence(timeout:15))
        let screenshot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());screenshot.name="Saved Light app theme after cold launch";screenshot.lifetime = .keepAlways;add(screenshot)
        web.buttons["Settings"].tap()
        XCTAssertTrue(light.waitForExistence(timeout:5));XCTAssertEqual(light.value as? String,"1")
        web.buttons["Close dialog"].tap()
    }

    @MainActor func testSyntheticScriptEditSaveAsAndImportThroughFiles() throws {
        let app=XCUIApplication();XCUIDevice.shared.orientation = .portrait;app.launch()
        let web=app.webViews["production-desk-webview"]
        XCTAssertTrue(web.waitForExistence(timeout:15))
        importSyntheticScript(web, app:app)
        if UIDevice.current.userInterfaceIdiom == .pad {web.buttons["Script"].tap()}
        web.buttons["Edit text"].tap()
        let text=web.textViews.firstMatch;XCTAssertTrue(text.waitForExistence(timeout:5));text.tap();text.typeText(" Demo UI note")
        let done=app.toolbars.buttons["Done"].firstMatch
        if done.exists && !done.frame.isEmpty {done.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()}
        else {
            let hide=app.keyboards.buttons.matching(NSPredicate(format:"label CONTAINS[c] %@","hide")).firstMatch
            if hide.exists && hide.isHittable {hide.tap()}
        }
        web.buttons["Save scene text"].tap()
        let closed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:web.buttons["Close dialog"])
        XCTAssertEqual(XCTWaiter.wait(for:[closed],timeout:10),.completed)
        web.buttons.matching(NSPredicate(format:"label CONTAINS %@","Main breakdown")).firstMatch.tap()
        let stem="Synthetic-Production-"+String(UUID().uuidString.prefix(8))
        revealSaveAs(web)
        web.buttons["Save As…"].tap()
        let filename=app.textFields["DOCPicker.filenameTextField"]
        XCTAssertTrue(filename.waitForExistence(timeout:10),app.debugDescription);filename.tap()
        let old=filename.value as? String ?? "";filename.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:old.count)+stem)
        XCTAssertEqual(filename.value as? String,stem)
        // On iPad, finish the focused filename field before the navigation-bar
        // Save action. A tap while its keyboard/popover is active can only end editing.
        let hideFilesKeyboard=app.keyboards.buttons["Hide keyboard"].firstMatch
        if hideFilesKeyboard.exists && hideFilesKeyboard.isHittable {hideFilesKeyboard.tap()}
        let readyToSave=XCTAttachment(screenshot:XCUIScreen.main.screenshot());readyToSave.name="Demo portable filename committed before Files save";readyToSave.lifetime = .keepAlways;add(readyToSave)
        let save=app.navigationBars.buttons["Save"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout:5));XCTAssertTrue(save.isHittable);save.tap()
        let picker=app.otherElements["Browse View (Picker)"].firstMatch
        let gone=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:picker)
        // Confirm Files has finished saving before returning to the web controls.
        // Retry only while the same visible Save action remains in the open picker.
        if XCTWaiter.wait(for:[gone],timeout:2) != .completed && picker.exists && save.exists && save.isHittable {save.tap()}
        let saved=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:picker)
        XCTAssertEqual(XCTWaiter.wait(for:[saved],timeout:15),.completed,app.debugDescription)
        web.buttons["Import…"].tap()
        let browse=web.buttons["Browse Files…"];XCTAssertTrue(browse.waitForExistence(timeout:5));browse.tap()
        let file=app.cells.matching(NSPredicate(format:"label BEGINSWITH %@",stem+".productiondesk")).firstMatch
        XCTAssertTrue(picker.waitForExistence(timeout:10),app.debugDescription)
        // The native Files grid lazily loads rows; earlier exports may precede this file.
        for _ in 0..<8 {
            if file.waitForExistence(timeout:1) {break}
            picker.swipeUp()
        }
        XCTAssertTrue(file.exists,app.debugDescription);XCTAssertTrue(file.isEnabled);file.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()
        let picked=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:picker)
        if XCTWaiter.wait(for:[picked],timeout:2) != .completed && picker.exists && file.exists && file.isHittable {file.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap()}
        let opened=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:picker)
        XCTAssertEqual(XCTWaiter.wait(for:[opened],timeout:10),.completed,app.debugDescription)
        web.buttons["Import locally"].tap()
        let imported=web.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","imported copy")).firstMatch
        XCTAssertTrue(imported.waitForExistence(timeout:10),app.debugDescription)
        let evidence=XCTAttachment(screenshot:XCUIScreen.main.screenshot());evidence.name="Demo imported as a separate PDF-backed editable production from Files";evidence.lifetime = .keepAlways;add(evidence)
        XCTAssertFalse(web.buttons["Load The Last Light demo"].exists)
        XCTAssertFalse(web.buttons["Demo guide"].exists)
    }

}
