import AppKit
import WebKit

final class DesktopWebKitCheck: NSObject, WKNavigationDelegate {
    var web: WKWebView!
    var window: NSWindow!
    var phase = 0
    func start() {
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1440, height: 940))
        web.navigationDelegate = self
        window = NSWindow(contentRect: web.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.contentView = web
        window.title = "Production Desk regression checks"
        window.orderFront(nil)
        web.load(URLRequest(url: URL(string: CommandLine.arguments[1])!))
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) {
            print("FAIL: Native desktop regression check timed out")
            exit(1)
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let setup = """
        window.productionDeskTestFixture=JSON.parse(portableFixture);
        const waitFor=async check=>{const deadline=Date.now()+15000;while(!check()){if(Date.now()>deadline)throw Error('UI timed out');await new Promise(r=>setTimeout(r,50));}};
        const expect=(value,message)=>{if(!value)throw Error(message);};
        const load=async()=>{const w=await(await fetch('/api/workspace')).json();return w.projects.find(p=>p.id===w.activeProject);};
        await waitFor(()=>document.querySelector('#save-status').textContent.includes('Saved'));
        """
        let checks = """
        expect(!document.querySelector('#load-demo,#demo-guide,#demo-launcher'),'Shipping demo controls remain');
        const fresh=await(await fetch('/api/workspace')).json();
        expect(fresh.projects.length===1&&fresh.projects[0].breakdowns.length===0,'New workspace is not empty');
        expect((await fetch('/demo/the-last-light.productiondesk')).status===404,'Shipping demo script remains');
        const starter=JSON.parse(portableFixture);delete starter.workspace.projects[0]._linedScript;starter.workspace._pdfDocuments={};
        await window.slateDesktop.importProjectFile(new File([JSON.stringify(starter)],'Synthetic.productiondesk'));
        expect(await window.slateDesktop.flush(),'Synthetic QA fixture import failed');
        document.querySelector('#app-settings-open').click();
        document.querySelector('#report-bug').click();
        expect(document.querySelector('#support-report').open,'Bug report did not open');
        expect(document.querySelector('#support-email').hidden,'Blank report could open email');
        const description=document.querySelector('#support-description');
        description.value='Synthetic report & café';description.dispatchEvent(new Event('input',{bubbles:true}));
        const address=new URL(document.querySelector('#support-email').href);
        expect(address.protocol==='mailto:'&&address.pathname==='alexanderhosier@squidproductions.org','Wrong support recipient');
        expect(address.searchParams.get('body').includes('Synthetic report & café'),'Description was not encoded correctly');
        document.querySelector('#support-close').click();
        expect(document.querySelector('#app-settings')&&document.querySelector('#modal').open,'Reporting closed Settings');
        window.dispatchEvent(new ErrorEvent('error',{message:'Synthetic native WebKit crash',filename:location.origin+'/app.js?private=value',lineno:24}));
        await waitFor(()=>!document.querySelector('#support-notice').hidden);
        document.querySelector('#report-crash').click();
        expect(document.querySelector('#support-report pre').textContent.includes('Synthetic native WebKit crash'),'Crash details missing');
        expect(!document.querySelector('#support-report pre').textContent.includes('private=value'),'URL query leaked into diagnostics');
        await new Promise(resolve=>setTimeout(resolve,200));
        expect((await(await fetch('/api/support')).json()).report.message==='Synthetic native WebKit crash','Crash was not stored on disk');
        document.querySelector('#support-discard').click();
        await waitFor(()=>document.querySelector('#support-status').textContent==='Saved crash report dismissed.');
        expect((await(await fetch('/api/support')).json()).report===null,'Dismissed crash report remained pending');
        document.querySelector('#support-close').click();document.querySelector('#modal-close').click();
        document.querySelector('[data-view="elements"]').click();
        let input=document.querySelector('[data-element-name]');input.focus();input.value='Native saved element';input.dispatchEvent(new Event('input',{bubbles:true}));
        expect(await window.slateDesktop.prepareForUpdate(),'Focused element update preparation failed');
        expect((await load()).elements[0].name==='Native saved element','Focused element name was lost');
        input=document.querySelector('[data-element-id]');input.focus();input.value='NATIVE42';input.dispatchEvent(new Event('input',{bubbles:true}));
        expect(await window.slateDesktop.flush(),'Board ID flush failed');
        expect((await load()).elements[0].elementId==='NATIVE42','Focused board ID was lost');
        document.querySelector('[data-view="shots"]').click();
        for(const number of ['NATIVE1','NATIVE2']){
          document.querySelector('#add-scene').click();document.querySelector('#new-shot-number').value=number;
          const draft=document.querySelector('#new-shot-description');draft.value='Native regression shot';draft.focus();
          expect(!await window.slateDesktop.prepareForUpdate(),'Update discarded an open editor draft');
          expect(document.querySelector('#modal').open&&draft.value==='Native regression shot','Blocked update altered the draft');
          expect(!(await load())._shots.some(s=>s.number===number),'Unsubmitted draft unexpectedly committed');
          document.querySelector('#new-shot-save').click();
          expect(await window.slateDesktop.prepareForUpdate(),'Submitted editor draft could not be saved before updating');
          expect((await load())._shots.some(s=>s.number===number),'Submitted editor draft was not persisted');
        }
        for(const value of [' ',' native1 ']){
          input=document.querySelector('[data-shot-field="number"]');input.focus();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
          expect(await window.slateDesktop.flush(),'Invalid shot number blocked saves');
          expect((await load())._shots.some(s=>s.number==='NATIVE2'),'Invalid shot number overwrote valid data');
        }
        const post=(body)=>fetch('/api/import',{method:'POST',headers:{'X-Slate-Local':'1','X-Filename':'native.json'},body:JSON.stringify(body)});
        for(const body of [[],null,1]){const response=await post(body);expect(response.status===400,'Malformed import did not return 400');expect(typeof(await response.json()).error==='string','Missing import error');}
        const p=await load();p.id=crypto.randomUUID();p.project='Native restored backup';p.stripboards=[];
        const backup={version:1,projects:[p],activeProject:p.id};
        window.slateDesktop.importScript();
        const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(backup)],'native-backup.json',{type:'application/json'}));
        document.querySelector('#import-file').files=transfer.files;document.querySelector('#import-submit').click();
        await waitFor(()=>!document.querySelector('#modal').open);
        document.querySelector('[data-view="schedule"]').click();document.querySelector('[data-action="add-day"]').click();
        expect(document.querySelectorAll('.day-block').length===1,'Restored schedule could not add a day');
        document.querySelector('#add-scene').click();document.querySelector('[data-field="modal-value"]').value='NATIVE';document.querySelector('#modal-ok').click();
        expect(await window.slateDesktop.flush(),'Restored schedule could not save');
        expect((await load()).breakdowns.some(b=>b.scene==='NATIVE'),'New scene was not saved');
        const priorCount=document.querySelector('#project-picker').options.length;
        let projectDownload;
        const anchorClick=HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click=function(){if(this.href.includes('/api/download/')){projectDownload=this.href;return;}return anchorClick.call(this);};
        document.querySelector('#save-as-open').click();
        await waitFor(()=>!!projectDownload);
        const portable=await(await fetch(projectDownload)).json();
        expect(portable.format==='org.squidproductions.productiondesk.project'&&portable.formatVersion===1,'Save As did not produce a versioned Production Desk file');
        expect(portable.workspace.projects.length===1&&portable.workspace.projects[0].breakdowns.some(b=>b.scene==='NATIVE'),'Save As lost production fields');
        await window.slateDesktop.importProjectFile(new File([JSON.stringify(portable)],'Native.productiondesk'));
        expect(document.querySelector('#project-picker').options.length===priorCount+1,'Portable import replaced an existing production');
        expect(document.querySelector('#project-title').textContent.includes('imported copy'),'Duplicate portable import was not labeled');
        document.querySelector('#undo').click();expect(await window.slateDesktop.flush(),'Portable import undo did not save');
        expect(document.querySelector('#project-picker').options.length===priorCount,'Undo did not preserve the original workspace');
        HTMLAnchorElement.prototype.click=anchorClick;
        return true;
        """
        let reloadChecks = """
        expect(document.querySelector('#project-title').textContent==='Native restored backup','Imported production did not survive reload');
        expect((await load()).breakdowns.some(b=>b.scene==='NATIVE'),'Scene did not survive reload');
        document.querySelector('[data-view="schedule"]').click();
        expect(document.querySelectorAll('.day-block').length===1,'Shooting day did not survive reload');
        return true;
        """
        let root = URL(fileURLWithPath: CommandLine.arguments[2])
        let portableFixture = try! String(contentsOf: root.appendingPathComponent("tests/fixtures/demo/the-last-light.productiondesk"), encoding: .utf8)
        let fixture = try! Data(contentsOf: root.appendingPathComponent("tests/lined-script.pdf")).base64EncodedString()
        let testSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/lined-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let layoutSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/workspace-layout-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let breakdownSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/breakdown-editing-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let pdfSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/script-pdf-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let controlsSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/lined-controls-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let navigationSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/shot-navigation-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let scheduleSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/schedule-drag-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let importSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/project-import-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let viewportSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/viewport-followup-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let shotOrderSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/shot-order-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let exportSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/export-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let linedChecks = "const runLinedChecks = " + testSource + "; const runLayoutChecks = " + layoutSource + "; const prior = await runLinedChecks(fixture); const added = await runLayoutChecks(); const runBreakdownChecks = " + breakdownSource + "; const breakdown = await runBreakdownChecks(); const runPDFChecks = " + pdfSource + "; const pdfChecks = await runPDFChecks(); const runControlsChecks = "+controlsSource+"; const controls = await runControlsChecks(); const runNavigationChecks = "+navigationSource+"; const navigation = await runNavigationChecks(); const runScheduleChecks = "+scheduleSource+"; const schedule = await runScheduleChecks(); const runImportChecks = "+importSource+"; const imports = await runImportChecks(); const runViewportChecks = "+viewportSource+"; const viewport = await runViewportChecks(); const runShotOrderChecks = "+shotOrderSource+"; const shotOrder = await runShotOrderChecks(); const runExportChecks = "+exportSource+"; const exports = await runExportChecks(); return {breakdownCSV:window.exportCheckCSV,portableProject:window.exportCheckProject,sourceProject:window.exportCheckSource,checks:[...window.tabOrderChecks,...exports,...shotOrder,...prior,...added,...breakdown,...pdfChecks,...controls,...navigation,...schedule,...imports,...viewport],pdf:window.workspaceLayoutExport.content};"
        let tabOrderSource = try! String(contentsOf: root.appendingPathComponent("desktop/windows/navigation-order-regressions.cjs"), encoding: .utf8).replacingOccurrences(of: "module.exports = ", with: "")
        let tabOrder = "const runTabOrderChecks = " + tabOrderSource + ";"
        let firstChecks = checks.replacingOccurrences(of: "return true;", with: "window.tabOrderChecks = await runTabOrderChecks({leaveCustom:true}); return true;")
        let afterReload = "window.tabOrderChecks = await runTabOrderChecks({afterReload:true});"
        let body = setup + tabOrder + (phase == 0 ? firstChecks : afterReload + reloadChecks.replacingOccurrences(of: "return true;", with: "") + linedChecks)
        web.callAsyncJavaScript("try {" + body + "} catch(error) { throw new Error((error && error.stack) || String(error)); }", arguments: ["fixture":fixture,"testSource":testSource,"portableFixture":portableFixture], in: nil, in: .page) { result in
            switch result {
            case .failure(let error): print("FAIL: \(error)"); exit(1)
            case .success(let value):
                if self.phase == 0 { self.phase = 1; self.web.reload() }
                else {
                    if let report = value as? [String:Any] {
                        let output = root.appendingPathComponent("build/export-check")
                        try! FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
                        for (key,name) in [("breakdownCSV","breakdowns.csv"),("portableProject","rich-session.productiondesk"),("sourceProject","source-project.json")] {
                            if let text = report[key] as? String { try! text.write(to: output.appendingPathComponent(name), atomically: true, encoding: .utf8) }
                        }
                    }
                    print("Native macOS WebKit verified: focused edits saved before updates, open dialog drafts block updates intact, submitted drafts persisted, valid shot-number persistence, malformed imports, repaired schedules, portable Save As/import/collision/Undo, save and reload.")
                    if let report = value as? [String:Any], let encoded = report["pdf"] as? String, let pdf = Data(base64Encoded:encoded) {
                        let output = root.appendingPathComponent("build/lined-check")
                        try! FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
                        try! pdf.write(to: output.appendingPathComponent("mac-lined-script.pdf"))
                        print("Native lined-script checks: \(report["checks"] ?? [])")
                    }
                    exit(0)
                }
            }
        }
    }
}

@main
struct DesktopWebKitMain {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let check = DesktopWebKitCheck()
        check.start()
        withExtendedLifetime(check) { app.run() }
    }
}
