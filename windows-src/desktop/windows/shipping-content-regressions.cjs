// Synthetic content is supplied by the external QA runner, never the app bundle.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = async ({win, origin, output, flush}) => {
  const js = source => win.webContents.executeJavaScript(source);
  assert.equal(await js('!!document.querySelector("#load-demo,#demo-guide,#demo-launcher")'), false);
  for (const name of ['demo.js','demo-controls.js','the-last-light.productiondesk','the-last-light.fountain','the-last-light.scenic']) {
    assert.equal((await fetch(origin+'/demo/'+name)).status, 404, name);
  }
  const fixture = JSON.parse(fs.readFileSync(path.join(output,'portable-fixture.productiondesk'),'utf8'));
  const provide = () => js('window.productionDeskTestFixture='+JSON.stringify(fixture));
  win.webContents.on('did-finish-load', () => { void provide(); });
  await provide();
  // A pristine editor normalizes optional shot fields in memory without marking
  // a user edit. Save synthetic settings through the ordinary UI before the
  // on-disk preservation baseline; a no-op flush intentionally writes nothing.
  await js(`document.querySelector('#settings-open').click();
    const date=document.querySelector('[data-field="start-date"]');
    if(!date.value)date.value='2026-10-01';
    document.querySelector('#settings-submit').click();`);
  assert.equal(await js('document.querySelector("#modal").open'), false);
  assert.equal(await flush(), true);
  const before = await (await fetch(origin+'/api/workspace')).json();
  await js('(async()=>{const starter=structuredClone(window.productionDeskTestFixture);delete starter.workspace.projects[0]._linedScript;starter.workspace._pdfDocuments={};await window.slateDesktop.importProjectFile(new File([JSON.stringify(starter)],"Synthetic.productiondesk"));})()');
  assert.equal(await flush(), true);
  const after = await (await fetch(origin+'/api/workspace')).json();
  assert.equal(after.projects.length, before.projects.length+1);
  assert.deepEqual(after.projects.slice(0,before.projects.length), before.projects);
  assert.deepEqual(after.projects.at(-1).breakdowns, fixture.workspace.projects[0].breakdowns);
  return ['Shipping app has no demo controls or bundled script; external QA fixture imports without changing existing projects'];
};
