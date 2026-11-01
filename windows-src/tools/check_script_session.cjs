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
 for(const viewport of [{width:1280,height:800},{width:900,height:650},{width:700,height:560}]){
   await page.setViewportSize(viewport);
   for(const theme of ['light','dark']){
     await page.click('#app-settings-open');await page.locator('[data-theme-choice="'+theme+'"]').click();await page.waitForFunction(()=>!document.querySelector('[data-theme-choice="light"]').disabled);
     await page.locator('#lined-show-movement').scrollIntoViewIfNeeded();const layout=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.lined-annotation-option')].map(e=>e.getBoundingClientRect()),button=document.querySelector('#lined-key-binds').getBoundingClientRect(),dialog=document.querySelector('#modal');return {gap:rows[1].top-rows[0].bottom,buttonGap:button.top-rows[1].bottom,scrolls:dialog.scrollHeight>dialog.clientHeight,overflow:dialog.scrollWidth>dialog.clientWidth+1};});assert.ok(layout.gap>=7&&layout.buttonGap>=16&&!layout.overflow);
     await page.locator('#lined-show-movement').click();await page.waitForFunction(()=>!document.querySelector('#lined-show-movement').disabled);await page.locator('#lined-show-movement').click();await page.waitForFunction(()=>!document.querySelector('#lined-show-movement').disabled);
     if(viewport.width===700)await page.screenshot({path:path.join(out,'settings-small-'+theme+'.png')});
     if(viewport.height<=650){assert.ok(layout.scrolls,'Small Settings dialog should scroll');const scrolled=await page.locator('#modal').evaluate(e=>{e.scrollTop=e.scrollHeight;const end=e.querySelector('.lined-settings > p:last-child').getBoundingClientRect();return {top:e.scrollTop,end:end.bottom,bottom:e.getBoundingClientRect().bottom};});assert.ok(scrolled.top>0&&scrolled.end<=scrolled.bottom,'Bottom Settings content must be reachable');}
     await page.mouse.click(4,4);assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
   }
 }
 await page.setViewportSize({width:1660,height:1080});await page.click('#app-settings-open');await page.click('[data-theme-choice="light"]');await page.waitForFunction(()=>!document.querySelector('[data-theme-choice="light"]').disabled);await page.click('#modal-close');
 checks.push('Settings spacing, scrolling, toggles and outside dismissal pass at 1280×800, 900×650 and 700×560 in light and dark themes');
 checks.push('Reload preserves production, annotation options and numbering baseline (next 3.5)');assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({passed:true,checks,evidence,pageErrors:errors},null,2));console.log(JSON.stringify({passed:true,checks,evidence},null,2));
 }finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e.stack,log);process.exitCode=1;});
