import XCTest
import WebKit
import PDFKit
import UIKit
@testable import ProductionDesk

final class PlatformTests: XCTestCase {
    func testOfflineResourcesAndTraversalProtection() throws {
        let root = try XCTUnwrap(Bundle.main.url(forResource: "Web", withExtension: nil))
        let scheme = LocalWebScheme(root: root)
        for path in ["/", "/app.js", "/native-platform.js", "/assets/sp-logo.png", "/style.css"] {
            let file = try scheme.resourceURL(for: URL(string: "productiondesk://app" + path)!)
            XCTAssertFalse(try Data(contentsOf: file).isEmpty)
        }
        XCTAssertThrowsError(try scheme.resourceURL(for: URL(string: "productiondesk://app/%2E%2E/Info.plist")!))
        XCTAssertThrowsError(try scheme.resourceURL(for: URL(string: "productiondesk://untrusted/app.js")!))
        XCTAssertEqual(LocalWebScheme.mimeType(for: URL(fileURLWithPath: "app.js")), "text/javascript")
    }

    func testExportsRemainInsideUniqueShareDirectories() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let first = try NativeFiles.export(Data("first".utf8), filename: "../../schedule.csv", directory: root)
        let second = try NativeFiles.export(Data("second".utf8), filename: "../../schedule.csv", directory: root)
        XCTAssertTrue(first.path.hasPrefix(root.path + "/"))
        XCTAssertEqual(first.lastPathComponent, "schedule.csv")
        XCTAssertNotEqual(first, second)
        XCTAssertEqual(try String(contentsOf: first, encoding: .utf8), "first")
        XCTAssertEqual(NativeFiles.safeFilename(".."), "Production-Desk-export.json")
    }

    @MainActor func testSelectablePDFAndScannedPDFRejection() throws {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 612, height: 792))
        let script = renderer.pdfData { context in
            context.beginPage()
            ("INT. KITCHEN - DAY\n\nMAYA\nThe kettle whistles." as NSString).draw(at: CGPoint(x: 36, y: 36), withAttributes: [.font: UIFont.systemFont(ofSize: 14)])
            context.beginPage()
            ("EXT. STREET - NIGHT\nMAYA waits." as NSString).draw(at: CGPoint(x: 36, y: 36), withAttributes: [.font: UIFont.systemFont(ofSize: 14)])
        }
        XCTAssertTrue(try NativeFiles.extractPDF(script).contains("KITCHEN"))
        XCTAssertTrue(try NativeFiles.extractPDF(script).contains("\u{000C}"))
        let image = UIGraphicsImageRenderer(size: CGSize(width: 400, height: 500)).image { context in
            UIColor.lightGray.setFill(); context.fill(CGRect(x: 0, y: 0, width: 400, height: 500))
        }
        let scannedDocument = PDFDocument()
        scannedDocument.insert(try XCTUnwrap(PDFPage(image: image)), at: 0)
        let scan = try XCTUnwrap(scannedDocument.dataRepresentation())
        XCTAssertThrowsError(try NativeFiles.extractPDF(scan)) { error in XCTAssertTrue(error.localizedDescription.contains("no selectable text"), error.localizedDescription) }
        XCTAssertThrowsError(try NativeFiles.extractPDF(Data("invalid".utf8)))
    }

    @MainActor func testLongReportsProduceMultipleReadablePDFPages() throws {
        let renderer = ReportRenderer()
        let rows = (1...180).map { "<tr><td>Scene \($0)</td><td>INT. KITCHEN - DAY</td><td>Production Desk pagination test</td></tr>" }.joined()
        renderer.addPrintFormatter(UIMarkupTextPrintFormatter(markupText: "<html><body><h1>Production Desk</h1><table>\(rows)</table></body></html>"), startingAtPageAt: 0)
        let document = try XCTUnwrap(PDFDocument(data: renderer.pdfData()))
        XCTAssertGreaterThan(document.pageCount, 1)
        XCTAssertTrue(document.string?.contains("Scene 180") == true)
    }

    @MainActor func testBundledModulesAndNativeBridgeInitialize() async throws {
        let controller = DeskViewController()
        controller.loadViewIfNeeded()
        for _ in 0..<100 {
            if let ready = try? await controller.webView.evaluateJavaScript("document.body?.dataset.ready === 'true'"), ready as? Bool == true { break }
            try await Task.sleep(for: .milliseconds(100))
        }
        let title = try await controller.webView.evaluateJavaScript("document.querySelector('#project-title').textContent") as? String
        XCTAssertNotEqual(title, "Opening your workspace")
        XCTAssertNotEqual(title, "Could not open local workspace")
        let result = try await controller.webView.callAsyncJavaScript("return await window.webkit.messageHandlers.scheduler.postMessage({operation:'load'});", arguments: [:], in: nil, contentWorld: .page)
        XCTAssertNotNil(result as? [String: Any])
    }
    @MainActor func testOriginalPDFChecksumBackupAndTamperRejection() throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let restored=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at:directory);try? FileManager.default.removeItem(at:restored) }
        let renderer=UIGraphicsPDFRenderer(bounds:CGRect(x:0,y:0,width:612,height:792))
        let original=renderer.pdfData { context in context.beginPage();("Original immutable PDF" as NSString).draw(at:CGPoint(x:50,y:50),withAttributes:[.font:UIFont.systemFont(ofSize:14)]) }
        let document=try PDFRepository.store(original,filename:"../../original.pdf",directory:directory)
        let hash=try XCTUnwrap(document["sha256"] as? String)
        let workspace:[String:Any]=["projects":[["_linedScript":["activePdf":hash,"documents":[document]]]]]
        let files=try PDFRepository.backup(workspace,directory:directory)
        var backup=workspace;backup["_pdfDocuments"]=files
        try PDFRepository.restore(backup,directory:restored)
        XCTAssertEqual(try Data(contentsOf:PDFRepository.url(hash,directory:restored)),original)
        XCTAssertEqual(document["filename"] as? String,"original.pdf")
        XCTAssertThrowsError(try PDFRepository.url("../../other",directory:directory))
        var corrupt=workspace;corrupt["_pdfDocuments"]=[hash:Data("tampered".utf8).base64EncodedString()]
        XCTAssertThrowsError(try PDFRepository.restore(corrupt,directory:restored))
        XCTAssertEqual(try Data(contentsOf:PDFRepository.url(hash,directory:restored)),original)
        let missing=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        XCTAssertThrowsError(try PDFRepository.restore(workspace,directory:missing))
        XCTAssertFalse(FileManager.default.fileExists(atPath:missing.path))
        let restoredURL=try PDFRepository.url(hash,directory:restored)
        try Data("changed externally".utf8).write(to:restoredURL)
        XCTAssertThrowsError(try PDFRepository.read(hash,directory:restored))
        XCTAssertThrowsError(try PDFRepository.store(original,filename:"original.pdf",directory:restored))
        XCTAssertThrowsError(try PDFRepository.restore(workspace,directory:restored))
        XCTAssertEqual(try String(contentsOf:restoredURL),"changed externally")
    }
    @MainActor func testRegisteredIPadIdentityAndLegacyWorkspaceCompatibility() async throws {
        XCTAssertEqual(Bundle.main.bundleIdentifier,"com.hosier.scheduler.ipad")
        let fixture=try XCTUnwrap(Bundle(for:PlatformTests.self).url(forResource:"legacy-scheduler-workspace",withExtension:"json",subdirectory:"Fixtures"))
        let original=try Data(contentsOf:fixture)
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at:directory) }
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let store=WorkspaceStore(directory:directory)
        try original.write(to:store.currentFileURL)
        XCTAssertEqual(try store.load(),original)
        var workspace=try XCTUnwrap(JSONSerialization.jsonObject(with:original) as? [String:Any])
        let desk=DeskViewController();desk.loadViewIfNeeded()
        for _ in 0..<100 {
            if (try? await desk.webView.evaluateJavaScript("document.body?.dataset.appReady==='true'")) as? Bool==true {break}
            try await Task.sleep(for:.milliseconds(100))
        }
        let result=try await desk.webView.callAsyncJavaScript("""
        const {validateWorkspace}=await import('/film-native.js');
        const active=legacy.activeProject,ids=legacy.projects.flatMap(p=>[p.id,...p.breakdowns.map(b=>b.id)]);
        const value=validateWorkspace(legacy);
        return {activeUnchanged:value.activeProject===active,idsUnchanged:JSON.stringify(ids)===JSON.stringify(value.projects.flatMap(p=>[p.id,...p.breakdowns.map(b=>b.id)])),title:value.projects[0].project,scenes:value.projects[0].breakdowns.filter(b=>b.type==='scene').length};
        """,arguments:["legacy":workspace],in:nil,contentWorld:.page)
        let fields=try XCTUnwrap(result as? [String:Any])
        XCTAssertEqual(fields["activeUnchanged"] as? Bool,true)
        XCTAssertEqual(fields["idsUnchanged"] as? Bool,true)
        XCTAssertEqual(fields["title"] as? String,"The Last Light")
        XCTAssertEqual(fields["scenes"] as? Int,8)
        workspace["_migrationVerified"]=true
        let updated=try JSONSerialization.data(withJSONObject:workspace,options:.sortedKeys)
        try store.save(updated)
        XCTAssertEqual(try Data(contentsOf:store.backupFileURL),original)
        XCTAssertEqual(try WorkspaceStore(directory:directory).load(),updated)
    }
}
