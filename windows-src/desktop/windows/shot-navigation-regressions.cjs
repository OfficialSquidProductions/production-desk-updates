module.exports = async function runShotNavigationChecks(){
  const $=s=>document.querySelector(s),checks=[],expect=(value,message)=>{if(!value)throw Error(message);};
  const wait=async fn=>{const deadline=Date.now()+20000;while(!fn()){if(Date.now()>deadline)throw Error('Shot navigation timed out: '+fn);await new Promise(r=>setTimeout(r,30));}};
  const saved=async()=>{expect(await window.slateDesktop.flush(),'Shot navigation save failed');const w=await(await fetch('/api/workspace')).json();return w.projects.find(p=>p.id===w.activeProject);};
  const edit=(selector,value)=>{const input=$(selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();};
  const change=(selector,value)=>{const input=$(selector);input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));};
  const key=(name,options={})=>{const event=new KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true,...options});(document.activeElement||document).dispatchEvent(event);return event;};
  const rows=()=>[...document.querySelectorAll('#shot-list [data-shot]')],selected=()=>$('#shot-list .selected')?.dataset.shot;
  const choose=index=>rows()[index].querySelector('[data-shot-select]').click();
  const focus=()=>$('#shot-list').focus({preventScroll:true});
  const position=(index,padding=50)=>{const list=$('#shot-list');list.scrollTop+=rows()[index].getBoundingClientRect().top-list.getBoundingClientRect().top-padding;};
  if($('#modal').open)$('#modal').close();
  let project=await saved();const sample=structuredClone(project.breakdowns.find(b=>b.type==='scene'));
  project.id=crypto.randomUUID();project.name=project.project='Shot navigation disposable QA';
  project.breakdowns=['1','2','10'].map(scene=>({...structuredClone(sample),id:crypto.randomUUID(),scene,elements:[],_scriptText:'INT. NAVIGATION ROOM - DAY\nSynthetic navigation coverage.'}));
  for(const scenario of project.stripboards){for(const board of scenario.boards)board.breakdownIds=[];scenario.boards.at(-1).breakdownIds=project.breakdowns.map(b=>b.id);}
  const seed={created:new Date().toISOString(),movement:'Static',size:'Wide',camera:'A',lens:'35',equipment:'Tripod',notes:'',circleTake:'',priority:'Essential',status:'Planned',setupMinutes:10,shootMinutes:15,actualMinutes:null,takes:0};
  project._shots=project.breakdowns.flatMap((scene,group)=>Array.from({length:200},(_,i)=>({...seed,id:crypto.randomUUID(),sceneId:scene.id,number:'.'+(i+1),status:i%2?'Ready':'Planned',description:`Synthetic shot ${String(group*200+i).padStart(3,'0')} · `+'Variable camera setup. '.repeat(i%4+1)})));
  delete project._linedScript;delete project._scriptSource;delete project._demo;
  await window.slateDesktop.importProjectFile(new File([JSON.stringify({version:1,activeProject:project.id,projects:[project]})],'Shot-navigation-QA.json'));
  $('[data-view="shots"]').click();let list=$('#shot-list');position(350);
  expect(list.scrollTop>20000,'Fixture did not reach deep shot rows');
  $('.shot-editor-scroll').scrollTop=200;const top=list.scrollTop,pageTop=document.scrollingElement.scrollTop,editorTop=$('.shot-editor-scroll').scrollTop,row=rows()[350];
  const beforeSelection=JSON.stringify(await saved());
  for(let i=0;i<20;i++){choose(350+i%2);expect($('#shot-list')===list&&rows()[350]===row,'Selecting a shot rebuilt the list');expect(list.scrollTop===top&&document.scrollingElement.scrollTop===pageTop,'Click selection reset the deep list or page');expect($('.shot-editor-scroll').scrollTop===editorTop,'Selecting a shot reset the inspector');}
  choose(350);focus();expect(key('ArrowDown').defaultPrevented,'Unmodified navigation arrow was not handled');
  expect(selected()===project._shots[351].id&&list.scrollTop===top,'Visible adjacent shot unnecessarily scrolled');
  for(const direction of ['ArrowDown','ArrowUp'])for(let i=0;i<20;i++){
    const current=rows().findIndex(r=>r.dataset.shot===selected()),next=current+(direction==='ArrowDown'?1:-1);key(direction,{repeat:i>0});
    expect(selected()===project._shots[next].id,'Arrow navigation skipped/reordered a shot');
    const visible=rows()[next].getBoundingClientRect(),bounds=list.getBoundingClientRect();
    expect(visible.top>=bounds.top-1&&visible.bottom<=bounds.bottom+1,'Keyboard selected row is not visible');
    expect(document.scrollingElement.scrollTop===pageTop,'Keyboard navigation scrolled the outer page');
  }
  expect(JSON.stringify(await saved())===beforeSelection,'Selection/navigation changed project data');
  checks.push('600 variable-height shots: repeated deep clicks retain row/list DOM, both pane offsets and page scroll; arrows/repeats minimally reveal the adjacent row without editing or reordering data');
  // Edits keep input identity/caret while row labels update in the same list pane.
  const edited=selected();edit('[data-shot-field="notes"]','Navigation notes survive reopen');
  const description=$('[data-shot-field="description"]');description.focus();description.setSelectionRange(7,7);const fieldTop=list.scrollTop;
  description.value+=' edited';description.dispatchEvent(new Event('input',{bubbles:true}));
  expect($('[data-shot-field="description"]')===description&&document.activeElement===description&&list.scrollTop===fieldTop,'Editing rebuilt the input or moved the list');
  for(const selector of ['[data-shot-field="description"]','[data-shot-field="notes"]','[data-shot-field="number"]','[data-shot-field="setupMinutes"]','[data-shot-field="size"]','[data-shot-field="status"]','#shot-search','#shot-scene','[data-shot-action="down"]','[data-shot-done]']){
    $(selector).focus({preventScroll:true});const prior=selected();for(const direction of ['ArrowDown','ArrowUp'])expect(!key(direction).defaultPrevented&&selected()===prior,'Navigation intercepted a focused control: '+selector);
  }
  const editable=document.createElement('div');editable.contentEditable='true';document.body.append(editable);editable.focus();expect(!key('ArrowDown').defaultPrevented&&selected()===edited,'Contenteditable arrow was intercepted');editable.remove();focus();
  for(const modifiers of [{shiftKey:true},{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true}])expect(!key('ArrowDown',modifiers).defaultPrevented&&selected()===edited,'Modified/IME arrow was intercepted');
  $('#app-settings-open').click();expect(!key('ArrowDown').defaultPrevented&&selected()===edited,'Arrow changed selection behind a dialog');$('#modal-close').click();
  checks.push('Editing keeps input/focus and list offset; inputs, textareas, numeric steppers, datalists, dropdowns, search, other buttons, contenteditable, modifiers, IME and dialogs retain their own arrow handling');
  // Filtered and reordered navigation follows precisely the currently displayed order.
  change('#shot-scene',project.breakdowns[1].id);change('#shot-status','Ready');list=$('#shot-list');expect(rows().length===100,'Scene/status fixture filter failed');
  position(60);choose(60);const filteredTop=list.scrollTop;const ordered=rows().map(r=>r.dataset.shot);focus();key('ArrowDown');expect(selected()===ordered[61],'Navigation left the filtered order');
  $('[data-shot-action="down"]').click();expect($('#shot-list').scrollTop===filteredTop,'Reordering reset the filtered list scroll');
  const reordered=rows().map(r=>r.dataset.shot),index=reordered.indexOf(selected());expect(index===62,'Move-down did not reorder the selected shot');focus();key('ArrowUp');expect(selected()===reordered[61],'Navigation ignored the changed shooting order');
  expect($('#shot-scene').value===project.breakdowns[1].id&&$('#shot-status').value==='Ready','Navigation cleared filters');
  edit('#shot-search','Synthetic shot 299');expect(rows().length===1&&selected()===rows()[0].dataset.shot,'Search retained a hidden selection');focus();const single=selected();key('ArrowDown');key('ArrowUp');expect(selected()===single,'Single matching shot wrapped');
  edit('#shot-search','no matching shot anywhere');focus();expect(rows().length===0&&!key('ArrowDown').defaultPrevented&&!selected(),'Empty list navigated or retained a hidden selection');
  edit('#shot-search','');change('#shot-scene','all');change('#shot-status','all');list=$('#shot-list');
  list.scrollTop=0;choose(0);focus();key('ArrowUp');expect(selected()===rows()[0].dataset.shot&&list.scrollTop===0,'First row wrapped or scrolled');
  list.scrollTop=list.scrollHeight;choose(rows().length-1);focus();const lastTop=list.scrollTop,last=selected();key('ArrowDown');expect(selected()===last&&list.scrollTop===lastTop,'Last row wrapped or scrolled');
  checks.push('Scene/status/search filters repair hidden selections; arrows follow current manual shooting order after reordering; first, last, single and empty lists behave without wrapping');
  // Lined Script can deliberately bind an arrow without capturing Shot List navigation.
  $('#app-settings-open').click();$('#lined-key-binds').click();const binding=$('[data-lined-binding="coverage"]');binding.focus();key('ArrowDown');$('#lined-save-binds').click();await wait(()=>!!$('#app-settings'));$('#modal-close').click();
  position(350);choose(350);focus();key('ArrowDown');expect(selected()===rows()[351].dataset.shot,'Lined Script arrow binding interfered with Shot List');
  $('[data-view="lined"]').click();$('#lined-from-text').click();await wait(()=>!!$('#lined-overlay')?.onpointerdown);$('[data-lined-tool="select"]').click();document.activeElement?.blur();key('ArrowDown');expect($('[data-lined-tool="coverage"]').getAttribute('aria-pressed')==='true','Lined Script configured arrow stopped working');
  $('[data-view="shots"]').click();position(350);choose(350);focus();key('ArrowDown');expect(selected()===rows()[351].dataset.shot,'Tab switch duplicated key handlers or lost navigation');
  const state=await saved();expect(state._shots.find(s=>s.id===edited).notes==='Navigation notes survive reopen','Editing was lost during navigation/filtering');
  window.shotNavigationQA={editedShotId:edited,notes:'Navigation notes survive reopen'};
  checks.push('Configured Lined Script ArrowDown stays scoped to that tab; switching tabs preserves both workflows and saved shot edits');
  return checks;
};
