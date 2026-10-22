#!/usr/bin/env node
// Run browser modules on a disposable workspace; no installed app or production data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'pd-lined-')),ready=path.join(temp,'ready.json');
const server=spawn(process.env.PYTHON||'python3',['-B',path.join(root,'server.py'),'--port','0','--data',path.join(temp,'workspace.json'),'--ready-file',ready]);
fs.mkdirSync(path.join(root,'build'),{recursive:true});
let browser,log='';server.stderr.on('data',v=>log+=v);
(async()=>{try{
  for(let i=0;i<200&&!fs.existsSync(ready);i++)await new Promise(r=>setTimeout(r,50));
  if(!fs.existsSync(ready))throw Error('Local server failed: '+log);
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:1660,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(JSON.parse(fs.readFileSync(ready)).url);await page.evaluate(()=>window.slateDesktop.ready);
  const checks=[],fixture=fs.readFileSync(path.join(root,'tests/lined-script.pdf')).toString('base64');
  if(process.argv.includes('--all')){
    checks.push(...await require('../desktop/windows/regressions.cjs')({
      js:source=>page.evaluate(source),flush:()=>page.evaluate(()=>window.slateDesktop.flush()),
      waitFor:source=>page.waitForFunction(source),
      readWorkspace:()=>page.evaluate(async()=>await(await fetch('/api/workspace')).json()),
      post:async(route,body,headers={})=>{
        const value=await page.evaluate(async({route,body,headers})=>{const response=await fetch(route,{method:'POST',headers:{'X-Slate-Local':'1',...headers},body});return {status:response.status,body:await response.json()};},{route,body,headers});
        return {status:value.status,json:async()=>value.body};
      },
      reload:async()=>{await page.reload();await page.evaluate(()=>window.slateDesktop.ready);}
    }));
    for(const module of ['lined','workspace-layout','breakdown-editing','script-pdf'])checks.push(...await page.evaluate('('+require('../desktop/windows/'+module+'-regressions.cjs').toString()+')('+JSON.stringify(fixture)+')'));
  }
  checks.push(...await page.evaluate('('+require('../desktop/windows/lined-controls-regressions.cjs').toString()+')()'));
  // Real browser keyboard, mouse and resize checks supplement synthetic native tests.
  await page.locator('#lined-description').fill('Keyboard focus c');
  await page.locator('#lined-description').press('c');
  assert.equal(await page.locator('#lined-description').inputValue(),'Keyboard focus cc');
  assert.equal(await page.locator('[data-lined-tool="select"]').getAttribute('aria-pressed'),'true');
  await page.locator('#lined-description').press('Tab');
  await page.locator('[data-lined-tool="select"]').focus();
  await page.keyboard.press('k');assert.equal(await page.locator('[data-lined-tool="coverage"]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('v');
  await page.locator('#lined-note').fill('Real keyboard deep edit');await page.locator('[data-lined-tool="select"]').focus();
  const top=await page.locator('#lined-scroll').evaluate(e=>e.scrollTop);
  for(const chord of ['Meta+z','Meta+Shift+z','Control+z','Control+Shift+z']){await page.keyboard.press(chord);assert.equal(await page.locator('#lined-scroll').evaluate(e=>e.scrollTop),top);}
  await page.setViewportSize({width:1240,height:900});await page.setViewportSize({width:1660,height:1080});
  // Use actual mouse input to move a selected label into the left gutter.
  await page.locator('#lined-scroll').evaluate(e=>e.scrollLeft=0);
  await page.locator('.lined-selected .lined-info-box').scrollIntoViewIfNeeded();
  const box=await page.locator('.lined-selected .lined-info-box').boundingBox();
  const paper=await page.locator('.lined-page').boundingBox();
  await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();
  await page.mouse.move(paper.x-100,box.y+15,{steps:12});await page.mouse.up();
  assert.ok(await page.locator('.lined-selected .lined-info-box').evaluate(e=>Number(e.getAttribute('x'))<0));
  await page.evaluate(()=>window.slateDesktop.flush());
  const saved=await page.evaluate(async()=>await(await fetch('/api/workspace')).json());
  await page.screenshot({path:path.join(root,'build/lined-controls.png'),fullPage:true});
  await page.reload();await page.evaluate(()=>window.slateDesktop.ready);await page.click('[data-view="lined"]');
  await page.waitForFunction(()=>!!document.querySelector('#lined-overlay')?.onpointerdown);
  const reopened=await page.evaluate(async()=>await(await fetch('/api/workspace')).json());assert.deepEqual(reopened,saved);
  await page.click('#app-settings-open');await page.click('#lined-key-binds');
  assert.equal(await page.locator('[data-lined-binding="coverage"]').inputValue(),'k');
  assert.deepEqual(errors,[]);checks.push('Real keyboard focus, Cmd/Ctrl undo/redo, browser resize, save/reopen and key-bind persistence');
  console.log(JSON.stringify({checks,pageErrors:errors},null,2));
}catch(error){console.error(error.stack);process.exitCode=1;}
finally{await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}fs.rmSync(temp,{recursive:true,force:true});}})();
