import XCTest
import WebKit
import UIKit
import PDFKit
@testable import ProductionDesk

/// Exercises the shipped ES modules, DOM controls and real native save bridge.
final class RuntimeWorkflowTests: XCTestCase {
    @MainActor private func openDesk() async throws -> DeskViewController {
        let controller = DeskViewController()
        controller.loadViewIfNeeded()
        for _ in 0..<150 {
            if let ready = try? await controller.webView.evaluateJavaScript("document.body?.dataset.appReady === 'true'"), ready as? Bool == true { return controller }
            try await Task.sleep(for: .milliseconds(100))
        }
        let content = try? await controller.webView.evaluateJavaScript("document.body?.innerText")
        XCTFail("Bundled application did not initialize: \(String(describing: content))")
        throw CocoaError(.coderReadCorrupt)
    }

    @MainActor func testScriptBreakdownScheduleShotUndoAndReopen() async throws {
        let desk = try await openDesk()
        let result = try await desk.webView.callAsyncJavaScript("""
        const $=s=>document.querySelector(s);
        const click=s=>{const el=$(s);if(!el)throw Error('Missing '+s);el.click();};
        const input=(s,value)=>{const el=$(s);if(!el)throw Error('Missing '+s);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
        const nav=v=>click('#navigation [data-view="'+v+'"]');
        click('#import-open');
        input('#paste-script','1 INT. KITCHEN - DAY\\n\\nA kettle whistles.\\n\\nMAYA\\nTime to go.\\n\\n2 EXT. ROAD - NIGHT\\n\\nThe car leaves.');
        click('#import-submit');
        for(let i=0;i<100&&$('#modal').open;i++)await new Promise(r=>setTimeout(r,25));
        if($('#modal').open)throw Error($('#modal-error').textContent);
        input('[data-field="description"]','Runtime verified synopsis');
        nav('schedule');click('[data-action="add-day"]');
        click('[data-move-strip]');
        $('#strip-move-target').value='1';$('#strip-move-target').dispatchEvent(new Event('change',{bubbles:true}));
        click('#strip-move-save');
        nav('shots');click('#add-scene');
        input('#new-shot-description','Wide master of Maya');click('#new-shot-save');
        input('[data-shot-field="takes"]','3');
        input('[data-shot-field="status"]','Done');
        // Undo and redo preserve the completed shot through a full workspace clone.
        click('#undo');click('#redo');
        nav('elements');
        // An inline edit must save while still focused, before change/blur fires.
        const element=$('[data-element-name]');const elementID=element.dataset.elementName;
        element.focus();input('[data-element-name]','Runtime element rename');
        if(!await window.productionDeskSave())throw Error('Focused element save did not finish');
        for(let i=0;i<3;i++){nav('elements');nav('reports');nav('workspace');nav('shots');}
        if(!await window.productionDeskSave())throw Error('Save did not finish');
        const w=await window.webkit.messageHandlers.scheduler.postMessage({operation:'load'});
        const p=w.projects.find(p=>p.id===w.activeProject);
        const {validateWorkspace}=await import('/film-native.js');validateWorkspace(w);
        return {id:p.id,scenes:p.breakdowns.length,description:p.breakdowns[0].description,
          script:p.breakdowns[0]._scriptText,days:p.stripboards[0].boards[0].breakdownIds.length,
          scheduled:p.stripboards[0].boards[0].breakdownIds[0].length,
          shots:p._shots.length,status:p._shots[0].status,takes:p._shots[0].takes,
          rendered:$('#shot-count').textContent,elementName:p.elements.find(e=>e.id===elementID).name};
        """, arguments: [:], in: nil, contentWorld: .page)
        let fields = try XCTUnwrap(result as? [String: Any])
        XCTAssertEqual(fields["scenes"] as? Int, 2)
        XCTAssertEqual(fields["description"] as? String, "Runtime verified synopsis")
        XCTAssertTrue((fields["script"] as? String)?.contains("A kettle whistles.") == true)
        XCTAssertEqual(fields["days"] as? Int, 1)
        XCTAssertEqual(fields["scheduled"] as? Int, 1)
        XCTAssertEqual(fields["shots"] as? Int, 1)
        XCTAssertEqual(fields["status"] as? String, "Done")
        XCTAssertEqual(fields["takes"] as? Int, 3)
        XCTAssertEqual(fields["rendered"] as? String, "1 shots")
        XCTAssertEqual(fields["elementName"] as? String, "Runtime element rename")
        let reopened = try await openDesk()
        let restored = try await reopened.webView.callAsyncJavaScript("return await window.webkit.messageHandlers.scheduler.postMessage({operation:'load'});", arguments: [:], in: nil, contentWorld: .page)
        XCTAssertEqual((restored as? [String: Any])?["activeProject"] as? String, fields["id"] as? String)
    }

