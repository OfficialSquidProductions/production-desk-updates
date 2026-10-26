const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Execute the production import/session/save functions, not a reimplementation.
// Only the DOM surface and HTTP transport are modeled; native bubbling is also
// exercised in desktop/windows/project-import-regressions.cjs.
function harness(filename) {
  const source=fs.readFileSync(filename,'utf8');
  const part=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
  const nodes={},calls=[],disk={projects:[{id:'existing',notes:'original'}]};
  const dialog={open:false,close(){this.open=false;this.onclose?.();}};
  const controls=()=>Object.values(nodes).filter(n=>n!==dialog);
  const context=vm.createContext({window:{},document:{activeElement:{blur(){}},querySelector:()=>dialog.open?dialog:null},
    setTimeout,clearTimeout,Date,Promise,structuredClone,
    $:selector=>nodes[selector],$$:controls,clone:structuredClone,saveStatus:()=>{},toast:()=>{},
    modal(){
      for(const key of Object.keys(nodes))delete nodes[key];
      nodes['#modal']=dialog;dialog.open=true;
      for(const key of ['modal-close','modal-cancel','import-submit','modal-error','paste-script'])nodes['#'+key]={disabled:false,value:'',textContent:''};
      nodes['#import-file']={files:[]};
    },
    mergeProductions:(current,incoming)=>({workspace:{projects:[...current.projects,...incoming]}}),
    mutate:fn=>fn(),
    api:async(route,data)=>{
      calls.push(route);
      if(route==='/api/import') {
        await context.importGate;
        return {project:{id:'incoming',script:data}};
      }
      if(context.failSave)throw Error('Synthetic disk write failed');
      disk.projects=structuredClone(data.projects);
      return {};
    }});
  vm.runInContext(`let workspace={projects:[{id:'existing',notes:'original'}]},project,selected,view,scenarioIndex=0;
    let saving=false,revision=0,savedRevision=0,saveTimer,editorReady,importSession;
    const savedLabel='Saved';
    ${part('window.slateDesktop =','\nasync function api(')}
    ${part('async function save()','\nconst historyViews=')}
    ${part('function importModal()','\nasync function saveProjectFile(')}
    `,context);
  const run=code=>vm.runInContext(code,context);
  return {context,nodes,dialog,calls,disk,run,
    open:()=>run('importModal()'),
    dirty(){run("workspace.projects[0].notes='unsaved edit';revision++");},
    pickerCancel(){dialog.oncancel({target:nodes['#import-file'],preventDefault(){throw Error('Picker cancellation must not be prevented');}});},
    dialogCancel(){let prevented=false;dialog.oncancel({target:dialog,preventDefault(){prevented=true;}});if(!prevented)dialog.close();return prevented;},
    submit(text){nodes['#paste-script'].value=text;return nodes['#import-submit'].onclick();}};
}

const sources=['../web/app.js'];
const scripts={ASCII:'INT. ROOM - DAY\n\nA clock ticks.',Unicode:'INT. CAFÉ - DAY\n\nÉlodie sees 東京.\n\nEXT. GARDEN - NIGHT\n\nRain falls.'};
for(const relative of sources) {
  const filename=path.join(__dirname,relative);
  for(const dirty of [false,true])for(const [kind,text] of Object.entries(scripts)) {
    test(`${relative}: picker cancel then paste ${kind}, ${dirty?'dirty':'clean'} workspace`,async()=>{
      const h=harness(filename);if(dirty)h.dirty();h.open();
      // Repeated cancellation must leave the same import session usable.
      for(let i=0;i<3;i++)h.pickerCancel();
      assert.equal(h.run('importSession.cancelled'),false);
      await h.submit(text);
      assert.equal(h.dialog.open,false);
      assert.equal(h.disk.projects.length,2);
      assert.equal(h.disk.projects[1].script,text);
      assert.equal(h.disk.projects[0].notes,dirty?'unsaved edit':'original');
      assert.deepEqual(h.calls,dirty?['/api/workspace','/api/import','/api/workspace']:['/api/import','/api/workspace']);
    });
  }
  test(`${relative}: failed prior save blocks import and retry after picker cancellation succeeds`,async()=>{
    const h=harness(filename);h.dirty();h.open();h.pickerCancel();h.context.failSave=true;
    await h.submit(scripts.Unicode);
    assert.equal(h.calls.includes('/api/import'),false);
    assert.match(h.nodes['#modal-error'].textContent,/could not be saved/);
    assert.equal(h.nodes['#import-submit'].disabled,false);
    assert.equal(h.disk.projects[0].notes,'original');
    h.context.failSave=false;h.pickerCancel();await h.submit(scripts.Unicode);
    assert.equal(h.disk.projects[0].notes,'unsaved edit');assert.equal(h.disk.projects.length,2);
  });
  test(`${relative}: final save failure restores controls without replacing workspace`,async()=>{
    const h=harness(filename);h.open();h.pickerCancel();h.context.failSave=true;
    await h.submit(scripts.ASCII);
    assert.match(h.nodes['#modal-error'].textContent,/disk write failed/);
    assert.equal(h.nodes['#import-submit'].disabled,false);
    assert.equal(h.run('workspace.projects.length'),1);
    h.context.failSave=false;await h.submit(scripts.ASCII);assert.equal(h.disk.projects.length,2);
  });
  test(`${relative}: dialog cancellation cancels pending import, stale completion cannot alter new dialog`,async()=>{
    const h=harness(filename);h.open();let release;
    h.context.importGate=new Promise(resolve=>release=resolve);
    const pending=h.submit(scripts.ASCII);
    while(!h.calls.includes('/api/import'))await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.dialogCancel(),false);
    h.open();h.nodes['#paste-script'].value='New dialog draft';
    release();await pending;
    assert.equal(h.disk.projects.length,1);
    assert.equal(h.dialog.open,true);
    assert.equal(h.nodes['#paste-script'].value,'New dialog draft');
    assert.equal(h.nodes['#import-submit'].disabled,false);
    h.pickerCancel();await h.submit(scripts.Unicode);assert.equal(h.disk.projects.length,2);
  });
  test(`${relative}: only dialog cancellation is prevented during final commit`,()=>{
    const h=harness(filename);h.open();h.run('importSession.committing=true');
    h.pickerCancel();assert.equal(h.run('importSession.cancelled'),false);
    assert.equal(h.dialogCancel(),true);assert.equal(h.dialog.open,true);
  });
}
