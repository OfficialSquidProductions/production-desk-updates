#!/usr/bin/env node
// Run browser modules on a disposable workspace; no installed app or production data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'pd-lined-')),ready=path.join(temp,'ready.json');
const runtime=process.env.PRODUCTION_DESK_RUNTIME?path.resolve(process.env.PRODUCTION_DESK_RUNTIME):root;
const server=spawn(process.env.PYTHON||'python3',['-B',path.join(runtime,'server.py'),'--port','0','--data',path.join(temp,'workspace.json'),'--ready-file',ready]);
fs.mkdirSync(path.join(root,'build'),{recursive:true});
let browser,log='';server.stderr.on('data',v=>log+=v);
(async()=>{try{
  for(let i=0;i<200&&!fs.existsSync(ready);i++)await new Promise(r=>setTimeout(r,50));
  if(!fs.existsSync(ready))throw Error('Local server failed: '+log);
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:1660,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const baseline=process.argv.indexOf('--baseline-shots');
  if(baseline>=0){
    const reference=process.argv[baseline+1];if(!reference)throw Error('Pass a commit after --baseline-shots');
    const original=execFileSync('git',['show',reference+':windows-src/web/shots.js'],{cwd:root,encoding:'utf8'});
    await page.route('**/shots.js',route=>route.fulfill({contentType:'text/javascript',body:original}));
  }
  const boardBaseline=process.argv.indexOf('--baseline-board');
  if(boardBaseline>=0){const ref=process.argv[boardBaseline+1];if(!ref)throw Error('Pass a commit after --baseline-board');const original=execFileSync('git',['show',ref+':windows-src/web/app.js'],{cwd:root,encoding:'utf8'});await page.route('**/app.js',route=>route.fulfill({contentType:'text/javascript',body:original}));}
  await page.goto(JSON.parse(fs.readFileSync(ready)).url);await page.evaluate(()=>window.slateDesktop.ready);
  const checks=[],fixture=fs.readFileSync(path.join(root,'tests/lined-script.pdf')).toString('base64');
  if(process.argv.includes('--all')){
    checks.push(...await require('../desktop/windows/regressions.cjs')({
      js:source=>page.evaluate(source),flush:()=>page.evaluate(()=>window.slateDesktop.flush()),
      waitFor:async source=>{const deadline=Date.now()+15000;while(!await page.evaluate(source)){if(Date.now()>deadline)throw Error('UI timed out: '+source);await new Promise(r=>setTimeout(r,30));}},
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
  await page.click('#modal-close');
  checks.push(...await page.evaluate('('+require('../desktop/windows/shot-navigation-regressions.cjs').toString()+')()'));
  // Exercise actual pointer focus and browser key defaults in a deep shot list.
  const shotRows=page.locator('#shot-list [data-shot-select]');
  await page.locator('#shot-list').evaluate(list=>{const row=list.querySelectorAll('[data-shot]')[300];list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top-40;});
  const clickTop=await page.locator('#shot-list').evaluate(e=>e.scrollTop);
  await shotRows.nth(300).click();assert.equal(await page.locator('#shot-list').evaluate(e=>e.scrollTop),clickTop);
  await shotRows.nth(301).click();assert.equal(await page.locator('#shot-list').evaluate(e=>e.scrollTop),clickTop);
  for(let i=0;i<24;i++)await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('#shot-list .selected').getAttribute('data-shot'),await shotRows.nth(325).getAttribute('data-shot-select'));
  const active=await page.locator('#shot-list .selected').getAttribute('data-shot');
  await page.locator('[data-shot-field="notes"]').fill('Real keyboard navigation notes\nSecond review line');
  await page.locator('[data-shot-field="notes"]').press('ArrowUp');assert.equal(await page.locator('#shot-list .selected').getAttribute('data-shot'),active);
  const minutes=page.locator('[data-shot-field="setupMinutes"]'),prior=Number(await minutes.inputValue());await minutes.press('ArrowUp');
  assert.equal(Number(await minutes.inputValue()),prior+1);assert.equal(await page.locator('#shot-list .selected').getAttribute('data-shot'),active);
  await page.evaluate(()=>window.slateDesktop.flush());
  const shotSaved=await page.evaluate(async()=>await(await fetch('/api/workspace')).json());
  await page.locator('#shot-list .selected [data-shot-select]').focus();await page.screenshot({path:path.join(root,'build/shot-navigation.png'),fullPage:true});
  await page.reload();await page.evaluate(()=>window.slateDesktop.ready);await page.click('[data-view="shots"]');
  assert.deepEqual(await page.evaluate(async()=>await(await fetch('/api/workspace')).json()),shotSaved);
  await page.locator('#shot-list').evaluate(list=>{const row=list.querySelectorAll('[data-shot]')[325];list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top-40;});
  await shotRows.nth(325).click();assert.equal(await page.locator('[data-shot-field="notes"]').inputValue(),'Real keyboard navigation notes\nSecond review line');
  const reopenedTop=await page.locator('#shot-list').evaluate(e=>e.scrollTop);await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator('#shot-list .selected').getAttribute('data-shot'),await shotRows.nth(324).getAttribute('data-shot-select'));
  assert.ok(await page.locator('#shot-list').evaluate(e=>e.scrollTop)>20000);assert.ok(reopenedTop>20000);
  checks.push('Real mouse selection and 24 successive keyboard moves stay deep in the list; textarea arrows and numeric steppers edit without switching shots; saved edits/order survive page reload and navigation resumes');
  checks.push(...await page.evaluate('('+require('../desktop/windows/schedule-drag-regressions.cjs').toString()+')()'));
  // Real native HTML drag from broad strip content, then from the explicit handle.
  const firstDay=page.locator('.day-block').first(),dayRows=firstDay.locator('[data-strip]');
  await firstDay.locator('[data-zone="day"]').evaluate(zone=>{const pane=zone.closest('.board-scroll');pane.scrollTop+=zone.getBoundingClientRect().top-pane.getBoundingClientRect().top-35;});
  const firstID=await dayRows.nth(0).getAttribute('data-strip'),secondID=await dayRows.nth(1).getAttribute('data-strip');
  let targetBox=await dayRows.nth(1).boundingBox();
  await dayRows.nth(0).locator('.strip-heading').dragTo(dayRows.nth(1),{targetPosition:{x:targetBox.width*.55,y:targetBox.height*.8}});
  assert.equal(await dayRows.nth(0).getAttribute('data-strip'),secondID);assert.equal(await dayRows.nth(1).getAttribute('data-strip'),firstID);
  assert.equal(await page.locator('[data-view="schedule"]').getAttribute('class'),'active');
  targetBox=await dayRows.nth(0).boundingBox();
  await dayRows.nth(1).locator('[data-move-strip]').dragTo(dayRows.nth(0),{targetPosition:{x:targetBox.width*.55,y:targetBox.height*.2}});
  assert.equal(await dayRows.nth(0).getAttribute('data-strip'),firstID);
  await page.evaluate(()=>window.slateDesktop.flush());
  const beforeCancel=await page.evaluate(async()=>await(await fetch('/api/workspace')).json());
  const handle=await dayRows.nth(0).locator('[data-move-strip]').boundingBox(),pane=await page.locator('.board-panel .board-scroll').boundingBox();
  const scrollBefore=await page.locator('.board-panel .board-scroll').evaluate(e=>e.scrollTop);
  await page.mouse.move(handle.x+handle.width*.5,handle.y+handle.height*.5);await page.mouse.down();
  await page.mouse.move(handle.x+handle.width+15,handle.y+handle.height+15,{steps:5});
  await page.mouse.move(pane.x+pane.width*.6,Math.min(pane.y+pane.height,1080)-14,{steps:8});
  await page.mouse.move(pane.x+pane.width*.6+1,Math.min(pane.y+pane.height,1080)-14);
  await page.mouse.move(pane.x+pane.width*.6,Math.min(pane.y+pane.height,1080)-14);
  await page.waitForFunction(before=>document.querySelector('.board-panel .board-scroll').scrollTop>before+100,scrollBefore);
  assert.equal(await page.locator('#strip-drag-status').isVisible(),true);
  assert.equal(await page.locator('.strip-drop-marker').isVisible(),true);
  await page.screenshot({path:path.join(root,'build/schedule-drag-feedback.png')});
  await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.locator('#strip-drag-status').isVisible(),false);assert.deepEqual(await page.evaluate(async()=>await(await fetch('/api/workspace')).json()),beforeCancel);
  await page.reload();await page.evaluate(()=>window.slateDesktop.ready);await page.click('[data-view="schedule"]');
  assert.deepEqual(await page.evaluate(async()=>await(await fetch('/api/workspace')).json()),beforeCancel);
  assert.equal(await page.locator('.day-block').first().locator('[data-strip]').first().getAttribute('data-strip'),firstID);
  checks.push('Real mouse drag works from full strip content and large handles; live edge autoscroll/placement feedback, Escape cancellation and exact saved board/coverage relationships survive reload');
  assert.deepEqual(errors,[]);checks.push('Real keyboard focus, Cmd/Ctrl undo/redo, browser resize, save/reopen and key-bind persistence');
  console.log(JSON.stringify({checks,pageErrors:errors},null,2));
}catch(error){console.error(error.stack);process.exitCode=1;}
finally{await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}fs.rmSync(temp,{recursive:true,force:true});}})();
