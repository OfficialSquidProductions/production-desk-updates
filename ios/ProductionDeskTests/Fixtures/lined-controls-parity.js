async function runLinedControlChecks(){
  const stableStringify=value=>JSON.stringify((function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;})(value));
  const $=s=>document.querySelector(s),expect=(value,message)=>{if(!value)throw Error(message);},checks=[];
  const wait=async fn=>{const deadline=Date.now()+20000;while(!fn()){if(Date.now()>deadline)throw Error('Lined controls timed out: '+fn+' '+$('#lined-status')?.textContent);await new Promise(r=>setTimeout(r,30));}};
  const {nativeAPI}=await import('/native-platform.js');const api=nativeAPI;
  const saved=async()=>{expect(await window.slateDesktop.flush(),'Save failed');const w=await api('/api/workspace');return w.projects.find(p=>p.id===w.activeProject);};
  const edit=(selector,value)=>{const input=$(selector);expect(input,'Missing field '+selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();};
  const change=(selector,value)=>{const input=$(selector);input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));};
  const key=(value,options={})=>document.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...options}));
  const blur=()=>document.activeElement?.blur();
  const {eventBinding}=await import('/lined-shortcuts.js');
  expect(eventBinding({key:'ç',code:'KeyC',altKey:true})==='Alt+c','Mac Option key normalization failed');
  expect(eventBinding({key:'+',code:'Equal',shiftKey:true})==='Shift+=','Shifted punctuation normalization failed');
  const {normalizeShotNumber,shotIdentifier}=await import('/shot-identifiers.js');
  for(const [scene,entry,result] of [['1','1','1.1'],['1','.1','1.1'],['1','1.1','1.1'],['1','..1','1.1'],['12A','2','12A.2'],['12A','12a.2','12A.2'],['1','A','1A'],['1','10.2','10.2']])expect(shotIdentifier(scene,normalizeShotNumber(entry,scene))===result,'Identifier failed: '+scene+' '+entry);
  checks.push('Numeric suffixes, explicit full identifiers, letter suffixes, alphanumeric scenes and repeated periods normalize consistently');
  // Build a synthetic multi-scene production with 600 existing shots and an 80-page PDF.
  const project=await saved(),sample=structuredClone(project.breakdowns.find(b=>b.type==='scene'));
  expect(sample,'Synthetic fixture needs a scene');
  project.id=crypto.randomUUID();project.name=project.project='Lined controls disposable QA';
  project.breakdowns=['1','2','10'].map(scene=>({...structuredClone(sample),id:crypto.randomUUID(),scene,elements:[],_scriptText:'INT. QA ROOM - DAY\nSynthetic script.'}));
  for(const scenario of project.stripboards){for(const board of scenario.boards)board.breakdownIds=[];scenario.boards[scenario.boards.length-1].breakdownIds=project.breakdowns.map(b=>b.id);}
  const seed={created:new Date().toISOString(),description:'Synthetic existing shot',movement:'Static',size:'Wide',camera:'A',lens:'35',equipment:'Tripod',notes:'Manual notes',circleTake:'',priority:'Essential',status:'Planned',setupMinutes:10,shootMinutes:15,actualMinutes:null,takes:0};
  project._shots=project.breakdowns.flatMap(scene=>Array.from({length:200},(_,i)=>({...seed,id:crypto.randomUUID(),sceneId:scene.id,number:'.'+(i+1)})));
  project._shotShootingOrder=['retired-shot-stale-id',project._shots[5].id];delete project._linedScript;delete project._scriptSource;delete project._demo;
  await window.slateDesktop.importProjectFile(new File([stableStringify({version:1,activeProject:project.id,projects:[project]})] ,'Lined-QA.json'));
  $('[data-view="lined"]').click();
  const pdf=await PDFLib.PDFDocument.create();for(let i=0;i<80;i++){const page=pdf.addPage(i%2?[720,792]:[612,792]);page.drawText('Synthetic Lined Script QA - page '+(i+1),{x:72,y:700,size:12});}
  const transfer=new DataTransfer();transfer.items.add(new File([await pdf.save()],'80-page-QA.pdf',{type:'application/pdf'}));$('#lined-file').files=transfer.files;$('#lined-file').dispatchEvent(new Event('change'));
  await wait(()=>!!$('#lined-overlay')?.onpointerdown);
  if(!$('#lined-continuous').checked)$('#lined-continuous').click();
  await wait(()=>$('#lined-pages')?.textContent==='80 pages'&&!!$('#lined-overlay')?.onpointerdown);
  const scroll=$('#lined-scroll');scroll.scrollTop=31000;scroll.scrollLeft=150;
  function dragCoverage(x){
    $('[data-lined-tool="coverage"]').click();const overlay=$('#lined-overlay'),r=overlay.parentElement.getBoundingClientRect(),visible=$('#lined-scroll').getBoundingClientRect();overlay.setPointerCapture=()=>{};
    const fire=(type,y)=>overlay.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:4,clientX:r.left+r.width*x,clientY:visible.top+y}));
    fire('pointerdown',100);fire('pointermove',280);fire('pointerup',280);
  }
  dragCoverage(.2);let first=(await saved())._linedScript.documents[0].marks[0];
  dragCoverage(.35);let current=await saved(),second=current._linedScript.documents[0].marks[1];
  expect(current._shots.length===602&&first.shotId&&second.shotId&&first.shotId!==second.shotId,'Repeated coverage reused a shot');
  expect(first.page>=38&&second.page>=38,'Deep script creation lost page reference');
  checks.push('80-page script and 600-shot production: consecutive deep-page coverage creates distinct shots atomically');
  const top=scroll.scrollTop,left=scroll.scrollLeft,overlay=$('#lined-overlay');
  edit('#lined-movement','Repeated edit 1');edit('#lined-movement','Repeated edit 2');blur();
  for(let i=0;i<4;i++){
    key('z',{metaKey:i%2===0,ctrlKey:i%2!==0});expect(scroll.scrollTop===top&&scroll.scrollLeft===left&&$('#lined-overlay')===overlay,'Undo rebuilt or moved the deep PDF');
    expect($('.lined-selected')?.dataset.linedMark===second.id,'Undo lost selected line');
    key('z',{shiftKey:true,metaKey:i%2===0,ctrlKey:i%2!==0});expect(scroll.scrollTop===top&&scroll.scrollLeft===left,'Redo moved deep PDF');
  }
  checks.push('Repeated Cmd-Z / Ctrl-Z and redo retain the PDF DOM, deep horizontal/vertical scroll and selected coverage');
  // A deliberate existing-shot link does not create another shot.
  edit('#lined-shot-search','1.12');$('#lined-shot-search').dispatchEvent(new Event('focus'));
  key('c');expect($('[data-lined-tool="coverage"]').getAttribute('aria-pressed')==='true','Typing search triggered a tool');
  $('#lined-shot-search').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  current=await saved();const existing=current._shots.find(s=>s.sceneId===project.breakdowns[0].id&&s.number==='.12');
  expect(current._linedScript.documents[0].marks[1].shotId===existing.id&&current._shots.length===602,'Autocomplete failed exact-number link');
  const labels=[...$('#lined-shot').options].slice(1).map(o=>o.textContent);
  expect(labels.findIndex(v=>v.startsWith('1.2 '))<labels.findIndex(v=>v.startsWith('1.10 '))&&labels.findIndex(v=>v.startsWith('2.1 '))<labels.findIndex(v=>v.startsWith('10.1 ')),'Shot choices are not naturally sorted');
  checks.push('Ordered live shot choices and exact typed autocomplete link deliberately among hundreds of shots');
  // Collision must remain a no-op until explicitly swapping.
  $('#lined-renumber').click();edit('#lined-renumber-value','1..13');$('#lined-renumber-save').click();expect($('#modal-error').textContent.includes('belongs'),'Renumber silently accepted a collision');
  expect((await saved())._shots.find(s=>s.id===existing.id).number==='.12','Rejected renumber changed data');
  $('#lined-renumber-swap').checked=true;$('#lined-renumber-save').click();
  current=await saved();expect(current._shots.find(s=>s.id===existing.id).number==='.13'&&current._shots.find(s=>s.id!==existing.id&&s.sceneId===existing.sceneId&&s.number==='.12'),'Number swap failed');
  expect(current._linedScript.documents[0].marks[1].shotId===existing.id&&$('#lined-overlay').textContent.includes('1.13'),'Renumber broke coverage reference or label');
  blur();key('z',{ctrlKey:true});expect((await saved())._shots.find(s=>s.id===existing.id).number==='.12','Swap undo failed');key('z',{ctrlKey:true,shiftKey:true});
  checks.push('Renumber normalizes full identifiers, rejects collisions, explicitly swaps and retains references through undo/redo');
  $('#lined-delete').click();if($('#modal').open)$('#modal-ok').click();
  current=await saved();expect(!current._shots.some(s=>s.id===existing.id)&&![...$('#lined-shot').options].some(o=>o.value===existing.id),'Deleted shot remains linkable');
  edit('#lined-shot-search','1.13');expect(![...$('#lined-shot-results').children].some(e=>e.textContent.startsWith('1.13 ')),'Search included deleted shot');
  blur();key('z',{metaKey:true});current=await saved();expect(current._shots.some(s=>s.id===existing.id)&&current._linedScript.documents[0].marks.some(m=>m.id===second.id&&m.shotId===existing.id),'Undo did not restore deleted shot and line');
  expect($('.lined-selected')?.dataset.linedMark===second.id&&scroll.scrollTop===top,'Delete undo lost selection or scroll');
  checks.push('Deleted shots disappear from dropdown/autocomplete; undo restores the shot, coverage, selection and deep scroll');
  // Select an owning line while Coverage is active and drag its label to both gutters.
  function selectLine(mid){$('#lined-overlay').setPointerCapture=()=>{};const hit=$(`[data-lined-mark="${mid}"] .lined-hit`);const b=hit.getBoundingClientRect();hit.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:4,clientX:b.left,clientY:Math.max($('#lined-scroll').getBoundingClientRect().top+40,b.top+30)}));$('#lined-overlay').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:4}));}
  selectLine(second.id);expect($(`[data-lined-mark="${second.id}"]`).classList.contains('lined-selected'),'Clicking a coverage line did not select its box');
  expect(getComputedStyle($(`[data-lined-mark="${second.id}"] .lined-info-box`)).strokeWidth==='2.5px','Associated box lacks visible highlight');
  for(const x of [-.24,1.08,-.22]){
    const label=$(`[data-lined-mark="${second.id}"] .lined-info-box`),b=label.getBoundingClientRect(),page=$('.lined-page').getBoundingClientRect(),y=scroll.getBoundingClientRect().top+130;
    label.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:4,clientX:b.left+3,clientY:b.top+3}));
    $('#lined-overlay').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:4,clientX:page.left+page.width*x+3,clientY:y}));
    $('#lined-overlay').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:4}));
    current=await saved();const line=current._linedScript.documents[0].marks.find(m=>m.id===second.id);
    expect(x<0?line.labelAt[0]<0:line.labelAt[0]>1,'Gutter drag did not persist outside-page position '+x+' '+line.labelAt);
    expect(line.start[0]===second.start[0]&&line.end[1]===second.end[1],'Label drag changed coverage endpoints');
    expect(!!$(`[data-lined-mark="${second.id}"] .lined-connector`),'Owning line connector missing');
  }
  const beforeZoom=(await saved())._linedScript;
  change('#lined-zoom','1.25');await wait(()=>$('#lined-overlay')!==overlay&&!!$('#lined-overlay')?.onpointerdown);
  expect(stableStringify((await saved())._linedScript)===stableStringify(beforeZoom),'Zoom modified stored annotations');
  checks.push('Line click highlights its owning box; repeated left/right gutter drags and zoom retain coverage geometry and connectors');
  // Settings conflict handling, persistence and focus guards.
  $('#app-settings-open').click();change('#lined-label-opacity','35');await wait(()=>$('#settings-status').textContent.includes('opacity saved'));
  $('#lined-key-binds').click();const binding=$('[data-lined-binding="coverage"]');binding.focus();binding.dispatchEvent(new KeyboardEvent('keydown',{key:'v',bubbles:true,cancelable:true}));$('#lined-save-binds').click();expect($('#modal-error').textContent.includes('conflicts'),'Conflicting shortcut accepted');
  binding.dispatchEvent(new KeyboardEvent('keydown',{key:'z',metaKey:true,bubbles:true,cancelable:true}));$('#lined-save-binds').click();expect($('#modal-error').textContent.includes('reserved'),'Undo shortcut could be replaced');
  binding.dispatchEvent(new KeyboardEvent('keydown',{key:'k',bubbles:true,cancelable:true}));$('#lined-save-binds').click();await wait(()=>!!$('#app-settings'));$('#modal-close').click();
  const settings=JSON.parse(localStorage.getItem('productionDeskPreferences'));expect(settings.linedKeyBinds.coverage==='k'&&settings.linedLabelOpacity===.35,'Settings did not persist');
  expect(Number($(`[data-lined-mark="${second.id}"] .lined-info-box`).getAttribute('fill-opacity'))===.35,'Opacity did not update the boxes');
  $('[data-lined-tool="select"]').click();blur();key('k');expect($('[data-lined-tool="coverage"]').getAttribute('aria-pressed')==='true','Custom hotkey did not run');
  $('[data-lined-tool="select"]').click();
  for(const selector of ['#lined-description','#lined-note','#lined-shot-search','#lined-shot']){
    $(selector).focus();key('k');key('z',{ctrlKey:true});key('z',{metaKey:true});window.slateDesktop.undoEdit(false);window.slateDesktop.undoEdit(true);expect($('[data-lined-tool="select"]').getAttribute('aria-pressed')==='true','Shortcut fired while editing '+selector);
  }
  $('#app-settings-open').click();const modalState=stableStringify(await saved());window.slateDesktop.undoEdit(false);expect(stableStringify(await saved())===modalState,'Native menu undo changed workspace behind Settings');$('#modal-close').click();
  const editable=document.createElement('div');editable.contentEditable='true';document.body.append(editable);editable.focus();key('k');expect($('[data-lined-tool="select"]').getAttribute('aria-pressed')==='true','Contenteditable fired shortcut');editable.remove();blur();
  key('k',{isComposing:true});key('k',{repeat:true});expect($('[data-lined-tool="select"]').getAttribute('aria-pressed')==='true','Composition or repeat fired shortcut');
  checks.push('Settings key capture rejects duplicates/reserved commands, saves custom binds and opacity; inputs, selects, textareas, contenteditable, composition and repeats suppress actions');
  // Verify same operation in a different scene and then return to selected deep coverage.
  $('[data-view="workspace"]').click();change('#scene-picker',project.breakdowns[1].id);$('[data-view="lined"]').click();await wait(()=>!!$('#lined-overlay')?.onpointerdown);$('#lined-scroll').scrollTop=31000;
  dragCoverage(.52);current=await saved();const third=current._linedScript.documents[0].marks[2];expect(current._shots.find(s=>s.id===third.shotId).sceneId===project.breakdowns[1].id,'New coverage used the wrong scene');
  checks.push('New coverage respects the selected scene in a multi-scene production');
  // Backup/import is an independent reopen of the complete project and original PDF.
  const state=await api('/api/workspace'),attachments=await window.webkit.messageHandlers.scheduler.postMessage({operation:'backupPDFs',workspace:state}),backup={...state,_pdfDocuments:attachments};
  expect(backup._pdfDocuments[current._linedScript.activePdf],'Backup omitted original PDF');
  backup.projects=[{...current,id:crypto.randomUUID()}];backup.activeProject=backup.projects[0].id;
  await window.slateDesktop.importProjectFile(new File([stableStringify(backup)],'Reopen-Lined-QA.json'));
  const reopened=await saved();expect(stableStringify(reopened._linedScript)===stableStringify(current._linedScript),'Backup reopen changed annotations');
  expect(reopened._shots.length===current._shots.length,'Backup reopen lost shots');
  $('[data-view="lined"]').click();await wait(()=>!!$('#lined-overlay')?.onpointerdown);$('#lined-scroll').scrollTop=31000;
  selectLine(third.id);$('[data-lined-tool="select"]').click();
  checks.push('Full backup/import retains 80-page original, gutter labels, scene relationships and all shots');
  expect(stableStringify((await saved())._shotShootingOrder)===stableStringify(project._shotShootingOrder),'Edits/import rewrote opaque retired order');
  return checks;
};