    @MainActor func testFinalDraftBrowserParserAndInvalidXML() async throws {
        let desk = try await openDesk()
        let result = try await desk.webView.callAsyncJavaScript("""
        const {importScript,validateUSS}=await import('/film-native.js');
        const xml='<FinalDraft><Content><Paragraph Type="Scene Heading" Number="42"><Text>INT. STUDIO - DAY</Text></Paragraph><Paragraph Type="Character"><Text>MAYA</Text></Paragraph><Paragraph Type="Dialogue"><Text>Keep the original brand.</Text></Paragraph></Content></FinalDraft>';
        const p=importScript(xml,'Original.fdx');validateUSS(p);
        let malformed=false;try{importScript('<FinalDraft><Content>','Broken.fdx');}catch(e){malformed=e.message.includes('valid XML');}
        return {scene:p.breakdowns[0].scene,text:p.breakdowns[0]._scriptText,cast:p.elements.filter(e=>p.categories.find(c=>c.id===e.category)?.ucid===100).map(e=>e.name),malformed};
        """, arguments: [:], in: nil, contentWorld: .page)
        let fields = try XCTUnwrap(result as? [String: Any])
        XCTAssertEqual(fields["scene"] as? String, "42")
        XCTAssertEqual(fields["cast"] as? [String], ["MAYA"])
        XCTAssertTrue((fields["text"] as? String)?.contains("Keep the original brand.") == true)
        XCTAssertEqual(fields["malformed"] as? Bool, true)
    }

    @MainActor func testCurrentToolsVisibleAtIPadWidths() async throws {
        let desk = try await openDesk()
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = try XCTUnwrap(scene.windows.first(where: { $0.isKeyWindow }))
        let original = window.rootViewController
        defer { window.rootViewController = original }
        window.rootViewController = desk
        for width in [390.0, 744.0, 1024.0, 1366.0] {
            desk.view.frame = CGRect(x:0,y:0,width:width,height:1000)
            desk.view.layoutIfNeeded()
            try await Task.sleep(for: .milliseconds(200))
            let result = try await desk.webView.callAsyncJavaScript("""
            const buttons=[...document.querySelectorAll('#navigation button')];
            return {count:buttons.filter(b=>getComputedStyle(b).display!=='none').length,
              settings:getComputedStyle(document.querySelector('.sidebar-bottom')).display!=='none',
              width:document.documentElement.scrollWidth,viewport:innerWidth};
            """, arguments:[:],in:nil,contentWorld:.page)
            let values=try XCTUnwrap(result as? [String:Any])
            XCTAssertEqual((values["viewport"] as? Double) ?? 0,width,accuracy:1)
            XCTAssertEqual(values["count"] as? Int,6)
            XCTAssertEqual(values["settings"] as? Bool,true)
            XCTAssertLessThanOrEqual((values["width"] as? Double) ?? 9999, ((values["viewport"] as? Double) ?? 0)+1)
        }
    }

