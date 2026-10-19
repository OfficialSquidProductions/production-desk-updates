const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {randomUUID, createHash} = require('node:crypto');

// Runs only from --smoke-test in the actual packaged/installed Windows app.
// All workspace mutations use its isolated smoke-data directory and are restored.
module.exports = async ({win, origin, output, flush, waitFor}) => {
  const js = source => win.webContents.executeJavaScript(source);
  const read = async () => (await fetch(origin + '/api/workspace')).json();
  const post = async (route, value, headers={}) => {
    const response = await fetch(origin + route, {method:'POST', headers:{'X-Slate-Local':'1','Content-Type':'application/json',...headers}, body:typeof value==='string'?value:JSON.stringify(value)});
    const result = await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
  };
  const reload = async () => {
    await new Promise(resolve => {win.webContents.once('did-finish-load', resolve);win.reload();});
    await waitFor('document.querySelector("#project-picker")?.options.length > 0');
  };
  const click = selector => js(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const download = async action => {
    const saved = new Promise((resolve,reject) => win.webContents.session.once('will-download', (_event,item) => {
      item.once('done', (_event,state) => state==='completed'?resolve(item.getSavePath()):reject(Error('Demo download '+state)));
    }));
    await action();
    let timer;
    try {return await Promise.race([saved,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('Demo native download timed out')),20000);})]);}
    finally {clearTimeout(timer);}
  };
  const original = await read(), checks=[];
  try {
    assert.equal(await js('!document.querySelector("#demo-launcher").hidden && !document.querySelector("#load-demo").disabled'),true);
    await click('#new-open');
    await js(`document.querySelector('[data-field="modal-value"]').value='Native demo preservation fixture';document.querySelector('#modal-ok').click();`);
    await waitFor('document.querySelector("#project-title").textContent === "Native demo preservation fixture"');
    assert.equal(await flush(),true);
    const assetResponse=await fetch(origin+'/demo/the-last-cue.productiondesk');assert.equal(assetResponse.status,200);
    const raw=await assetResponse.text(),asset=JSON.parse(raw);
    const parsed=await post('/api/import',raw,{'X-Filename':'the-last-cue.productiondesk'});
    let workspace=await read();
    const legacy=structuredClone(parsed.workspace.projects[0]);legacy.id=randomUUID();legacy.project='Legacy V1 sample — preserve';legacy._betaDemo={key:'productiondesk.demo.the-last-cue.v1',version:1};
    const priorCopy=structuredClone(parsed.workspace.projects[0]);priorCopy.id=randomUUID();priorCopy.project='Existing imported demo — preserve';
    workspace.projects.push(legacy,priorCopy);await post('/api/workspace',workspace);await reload();
    const baseline=(await read()).projects;
    const preserved = async () => {const w=await read();for(const p of baseline)assert.deepEqual(w.projects.find(x=>x.id===p.id),p,'Preserve '+p.project);return w;};
    await click('#demo-guide');assert.equal(await js('document.querySelector("#modal-content").textContent.includes("Scene 1 and shots 1A–1D")'),true);await click('#demo-guide-close');
    await click('#load-demo');await waitFor('!document.querySelector("#load-demo").disabled && document.querySelector("#project-title").textContent.includes("The Last Cue")');
    workspace=await preserved();const key='productiondesk.scenic.the-last-cue.v2',ownedID=workspace._demoProjects[key];let demo=workspace.projects.find(p=>p.id===ownedID);
    assert.equal(workspace.activeProject,ownedID);assert.equal(demo.breakdowns.filter(b=>b.type==='scene').length,1);assert.equal(demo.breakdowns.filter(b=>b.type==='banner').length,2);assert.equal(demo._shots.length,4);assert.equal(demo.stripboards.length,2);assert.equal(demo._linedScript.documents[0].marks.length,6);
    const count=workspace.projects.length,hash=demo._linedScript.activePdf;
    const pdf=Buffer.from(await(await fetch(origin+'/api/pdf/'+hash)).arrayBuffer());assert.equal(createHash('sha256').update(pdf).digest('hex'),hash);assert.deepEqual(pdf,Buffer.from(asset.workspace._pdfDocuments[hash],'base64'));
    checks.push('Packaged Load Demo and guide: Scenic-aligned scene, two banners, four shots, two scenarios, exact original PDF and six marks');
    const bounds=win.getBounds(),wasVisible=win.isVisible(),layouts=[];
    try {
      if(!wasVisible)win.showInactive();
      for(const [width,height] of [[1008,655],[900,655],[1280,800]]) {
        win.setContentSize(width,height);
        await js('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
        const layout=await js(`(() => {
          const title=document.querySelector('.brand-title'),brand=document.querySelector('.brand'),range=document.createRange();range.selectNodeContents(title);
          const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
          return {viewport:{width:innerWidth,height:innerHeight},title:rect(title),text:Array.from(range.getClientRects(),r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom})),brand:rect(brand),sidebar:rect(document.querySelector('.sidebar')),plus:rect(document.querySelector('#new-open')),selector:rect(document.querySelector('#project-picker')),font:getComputedStyle(title).font,productionTitle:document.querySelector('#project-title').textContent,version:window.SquidBuild.version};
        })()`);
        layouts.push(layout);
        fs.writeFileSync(path.join(output,'demo-sidebar-layout.json'),JSON.stringify(layouts,null,2));
        assert.equal(layout.viewport.width,width,'Actual native CSS viewport width');assert.equal(layout.viewport.height,height,'Actual native CSS viewport height');
        assert.ok(layout.text.every(rect=>rect.right<=layout.brand.right+1&&rect.x>=layout.brand.x-1),'Painted native Windows app title must fit inside brand at '+width+'px');
        assert.ok(layout.plus.width>=44&&layout.plus.height>=44,'New-production target remains44px');
        assert.ok(layout.selector.width>100&&layout.selector.height>0,'Production selector remains visible');
        assert.equal(layout.productionTitle,'DEMO · The Last Cue');assert.equal(layout.version,require('./package.json').version);
        const image=(await win.webContents.capturePage()).toPNG();fs.writeFileSync(path.join(output,'demo-app-'+width+'.png'),image);
        if(width===1280)fs.writeFileSync(path.join(output,'demo-app.png'),image);
      }
    } finally {win.setBounds(bounds);if(!wasVisible)win.hide();}
    checks.push('Painted Windows demo title fits900/1008/1280px viewports, with correct production/version, visible selector and44px plus target');
    await click('[data-view="shots"]');
    await js(`const input=document.querySelector('[data-shot-field="description"]');input.value='Native Windows edited demo';input.dispatchEvent(new Event('input',{bubbles:true}));`);
    assert.equal(await js('document.querySelector(".sidebar-save").dataset.state'), 'pending');assert.equal(await flush(),true);
    assert.equal(await js('document.querySelector(".sidebar-save").dataset.state'), 'saved');
    await click('#load-demo');await waitFor('!document.querySelector("#load-demo").disabled');workspace=await preserved();
    assert.equal(workspace.projects.length,count);assert.equal(workspace.activeProject,ownedID);assert.equal(workspace.projects.find(p=>p.id===ownedID)._shots[0].description,'Native Windows edited demo');
    checks.push('Native demo shot edit saves; repeated Load Demo preserves edits and avoids duplicates; sidebar pending/saved state matches disk flush');
    const portablePath=await download(()=>js('window.slateDesktop.saveAs()'));
    const portableRaw=fs.readFileSync(portablePath,'utf8'),portable=JSON.parse(portableRaw);assert.equal(portable.format,'org.squidproductions.productiondesk.project');assert.equal(portable.workspace.projects.length,1);assert.deepEqual(Buffer.from(portable.workspace._pdfDocuments[hash],'base64'),pdf);
    await js(`window.slateDesktop.importProjectFile(new File([${JSON.stringify(portableRaw)}],'Native-demo.productiondesk'))`);assert.equal(await flush(),true);workspace=await preserved();const imported=workspace.projects.find(p=>p.id===workspace.activeProject);assert.notEqual(imported.id,ownedID);assert.ok(imported.project.includes('imported copy'));assert.equal(workspace.projects.length,count+1);assert.equal(imported._shots.length,4);assert.equal(imported._linedScript.documents[0].marks.length,6);assert.equal(workspace._demoProjects[key],ownedID);
    checks.push('Actual native portable download/import embeds the exact original PDF and creates a separate editable copy without reset ownership');
    const beforeCancel=await read();await click('#demo-guide');await click('#demo-reset');await click('#demo-reset-cancel');assert.deepEqual(await read(),beforeCancel);
    await click('#demo-guide');await click('#demo-reset');await click('#demo-reset-confirm');await waitFor('!document.querySelector("#load-demo").disabled');assert.equal(await flush(),true);workspace=await preserved();demo=workspace.projects.find(p=>p.id===workspace.activeProject);assert.notEqual(demo._shots[0].description,'Native Windows edited demo');assert.deepEqual(workspace.projects.find(p=>p.id===imported.id),imported);assert.equal(workspace.projects.length,count+1);
    await click('#undo');assert.equal(await flush(),true);workspace=await preserved();assert.equal(workspace.projects.find(p=>p.id===workspace._demoProjects[key])._shots[0].description,'Native Windows edited demo');assert.deepEqual(workspace.projects.find(p=>p.id===imported.id),imported);
    checks.push('Native Reset cancel is inert; Reset affects only the managed sample; Undo restores edits while Last Light, legacy V1 and imported productions remain exact');
    await reload();workspace=await preserved();assert.equal(workspace.projects.find(p=>p.id===workspace._demoProjects[key])._shots[0].description,'Native Windows edited demo');
    checks.push('Demo edits, ownership and preserved productions survive native app reload');
  } finally {
    await flush();await post('/api/workspace',original);await reload();
  }
  return checks;
};
