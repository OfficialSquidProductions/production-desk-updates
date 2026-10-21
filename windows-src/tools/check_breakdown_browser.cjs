#!/usr/bin/env node
// Optional Playwright check; uses a temporary workspace and never an installed app.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'pd-breakdown-')),ready=path.join(temp,'ready.json');
const server=spawn(process.env.PYTHON||'python3',['-B',path.join(root,'server.py'),'--port','0','--data',path.join(temp,'workspace.json'),'--ready-file',ready]);
let browser,log='';server.stderr.on('data',v=>log+=v);
(async()=>{
  try{
    for(let i=0;i<200&&!fs.existsSync(ready);i++)await new Promise(r=>setTimeout(r,50));
    if(!fs.existsSync(ready))throw Error('Local server failed: '+log);
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
    const page=await browser.newPage({viewport:{width:1440,height:940}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const baseline=process.argv.indexOf('--baseline');
    if(baseline>=0){
      const ref=process.argv[baseline+1];if(!ref)throw Error('Pass an original commit after --baseline');
      const original=execFileSync('git',['show',ref+':windows-src/web/app.js'],{cwd:root,encoding:'utf8'});
      await page.route('**/app.js',route=>route.fulfill({contentType:'text/javascript',body:original}));
    }
    await page.goto(JSON.parse(fs.readFileSync(ready)).url);
    await page.waitForFunction(()=>!!window.slateDesktop?.ready);assert.equal(await page.evaluate(()=>window.slateDesktop.ready),true);
    await page.exposeFunction('productionDeskCapturePDF',()=>page.screenshot({path:path.join(root,'build/breakdown-check/original-pdf-breakdown.png'),fullPage:true}));
    const checks=await page.evaluate('('+require('../desktop/windows/breakdown-editing-regressions.cjs').toString()+')()');
    if(process.argv.includes('--pdf')){
      const pdfChecks=await page.evaluate('('+require('../desktop/windows/script-pdf-regressions.cjs').toString()+')()');checks.push(...pdfChecks);
      await page.selectOption('#scene-picker',await page.locator('#scene-picker option').first().getAttribute('value'));
      await page.waitForFunction(()=>document.querySelector('#script-text')?.dataset.ready==='true');
      await page.selectOption('#tag-category','104');
      const line=page.locator('[data-page="1"] .script-pdf-text span').filter({hasText:'We have one more take.'});
      await line.dblclick({position:{x:20,y:4}});
      const mouseText=await page.evaluate(()=>getSelection().toString().trim());assert.ok(mouseText);
      const pdfTop=await page.locator('.script-pdf-scroll').evaluate(e=>e.scrollTop);
      await page.click('#tag-selection');
      assert.equal(await page.evaluate(()=>getSelection().toString().trim()),mouseText);
      assert.equal(await page.locator('.script-pdf-scroll').evaluate(e=>e.scrollTop),pdfTop);
      checks.push('Real mouse selection hits the PDF text layer; clicking Tag retains the selection and viewport');
      await page.screenshot({path:path.join(root,'build/breakdown-check/pdf-reader.png'),fullPage:true});
    }
    // Exercise actual keyboard submission, rather than only requestSubmit().
    const editScene=await page.locator('#scene-picker').inputValue();
    const entry=page.locator('[data-add-category="100"] input');
    await entry.fill('Keyboard Actor');await entry.press('Enter');
    assert.equal(await entry.inputValue(),'');assert.equal(await entry.evaluate(e=>document.activeElement===e),true);
    await page.evaluate(()=>window.slateDesktop.flush());
    await page.reload();await page.waitForFunction(()=>!!window.slateDesktop?.ready);assert.equal(await page.evaluate(()=>window.slateDesktop.ready),true);
    await page.selectOption('#scene-picker',editScene);
    assert.ok(await page.locator('.chips').filter({hasText:'Keyboard Actor'}).count());
    assert.deepEqual(errors,[]);checks.push('Real keyboard Enter retains actor entry focus and saved assignments survive reload');
    console.log(JSON.stringify({checks,pageErrors:errors},null,2));
  }catch(error){console.error(error.stack);process.exitCode=1;}
  finally{await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}fs.rmSync(temp,{recursive:true,force:true});}
})();