    @MainActor func testLinedPDFAndFullBackupRoundTrip() async throws {
        let desk = try await openDesk()
        let result = try await desk.webView.callAsyncJavaScript("""
        const {nativeAPI}=await import('/native-platform.js');
        const pdf=await PDFLib.PDFDocument.create();const page=pdf.addPage([612,792]);page.drawText('INT. STUDIO - DAY',{x:72,y:720});page.drawText('MAYA prepares the camera.',{x:72,y:690});
        const original=await pdf.save(),file=new File([original],'iPad-original.pdf',{type:'application/pdf'});
        const imported=await nativeAPI('/api/import',file,{'X-Filename':'iPad-original.pdf'}),p=imported.project;
        const hash=p._linedScript.activePdf,d=p._linedScript.documents[0];
        d.marks.push({id:crypto.randomUUID(),type:'arrow',page:0,start:[.2,.2],end:[.3,.6],color:'#E60026',width:2});
        const w={version:1,activeProject:p.id,projects:[p]};
        await nativeAPI('/api/workspace',w);
        const encoded=await window.webkit.messageHandlers.scheduler.postMessage({operation:'backupPDFs',workspace:w});
        const backup=JSON.stringify({...w,_pdfDocuments:encoded});
        const restored=await nativeAPI('/api/import',backup,{'X-Filename':'Production-Desk-backup.json'});
        const raw=await window.webkit.messageHandlers.scheduler.postMessage({operation:'readPDF',sha256:hash});
        return {bytes:atob(raw).length,original:original.length,marks:restored.workspace.projects[0]._linedScript.documents[0].marks.length,hasPDF:!!encoded[hash],scene:p.breakdowns[0].scene};
        """,arguments:[:],in:nil,contentWorld:.page)
        let value=try XCTUnwrap(result as? [String:Any])
        XCTAssertEqual(value["bytes"] as? Int,value["original"] as? Int)
        XCTAssertEqual(value["marks"] as? Int,1)
        XCTAssertEqual(value["hasPDF"] as? Bool,true)
        XCTAssertEqual(value["scene"] as? String,"1")
        let reopened=try await openDesk()
        _ = try await reopened.webView.evaluateJavaScript("document.querySelector('[data-view=lined]').click()")
        for _ in 0..<150 {
            if let ready=try? await reopened.webView.evaluateJavaScript("!!document.querySelector('#lined-overlay')"),ready as? Bool==true {break}
            try await Task.sleep(for:.milliseconds(100))
        }
        let overlay=try await reopened.webView.evaluateJavaScript("!!document.querySelector('#lined-overlay')")
        let status=try await reopened.webView.evaluateJavaScript("document.querySelector('#lined-status').textContent")
        XCTAssertEqual(overlay as? Bool,true,String(describing:status))
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window=try XCTUnwrap(scene.windows.first(where: { $0.isKeyWindow }))
        let previous=window.rootViewController
        window.rootViewController=reopened
        defer { window.rootViewController=previous }
        reopened.view.layoutIfNeeded()
        _ = try await reopened.webView.evaluateJavaScript("document.querySelector('#lined-export').click()")
        for _ in 0..<100 {
            if reopened.presentedViewController is UIActivityViewController { break }
            try await Task.sleep(for:.milliseconds(100))
        }
        let activity=try XCTUnwrap(reopened.presentedViewController as? UIActivityViewController)
        let shares=FileManager.default.temporaryDirectory.appendingPathComponent("ProductionDeskShares")
        let enumerator=try XCTUnwrap(FileManager.default.enumerator(at:shares,includingPropertiesForKeys:nil))
        let files=enumerator.compactMap { $0 as? URL }.filter { $0.lastPathComponent.hasSuffix("-lined-script.pdf") }
        let exported=try XCTUnwrap(files.first)
        let pdf=try XCTUnwrap(PDFDocument(data:Data(contentsOf:exported)))
        XCTAssertEqual(pdf.pageCount,1)
        XCTAssertTrue(pdf.string?.contains("MAYA prepares the camera.")==true)
        // Finish this programmatically presented test sheet exactly once;
        // UIKit may also notify during dismissal, so detach the test callback.
        let completion=activity.completionWithItemsHandler
        activity.completionWithItemsHandler=nil
        completion?(nil,false,nil,nil)
        reopened.dismiss(animated:false)
    }
    @MainActor func testEmptyProductionModalDoesNotBindSceneFields() async throws {
        let desk=try await openDesk()
        let result=try await desk.webView.callAsyncJavaScript("""
        const send=v=>window.webkit.messageHandlers.scheduler.postMessage(v);
        await send({operation:'support',request:{action:'clear'}});
        const $=s=>document.querySelector(s);$('#new-open').click();
        const field=$('[data-field="modal-value"]');field.value='Empty tablet production';field.dispatchEvent(new Event('input',{bubbles:true}));$('#modal-ok').click();
        for(let i=0;i<100&&$('#project-title').textContent!=='Empty tablet production';i++)await new Promise(r=>setTimeout(r,25));
        // A later modal must not inherit the scene-edit handlers from the render.
        $('#new-open').click();const again=$('[data-field="modal-value"]');again.value='Second empty production';again.dispatchEvent(new Event('input',{bubbles:true}));$('#modal-cancel').click();
        await window.productionDeskSave();await new Promise(r=>setTimeout(r,100));
        const diagnostic=await send({operation:'support'});
        return {title:$('#project-title').textContent,report:diagnostic.report||null};
        """,arguments:[:],in:nil,contentWorld:.page)
        let value=try XCTUnwrap(result as? [String:Any])
        XCTAssertEqual(value["title"] as? String,"Empty tablet production")
        XCTAssertTrue(value["report"] is NSNull)
    }
    @MainActor func testPortableDesktopToIOSAndBackPreservesAllFieldsAndPDFs() async throws {
        let fixture = try XCTUnwrap(Bundle(for: PlatformTests.self).url(forResource: "portable-desktop", withExtension: "productiondesk", subdirectory: "Fixtures"))
        let text = try String(contentsOf: fixture, encoding: .utf8)
        let desk = try await openDesk()
        let result = try await desk.webView.callAsyncJavaScript("""
        const {nativeAPI}=await import('/native-platform.js');
        const {projectFile,mergeProductions}=await import('/project-file.js');
        const stable=v=>JSON.stringify(v===null||typeof v!=='object'?v:Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(stable(v[k]))])));
        const original=JSON.parse(text),before=await nativeAPI('/api/workspace');
        const incoming=await nativeAPI('/api/import',text,{'X-Filename':'Desktop.productiondesk'});
        const w=incoming.workspace;
        const attachments=await window.webkit.messageHandlers.scheduler.postMessage({operation:'backupPDFs',workspace:w});
        const returned=projectFile({...w,_pdfDocuments:attachments});
        const current=await nativeAPI('/api/workspace');
        const invalid=[];
        for(const changed of [{...original,formatVersion:77},{...original,workspace:{...original.workspace,_pdfDocuments:{}}}]){
          try{await nativeAPI('/api/import',JSON.stringify(changed),{'X-Filename':'Bad.productiondesk'});invalid.push(false);}catch{invalid.push(true);}
        }
        const merged=mergeProductions(w,w.projects,w.activeProject);
        return {returned:JSON.stringify(returned),existingUnchanged:stable(before)===stable(current),invalid,
          collision:merged.workspace.projects.length===2&&merged.imported[0].id!==w.projects[0].id,
          linked:merged.imported[0]._shots[0].sceneId===merged.imported[0].breakdowns[0].id};
        """, arguments: ["text":text], in: nil, contentWorld: .page)
        let fields = try XCTUnwrap(result as? [String:Any])
        let returned = try XCTUnwrap(fields["returned"] as? String)
        let expected = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? NSDictionary
        let actual = try JSONSerialization.jsonObject(with: Data(returned.utf8)) as? NSDictionary
        XCTAssertEqual(actual, expected, "All known and unknown persisted fields and embedded PDF bytes must round trip")
        XCTAssertEqual(fields["existingUnchanged"] as? Bool, true)
        XCTAssertEqual(fields["invalid"] as? [Bool], [true,true])
        XCTAssertEqual(fields["collision"] as? Bool,true)
        XCTAssertEqual(fields["linked"] as? Bool,true)
        let documents = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0]
        try Data(returned.utf8).write(to:documents.appendingPathComponent("cross-platform-return.productiondesk"),options:.atomic)
    }

    @MainActor func testOpenProjectFromFilesPreservesCurrentWorkspaceAndLabelsCopy() async throws {
        let fixture = try XCTUnwrap(Bundle(for: PlatformTests.self).url(forResource: "portable-desktop", withExtension: "productiondesk", subdirectory: "Fixtures"))
        let desk = DeskViewController()
        desk.openProjectFile(fixture)
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let window = try XCTUnwrap(scene.windows.first(where: { $0.isKeyWindow }))
        let original = window.rootViewController
        defer { window.rootViewController = original }
        window.rootViewController = desk
        desk.loadViewIfNeeded()
        for _ in 0..<180 {
            let ready = try? await desk.webView.evaluateJavaScript("document.body?.dataset.appReady==='true' && document.querySelector('#project-picker')?.selectedOptions[0]?.textContent?.includes('The Last Light')")
            if ready as? Bool == true { break }
            try await Task.sleep(for:.milliseconds(100))
        }
        let before = try await desk.webView.callAsyncJavaScript("await window.productionDeskSave();return await window.webkit.messageHandlers.scheduler.postMessage({operation:'load'});", arguments:[:],in:nil,contentWorld:.page)
        let first = try XCTUnwrap(before as? [String:Any])
        let count = try XCTUnwrap(first["projects"] as? [[String:Any]]).count
        desk.openProjectFile(fixture)
        for _ in 0..<100 {
            let title = try? await desk.webView.evaluateJavaScript("document.querySelector('#project-picker')?.selectedOptions[0]?.textContent")
            if (title as? String)?.contains("imported copy") == true {break}
            try await Task.sleep(for:.milliseconds(100))
        }
        let after = try await desk.webView.callAsyncJavaScript("await window.productionDeskSave();return await window.webkit.messageHandlers.scheduler.postMessage({operation:'load'});",arguments:[:],in:nil,contentWorld:.page)
        let second = try XCTUnwrap(after as? [String:Any])
        let projects = try XCTUnwrap(second["projects"] as? [[String:Any]])
        XCTAssertEqual(projects.count,count+1)
        for project in try XCTUnwrap(first["projects"] as? [[String:Any]]) {
            XCTAssertTrue(projects.contains { ($0 as NSDictionary)==(project as NSDictionary) })
        }
    }

}
