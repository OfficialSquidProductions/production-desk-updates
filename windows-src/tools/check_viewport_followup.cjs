#!/usr/bin/env node
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),runtime=process.env.PRODUCTION_DESK_RUNTIME?path.resolve(process.env.PRODUCTION_DESK_RUNTIME):root;
const output=path.join(root,'build/viewport-followup-review'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'pd-viewport-handoff-'));fs.mkdirSync(output,{recursive:true});
const processes=[];let browser;
async function start(name){
 const folder=path.join(temp,name);fs.mkdirSync(folder,{recursive:true});const ready=path.join(folder,'ready.json');if(fs.existsSync(ready))fs.unlinkSync(ready);const log=fs.openSync(path.join(folder,'server.log'),'a');
 const child=spawn(process.env.PYTHON||'python3',['-B',path.join(runtime,'server.py'),'--port','0','--data',path.join(folder,'workspace.json'),'--ready-file',ready],{stdio:['ignore',log,log]});processes.push(child);fs.closeSync(log);
 for(let i=0;i<300&&!fs.existsSync(ready);i++){if(child.exitCode!==null)throw Error('Disposable backend exited');await new Promise(r=>setTimeout(r,30));}
 assert.ok(fs.existsSync(ready),'Disposable backend did not start');return {child,folder,url:JSON.parse(fs.readFileSync(ready)).url};
}
async function stop(child){if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r));}}
async function load(page,profile){await page.goto(profile.url);await page.evaluate(()=>window.slateDesktop.ready);}
async function read(page){assert.equal(await page.evaluate(()=>window.slateDesktop.flush()),true);return page.evaluate(async()=>await(await fetch('/api/workspace')).json());}
const active=w=>w.projects.find(p=>p.id===w.activeProject);
(async()=>{try{
 const sender=await start('sender'),recipient=await start('recipient');browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const first=await browser.newContext({viewport:{width:1660,height:1080}}),page=await first.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await load(page,sender);
 const checks=await page.evaluate('('+require('../desktop/windows/viewport-followup-regressions.cjs').toString()+')()');
 const portable=await page.evaluate(()=>window.viewportFollowupPortable),expected=await page.evaluate(()=>window.viewportFollowupSource),pdf=await page.evaluate(()=>window.viewportFollowupPDF);
 assert.ok(!JSON.stringify(portable).includes(sender.folder),'Portable file leaked sender-local storage path');
 fs.writeFileSync(path.join(output,'gutter-export.png'),Buffer.from((await page.evaluate(()=>window.viewportFollowupRaster)).split(',')[1],'base64'));fs.writeFileSync(path.join(output,'sender.productiondesk'),JSON.stringify(portable));fs.writeFileSync(path.join(output,'gutter-export.pdf'),Buffer.from(pdf.content,'base64'));
 // Check actual layout at narrow/wide windows and CSS scaling, beyond DOM order.
 for(const [width,height,zoom] of [[1660,1080,1],[720,800,1],[1024,800,1.5],[560,850,1]]){
  await page.setViewportSize({width,height});await page.evaluate(zoom=>{document.documentElement.style.zoom=String(zoom);document.querySelector('#app-settings-open').click();},zoom);
  const layout=await page.evaluate(()=>{const r=e=>{const v=e.getBoundingClientRect();return {left:v.left,right:v.right,top:v.top,bottom:v.bottom};};return {button:r(document.querySelector('#lined-key-binds')),label:r(document.querySelector('label[for="lined-label-opacity"]')),slider:r(document.querySelector('#lined-label-opacity')),panel:r(document.querySelector('.modal-body'))};});
  assert.ok(layout.button.bottom+8<=layout.label.top&&layout.label.bottom<=layout.slider.top,'Settings overlap at '+width+' / '+zoom);assert.ok(layout.slider.right<=layout.panel.right+1&&layout.slider.left>=layout.panel.left,'Opacity escapes modal at '+width);
  await page.screenshot({path:path.join(output,'settings-'+width+'-'+zoom+'.png')});
  await page.evaluate(()=>document.querySelector('#modal-close').click());
 }
 await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:1660,height:1080});
 checks.push('Actual Settings geometry is separated at 560/720/1024/1660px and 150% scaling');
 await page.screenshot({path:path.join(output,'sender-gutter-labels.png'),fullPage:true});
 await first.close();await stop(sender.child);fs.rmSync(sender.folder,{recursive:true,force:true});
 // Recipient has separate browser/localStorage and backend/settings/PDF storage.
 const second=await browser.newContext({viewport:{width:1440,height:1000}}),received=await second.newPage();received.on('pageerror',e=>errors.push(e.message));await load(received,recipient);
 await received.evaluate(value=>window.slateDesktop.importProjectFile(new File([JSON.stringify(value)],'Transferred.productiondesk')),portable);
 let state=await read(received);assert.deepEqual(active(state),expected,'Cross-profile import changed complete production/IDs/settings');
 for(const [hash,encoded] of Object.entries(portable.workspace._pdfDocuments)){
  const raw=await received.evaluate(async hash=>{const response=await fetch('/api/pdf/'+hash),bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);},hash);assert.equal(raw,encoded,'Recipient PDF differs');
 }
 assert.equal(await received.locator('#breakdown-continuous').isChecked(),true);
 await received.click('[data-view="shots"]');const shot=active(state)._shots[0];await received.click('[data-shot-select="'+shot.id+'"]');await received.locator('[data-shot-field="notes"]').fill('Recipient continues editing after independent handoff');
 await received.click('[data-view="lined"]');await received.waitForFunction(()=>!!document.querySelector('#lined-overlay')?.onpointerdown);
 const mark=active(state)._linedScript.documents.find(d=>d.sha256===active(state)._linedScript.activePdf).marks[0];
 await received.selectOption('#lined-zoom','1.5');await received.waitForFunction(()=>!!document.querySelector('#lined-overlay')?.onpointerdown);
 const label=received.locator('[data-lined-mark="'+mark.id+'"] .lined-info-box');await label.scrollIntoViewIfNeeded();const box=await label.boundingBox();
 await received.mouse.move(box.x+10,box.y+8);await received.mouse.down();await received.mouse.move(box.x+50,box.y+24,{steps:12});await received.mouse.up();
 state=await read(received);assert.equal(active(state)._shots.find(s=>s.id===shot.id).notes,'Recipient continues editing after independent handoff');
 const after=active(state)._linedScript.documents.find(d=>d.sha256===active(state)._linedScript.activePdf).marks[0];assert.notDeepEqual(after.labelAt,mark.labelAt,'Recipient label was not editable');assert.equal(after.shotId,mark.shotId);
 const changed=structuredClone(expected);changed._shots.find(s=>s.id===shot.id).notes='Recipient continues editing after independent handoff';changed._linedScript.documents.find(d=>d.sha256===changed._linedScript.activePdf).marks[0].labelAt=after.labelAt;
 assert.deepEqual(active(state),changed,'Recipient editing changed unrelated metadata or relationships');
 await received.reload();await received.evaluate(()=>window.slateDesktop.ready);assert.deepEqual(await read(received),state,'Recipient save/reopen lost data');
 await received.screenshot({path:path.join(output,'recipient-reopened.png'),fullPage:true});
 await stop(recipient.child);const reopened=await start('recipient');await load(received,reopened);assert.deepEqual(await read(received),state,'Recipient backend restart lost project/assets');
 for(const [hash,encoded] of Object.entries(portable.workspace._pdfDocuments)){const response=await received.request.get(reopened.url+'/api/pdf/'+hash);assert.equal((await response.body()).toString('base64'),encoded,'Recipient restart lost original PDF asset');}
 checks.push('Two independent profiles: real Save As → sender removed → recipient import retains every field, stable ID, both PDF revisions and project view mode without sender paths; recipient edits/zoom/label drag and save/reopen/backend restart succeed');
 assert.deepEqual(errors,[]);const result={checks,pageErrors:errors,portablePDFs:Object.keys(portable.workspace._pdfDocuments).length,senderStorageRemoved:true,recipientEditable:true};fs.writeFileSync(path.join(output,'handoff-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.stack);process.exitCode=1;}
finally{await browser?.close();for(const process of processes)await stop(process);fs.rmSync(temp,{recursive:true,force:true});}})();
