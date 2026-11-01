const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),runtime=process.env.PRODUCTION_DESK_RUNTIME||root,out=process.env.PRODUCTION_DESK_TEST_OUTPUT||path.join(root,'build/mac-script-fixes');fs.mkdirSync(out,{recursive:true});const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pd-script-fixes-')),ready=path.join(temp,'ready.json');
const server=spawn(process.env.PYTHON||'python3',['-B',path.join(runtime,'server.py'),'--port','0','--data',path.join(temp,'workspace.json'),'--ready-file',ready]);let browser,log='';server.stderr.on('data',v=>log+=v);
(async()=>{try{
 for(let i=0;i<200&&!fs.existsSync(ready);i++)await new Promise(r=>setTimeout(r,50));assert.ok(fs.existsSync(ready),log);
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'});const page=await browser.newPage({viewport:{width:1660,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(JSON.parse(fs.readFileSync(ready)).url);await page.evaluate(()=>window.slateDesktop.ready);
 const checks=await page.evaluate('('+require('../desktop/windows/script-session-regressions.cjs').toString()+')()');
 const dialogChecks=await page.evaluate('('+require('../desktop/windows/settings-dialog-regressions.cjs').toString()+')()');checks.push(...dialogChecks);
 const evidence=await page.evaluate(()=>window.scriptFixEvidence),exports=await page.evaluate(()=>window.scriptFixExports);for(const [i,v] of exports.entries())fs.writeFileSync(path.join(out,'annotations-'+i+'.pdf'),Buffer.from(v.content,'base64'));
 await page.screenshot({path:path.join(out,'annotations-browser.png'),fullPage:true});const before=await page.evaluate(async()=>await(await fetch('/api/workspace')).json());
 await page.reload();await page.evaluate(()=>window.slateDesktop.ready);const after=await page.evaluate(async()=>await(await fetch('/api/workspace')).json());assert.deepEqual(after,before);
 await page.click('[data-view="lined"]');await page.waitForFunction(()=>!!document.querySelector('#lined-overlay')?.onpointerdown);assert.ok((await page.locator('#lined-overlay').textContent()).includes('DESCRIPTION END'));
 await page.click('#app-settings-open');assert.equal(await page.isChecked('#lined-show-movement'),true);assert.equal(await page.isChecked('#lined-show-description'),true);assert.ok((await page.locator('#lined-show-movement').boundingBox()).width<30,'Annotation checkbox should keep its native width');await page.screenshot({path:path.join(out,'annotation-settings.png')});await page.click('#modal-close');
 const next=await page.evaluate(async()=>{const w=await(await fetch('/api/workspace')).json(),p=w.projects.find(p=>p.id===w.activeProject);return (await import('/shot-identifiers.js')).nextLinedShotNumber(p,p.breakdowns[0].id);});assert.equal(next,'3.5');assert.deepEqual(errors,[]);
 for(const selector of ['#app-settings-open','#settings-open'])for(let i=0;i<3;i++){
   await page.click(selector);await page.locator('#modal h2').click();assert.ok(await page.locator('#modal').evaluate(e=>e.open));
   if(i===0){const box=await page.locator('#modal h2').boundingBox();await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(4,4);await page.mouse.up();assert.ok(await page.locator('#modal').evaluate(e=>e.open),'Dragging from inside must not dismiss');}
   const button=await page.locator('#new-open').boundingBox();await page.mouse.click(button.x+button.width/2,button.y+button.height/2);assert.equal(await page.locator('#modal').evaluate(e=>e.open),false,'Outside click must close without opening New production');
   await page.click(selector);await page.click('#modal-close');assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
 }
 await page.click('#new-open');await page.mouse.click(4,4);assert.ok(await page.locator('#modal').evaluate(e=>e.open),'Other edit dialogs should keep their drafts');await page.click('#modal-close');
 checks.push('Real mouse: inside clicks and inside-to-outside drags stay open; outside clicks over New production close without click-through; X and repeated openings work in both Settings dialogs');
 checks.push('Reload preserves production, annotation options and numbering baseline (next 3.5)');fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({passed:true,checks,evidence,pageErrors:errors},null,2));console.log(JSON.stringify({passed:true,checks,evidence},null,2));
 }finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e.stack,log);process.exitCode=1;});
