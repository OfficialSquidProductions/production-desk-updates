const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async ({win, origin, dataFolder, output, flush}) => {
  const js = source => win.webContents.executeJavaScript(source);
  const waitFor = async source => {
    const deadline = Date.now()+15000;
    while (!await js(source)) {
      if(Date.now()>deadline) throw Error('Timed out: '+source);
      await delay(100);
    }
  };
  const checks = [];
  await waitFor('document.querySelector("#project-picker")?.options.length > 0');
  assert.equal(await js('typeof window.productionDeskWindows?.print'), 'function');
  assert.equal(await js('typeof window.require'), 'undefined');
  checks.push('Isolated native window and print bridge');
  const original = await (await fetch(origin+'/api/workspace')).json();
  assert.ok(original.projects.length);
  for(const view of ['workspace','schedule','shots','elements','reports']) {
    await js(`document.querySelector('[data-view="${view}"]').click()`);
    assert.ok(await js('document.querySelector("#content").textContent.trim().length > 20'));
  }
  checks.push('All five shared application views render');
  await js(`document.querySelector('[data-view="shots"]').click(); document.querySelector('#add-scene').click();
    document.querySelector('#new-shot-description').value='Windows packaged application test';
    document.querySelector('#new-shot-save').click();`);
  assert.equal(await flush(), true);
  let saved = JSON.parse(fs.readFileSync(path.join(dataFolder,'workspace.json'),'utf8'));
  const project = saved.projects.find(p => p.id === saved.activeProject);
  assert.ok(project._shots.some(s=>s.description==='Windows packaged application test'));
  await js('document.querySelector("#undo").click()');
  assert.equal(await flush(), true);
  const undone = JSON.parse(fs.readFileSync(path.join(dataFolder,'workspace.json'),'utf8'));
  assert.equal(undone.projects.find(p=>p.id===undone.activeProject)._shots.length,project._shots.length-1);
  await js('document.querySelector("#redo").click()');
  assert.equal(await flush(), true);
  checks.push('Shot creation, Undo, Redo and atomic disk saves');
  await js(`window.realFetchForTest=window.fetch;
    window.fetch=(url,options)=>String(url)==='/api/workspace' && options?.method==='POST'
      ? Promise.resolve(new Response('{"error":"Simulated disk failure"}',{status:500}))
      : window.realFetchForTest(url,options);
    document.querySelector('[data-shot-field="notes"]').value='Recovered after failed save';
    document.querySelector('[data-shot-field="notes"]').dispatchEvent(new Event('change',{bubbles:true}));`);
  assert.equal(await flush(), false);
  await js('window.fetch=window.realFetchForTest; delete window.realFetchForTest;');
  assert.equal(await flush(), true);
  checks.push('Failed save blocks exit/update flush; retry saves successfully');
  const post = (route, body, headers={}) => fetch(origin+route,{method:'POST',headers:{'X-Slate-Local':'1',...headers},body});
  for(const name of ['fixture.pdf','fixture.fdx']) {
    const response = await post('/api/import',fs.readFileSync(path.join(output,name)),{'X-Filename':name});
    const result=await response.json();
    assert.equal(response.status,200,JSON.stringify(result));
    assert.ok(result.project.breakdowns.length);
  }
  checks.push('Bundled PDF and Final Draft import');
  for(const theme of ['dark','light','dark']) {
    assert.equal((await post('/api/settings',JSON.stringify({theme}))).status,200);
  }
  await new Promise(resolve => {win.webContents.once('did-finish-load',resolve); win.reload();});
  await waitFor('document.querySelector("#project-picker")?.options.length > 0');
  saved = JSON.parse(fs.readFileSync(path.join(dataFolder,'workspace.json'),'utf8'));
  const loaded = await (await fetch(origin+'/api/workspace')).json();
  assert.deepEqual(loaded,saved);
  checks.push('Workspace and appearance survive reload');
  const downloaded = new Promise((resolve,reject) => {
    win.webContents.session.once('will-download', (_event,item) => {
      item.once('done', (_event,state) => state==='completed' ? resolve() : reject(Error('Backup download '+state)));
    });
  });
  await js(`document.querySelector('#export-open').click(); document.querySelector('#export-backup').click();`);
  await Promise.race([downloaded,delay(15000).then(()=>{throw Error('Backup download timed out');})]);
  const backupName='Production-Desk-backup-'+new Date().toISOString().slice(0,10)+'.json';
  const backup=JSON.parse(fs.readFileSync(path.join(output,backupName),'utf8'));
  assert.deepEqual(backup,saved);
  const restored = await post('/api/import',JSON.stringify(backup),{'X-Filename':backupName});
  assert.equal(restored.status,200);
  assert.deepEqual((await restored.json()).workspace,backup);
  checks.push('Native backup download and full backup import preserve all data');
  await js(`document.querySelector('#modal').close(); document.querySelector('[data-view="reports"]').click();
    window.print=()=>{}; document.querySelector('[data-action="print"]').click();`);
  const pdf = await win.webContents.printToPDF({printBackground:true, preferCSSPageSize:true});
  assert.ok(pdf.length>1000);
  assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  fs.writeFileSync(path.join(output,'schedule.pdf'),pdf);
  checks.push('Schedule report PDF rendered by the bundled desktop engine');
  await js(`document.querySelector('[data-view="workspace"]').click()`);
  fs.writeFileSync(path.join(output,'windows-app.png'),(await win.webContents.capturePage()).toPNG());
  const blocked=await fetch(origin+'/api/workspace',{headers:{Origin:'https://example.com'}});
  assert.equal(blocked.status,403);
  checks.push('Cross-origin requests rejected');
  return {passed:true, checks, version:require('./package.json').version};
};
