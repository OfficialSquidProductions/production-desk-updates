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

    @MainActor func testThemeSurfacesAndCachedLaunchAppearance() async throws {
        let desk = try await openDesk()
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = try XCTUnwrap(scene.windows.first(where: { $0.isKeyWindow }))
        let original = window.rootViewController
        defer { window.rootViewController = original }
        window.rootViewController = desk
        for dark in [true, false, true] {
            _ = try await desk.webView.callAsyncJavaScript("""
            document.querySelector('#app-settings-open').click();
            document.querySelector('[data-theme-choice="'+theme+'"]').click();
            for(let i=0;i<50&&document.querySelector('[data-theme-choice="'+theme+'"]').disabled;i++)await new Promise(r=>setTimeout(r,20));
            document.querySelector('#modal').close();
            return document.documentElement.dataset.theme;
            """, arguments:["theme":dark ? "dark" : "light"], in:nil, contentWorld:.page)
            try await Task.sleep(for:.milliseconds(150))
            let expected = dark ? UIColor(red:25/255,green:20/255,blue:25/255,alpha:1) : UIColor(red:250/255,green:248/255,blue:249/255,alpha:1)
            XCTAssertEqual(desk.view.backgroundColor,expected)
            XCTAssertEqual(desk.webView.backgroundColor,expected)
            XCTAssertEqual(desk.webView.scrollView.backgroundColor,expected)
            var red:CGFloat=0,green:CGFloat=0,blue:CGFloat=0,alpha:CGFloat=0
            desk.webView.underPageBackgroundColor.getRed(&red,green:&green,blue:&blue,alpha:&alpha)
            XCTAssertEqual(red,dark ? 25/255 : 250/255,accuracy:0.0001)
            XCTAssertEqual(green,dark ? 20/255 : 248/255,accuracy:0.0001)
            XCTAssertEqual(blue,dark ? 25/255 : 249/255,accuracy:0.0001)
            XCTAssertEqual(desk.overrideUserInterfaceStyle,dark ? .dark : .light)
            XCTAssertEqual(desk.preferredStatusBarStyle,dark ? .lightContent : .darkContent)
            XCTAssertEqual(window.backgroundColor,expected)
            for size in [CGSize(width:744,height:1133),CGSize(width:1366,height:1024),CGSize(width:500,height:900)] {
                desk.view.frame = CGRect(origin:.zero,size:size); desk.view.layoutIfNeeded()
                try await Task.sleep(for:.milliseconds(150))
                let fills = desk.view.layer.sublayers?.compactMap { $0 as? CAGradientLayer } ?? []
                let top = try XCTUnwrap(fills.first(where:{$0.name=="theme-top-safe-area"}))
                let bottom = try XCTUnwrap(fills.first(where:{$0.name=="theme-bottom-safe-area"}))
                XCTAssertEqual(top.frame.maxY,desk.webView.frame.minY,accuracy:1)
                XCTAssertEqual(bottom.frame.minY,desk.webView.frame.maxY,accuracy:1)
                XCTAssertEqual(bottom.frame.maxY,desk.view.bounds.maxY,accuracy:1)
                XCTAssertTrue(top.colors?.count==4 && bottom.colors?.count==4)
            }
            // The shell uses the saved choice before WebKit has loaded again.
            let fresh = DeskViewController(); fresh.loadViewIfNeeded()
            XCTAssertEqual(fresh.view.backgroundColor,expected)
            XCTAssertEqual(fresh.preferredStatusBarStyle,dark ? .lightContent : .darkContent)
        }
    }

    @MainActor func testPortraitPaneStateAndResponsiveReachability() async throws {
        let desk = try await openDesk()
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = try XCTUnwrap(scene.windows.first(where: { $0.isKeyWindow }))
        let original = window.rootViewController
        defer { window.rootViewController = original }
        window.rootViewController = desk
        desk.view.frame = CGRect(x:0,y:0,width:744,height:1133); desk.view.layoutIfNeeded()
        try await Task.sleep(for:.milliseconds(200))
        let state = try await desk.webView.callAsyncJavaScript("""
        const $=s=>document.querySelector(s);
        $('#import-open').click();
        $('#paste-script').value='1 INT. LIGHTHOUSE - DAY\\n\\n'+Array(70).fill('Maya watches the harbour and prepares the camera.').join('\\n\\n')+'\\n\\n2 EXT. HARBOUR - NIGHT\\n\\nA boat waits.';
        $('#import-submit').click();
        for(let i=0;i<100&&$('#modal').open;i++)await new Promise(r=>setTimeout(r,25));
        if($('#modal').open)throw Error($('#modal-error').textContent);
        const script=$('#workspace-script'),sheet=$('#workspace-breakdown'),picker=$('#scene-picker');
        const searchInput=$('#scene-search'),page=$('#script-text');searchInput.focus();
        let stableSearch=true;
        for(const character of 'harbour'){
          searchInput.value+=character;searchInput.setSelectionRange(searchInput.value.length,searchInput.value.length);
          searchInput.dispatchEvent(new Event('input',{bubbles:true}));
          stableSearch&&=searchInput===$('#scene-search')&&document.activeElement===searchInput&&picker===$('#scene-picker')&&page===$('#script-text');
        }
        const searchValue=searchInput.value;
        searchInput.value='no-scene-could-match-this-token';searchInput.dispatchEvent(new Event('input',{bubbles:true}));
        const noResults=picker.options.length===0;
        searchInput.value='';searchInput.dispatchEvent(new Event('input',{bubbles:true}));searchInput.blur();
        const scene=picker.value,scroller=$('.script-scroll');
        scroller.scrollTop=180;
        const beforeScroll=scroller.scrollTop;
        const text=[...document.querySelectorAll('#script-text p.action')].find(p=>p.textContent.startsWith('Maya')).firstChild,range=document.createRange();range.setStart(text,0);range.setEnd(text,4);
        getSelection().removeAllRanges();getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));
        $('#workspace-breakdown-tab').click();
        const field=$('[data-field="description"]');field.value='Unblurred portrait edit';field.dispatchEvent(new Event('input',{bubbles:true}));
        const breakdownScroller=$('.breakdown-scroll');breakdownScroller.scrollTop=120;const sheetScroll=breakdownScroller.scrollTop;
        $('#workspace-script-tab').click();
        const selected=getSelection().toString();
        const sameScroll=Math.abs(scroller.scrollTop-beforeScroll)<1;
        $('#workspace-breakdown-tab').click();
        const sameSheetScroll=Math.abs(breakdownScroller.scrollTop-sheetScroll)<1;
        $('#workspace-script-tab').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
        await window.productionDeskSave();
        const saved=await window.webkit.messageHandlers.scheduler.postMessage({operation:'load'});
        return {stableSearch,searchValue,noResults,sameNodes:script===$('#workspace-script')&&sheet===$('#workspace-breakdown'),sameScene:picker.value===scene,
          edit:field.value,savedEdit:saved.projects.find(p=>p.id===saved.activeProject).breakdowns.find(b=>b.id===scene).description,
          sameScroll,sameSheetScroll,selected,scriptScroll:beforeScroll,sheetScroll,tablet:!!window.productionDeskTablet};
        """, arguments:[:],in:nil,contentWorld:.page)
        let result = try XCTUnwrap(state as? [String:Any])
        let trace=XCTAttachment(string:String(describing:result));trace.name="Search identity and pane state";trace.lifetime = .keepAlways;add(trace)
        for key in ["sameNodes","sameScene","sameScroll","sameSheetScroll","stableSearch","noResults"] { XCTAssertEqual(result[key] as? Bool,true,key) }
        XCTAssertEqual(result["edit"] as? String,"Unblurred portrait edit")
        XCTAssertEqual(result["savedEdit"] as? String,"Unblurred portrait edit")
        XCTAssertEqual(result["selected"] as? String,"Maya")
        XCTAssertEqual(result["searchValue"] as? String,"harbour")
        XCTAssertGreaterThan(result["scriptScroll"] as? Double ?? 0,100)
        let bottomConstraint=try XCTUnwrap(desk.view.constraints.first { ($0.firstItem as? WKWebView) === desk.webView && $0.firstAttribute == .bottom })
        bottomConstraint.isActive=false
        let keyboardHeight=desk.webView.heightAnchor.constraint(equalToConstant:300)
        keyboardHeight.isActive=true;desk.view.layoutIfNeeded()
        try await Task.sleep(for:.milliseconds(200))
        let occluded=try await desk.webView.callAsyncJavaScript("""
        return {single:document.querySelector('#workspace-shell').classList.contains('single-pane'),
          portrait:window.productionDeskPortrait,webPortrait:matchMedia('(orientation:portrait)').matches,tablet:!!window.productionDeskTablet};
        """,arguments:[:],in:nil,contentWorld:.page)
        let occludedState=try XCTUnwrap(occluded as? [String:Any])
        XCTAssertEqual(occludedState["single"] as? Bool,occludedState["tablet"] as? Bool)
        XCTAssertEqual(occludedState["portrait"] as? Bool,true)
        XCTAssertEqual(occludedState["webPortrait"] as? Bool,false,"\(occludedState)")
        keyboardHeight.isActive=false;bottomConstraint.isActive=true;desk.view.layoutIfNeeded()

        for size in [CGSize(width:744,height:1133),CGSize(width:1032,height:1376),CGSize(width:1366,height:1024),CGSize(width:500,height:900),CGSize(width:700,height:500),CGSize(width:390,height:844)] {
            desk.view.frame=CGRect(origin:.zero,size:size);desk.view.layoutIfNeeded()
            try await Task.sleep(for:.milliseconds(200))
            let layout=try await desk.webView.callAsyncJavaScript("""
            const $=s=>document.querySelector(s),single=$('#workspace-shell').classList.contains('single-pane');
            const tabs=$('.workspace-tabs').getBoundingClientRect(),button=$('.workspace-toolbar [data-action=import]').getBoundingClientRect();
            return {single,expected:!!window.productionDeskTablet&&window.productionDeskPortrait===true&&innerWidth<=1100,nativePortrait:window.productionDeskPortrait,
              visible:[...document.querySelectorAll('.workspace > div')].filter(p=>!p.hidden).length,
              overflow:document.documentElement.scrollWidth>innerWidth+1,left:tabs.right<=button.left+1,
              scene:$('#scene-picker').value,width:innerWidth,height:innerHeight,
              guideAligned:(()=>{const ids=['settings-open','app-settings-open','help-open'];const r=ids.map(id=>document.getElementById(id).getBoundingClientRect());return innerWidth>1100?r.every(v=>Math.abs(v.left-r[0].left)<1):innerWidth<600||r.every(v=>Math.abs(v.top+v.height/2-r[0].top-r[0].height/2)<1)})()};
            """,arguments:[:],in:nil,contentWorld:.page)
            let v=try XCTUnwrap(layout as? [String:Any]);let single=v["single"] as? Bool == true
            XCTAssertEqual(single,v["expected"] as? Bool)
            XCTAssertEqual(v["nativePortrait"] as? Bool,size.height>=size.width)
            XCTAssertEqual(v["visible"] as? Int,single ? 1 : 2)
            XCTAssertEqual(v["guideAligned"] as? Bool,true)
            XCTAssertEqual(v["overflow"] as? Bool,false,"\(size): \(v)")
            if single {XCTAssertEqual(v["left"] as? Bool,true)}
        }
    }

    @MainActor func testDemoLoadEditRepeatPortableExportImportPreservesExistingProductions() async throws {
        let desk=try await openDesk()
        let result=try await desk.webView.callAsyncJavaScript("""
        const {nativeAPI}=await import('/native-platform.js');
        const {projectFile}=await import('/project-file.js');
        const $=s=>document.querySelector(s),clone=v=>structuredClone(v);
        const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
        const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
        const load=async()=>{$('#load-demo').click();for(let i=0;i<100&&$('#load-demo').disabled;i++)await new Promise(r=>setTimeout(r,25));await window.productionDeskSave();return nativeAPI('/api/workspace');};
        await window.productionDeskSave();const before=await nativeAPI('/api/workspace'),oldDemo=before.projects.find(p=>p._betaDemo?.key==='productiondesk.the-last-cue.v1');
        const first=await load(),demo=first.projects.find(p=>p.id===first.activeProject),demoID=demo.id;
        if(!demo._betaDemo)throw Error('Bundled demo did not load: '+$('#toast').textContent);
        const preserved=before.projects.every(p=>first.projects.some(q=>q.id===p.id&&same(p,q)));
        const field=$('[data-field="description"]');field.value='Demo rehearsal edit retained';field.dispatchEvent(new Event('input',{bubbles:true}));
        $('#content [data-action="edit-script"]').click();$('#edit-text').value+='\\n\\nMAYA\\nKeep this demo rehearsal note.';$('#edit-submit').click();
        await window.productionDeskSave();const edited=await nativeAPI('/api/workspace'),editedDemo=edited.projects.find(p=>p.id===demoID);
        const repeated=await load();
        const portable=projectFile({version:1,activeProject:demoID,projects:[clone(editedDemo)],_pdfDocuments:await window.webkit.messageHandlers.scheduler.postMessage({operation:'backupPDFs',workspace:{projects:[editedDemo]}})});
        const encoded=JSON.stringify(portable);
        await window.slateDesktop.importProjectFile(new File([encoded],'The-Last-Cue-edited.productiondesk',{type:'application/json'}));
        await window.productionDeskSave();const imported=await nativeAPI('/api/workspace'),copy=imported.projects.find(p=>p.id===imported.activeProject);
        return {preserved,count:first.projects.length,expected:before.projects.length+(oldDemo?0:1),
          repeatCount:repeated.projects.length,repeatID:repeated.activeProject===demoID,repeatEdits:same(repeated.projects.find(p=>p.id===demoID),editedDemo),
          source:editedDemo._sourceScript.text.includes('The Last Cue'),scenes:editedDemo.breakdowns.length,shots:editedDemo._shots.length,
          exportedEdit:portable.workspace.projects[0].breakdowns[0].description,
          importCount:imported.projects.length===repeated.projects.length+1,importName:copy.project.includes('imported copy'),
          importEdit:copy.breakdowns[0].description,importScript:copy.breakdowns[0]._scriptText.includes('Keep this demo rehearsal note.'),
          existingAfterImport:repeated.projects.every(p=>imported.projects.some(q=>q.id===p.id&&same(p,q))),portable:encoded};
        """,arguments:[:],in:nil,contentWorld:.page)
        let v=try XCTUnwrap(result as? [String:Any])
        for key in ["preserved","repeatID","repeatEdits","source","importCount","importName","importScript","existingAfterImport"] {XCTAssertEqual(v[key] as? Bool,true,key)}
        XCTAssertEqual(v["count"] as? Int,v["expected"] as? Int)
        XCTAssertEqual(v["repeatCount"] as? Int,v["count"] as? Int)
        XCTAssertEqual(v["scenes"] as? Int,3);XCTAssertEqual(v["shots"] as? Int,3)
        XCTAssertEqual(v["exportedEdit"] as? String,"Demo rehearsal edit retained")
        XCTAssertEqual(v["importEdit"] as? String,"Demo rehearsal edit retained")
        let fixture=XCTAttachment(string:try XCTUnwrap(v["portable"] as? String));fixture.name="The-Last-Cue-edited.productiondesk";fixture.lifetime = .keepAlways;add(fixture)
    }

}
