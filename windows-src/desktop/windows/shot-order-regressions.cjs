module.exports = async function runShotOrderChecks(){
  const $=s=>document.querySelector(s),checks=[],expect=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const wait=async f=>{const end=Date.now()+20000;while(!f()){if(Date.now()>end)throw Error('Shot order timed out: '+f);await new Promise(r=>setTimeout(r,25));}};
  const saved=async()=>{expect(await window.slateDesktop.flush(),'Order save failed');const w=await(await fetch('/api/workspace')).json();return w.projects.find(p=>p.id===w.activeProject);};
  const edit=(selector,value)=>{const e=$(selector);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.blur();};
  const change=(selector,value)=>{const e=$(selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));};
  const rows=()=>[...document.querySelectorAll('#shot-list [data-shot]')],ids=()=>rows().map(r=>r.dataset.shot),choose=id=>$(`[data-shot-select="${id}"]`).click();
  const move=(id,before)=>{$(`[data-move-strip="${id}"]`).click();expect(!!$('#shot-move-target'),'Handle did not open exact placement');$('#shot-move-target').value=before;$('#shot-move-save').click();};
  if($('#modal').open)$('#modal').close();
  const file=await(await fetch('/demo/the-last-light.productiondesk')).json(),p=file.workspace.projects[0];p.id=crypto.randomUUID();p.project='Shot filming order disposable QA';file.workspace.activeProject=p.id;delete p._shotShootingOrder;
  const scenes=p.breakdowns.filter(b=>b.type==='scene');p._shots.push(...Array.from({length:450},(_,i)=>({...p._shots[0],id:crypto.randomUUID(),sceneId:scenes[i%scenes.length].id,number:'ORDER'+i,description:'Order fixture '+i+' · '+'Camera setup '.repeat(i%4+1),status:i%2?'Ready':'Planned'})));
  await window.slateDesktop.importProjectFile(new File([JSON.stringify(file)],'Shot-order-QA.productiondesk'));
  $('[data-view="shot-order"]').click();const initial=await saved(),canonical=initial._shots.map(s=>s.id),last=canonical.at(-1),first=canonical[0];
  expect(same(ids(),canonical)&&!Object.hasOwn(initial,'_shotShootingOrder'),'Opening old project changed shot records or persisted an unused order');
  move(last,first);let state=await saved();expect(ids()[0]===last&&same(state._shots,initial._shots)&&same(state.stripboards,initial.stripboards)&&same(state._linedScript,initial._linedScript),'Order changed canonical shots, identifiers, scene schedules or lined links');
  $('#undo').click();expect(same(ids(),canonical),'Undo first move failed');$('#redo').click();expect(ids()[0]===last,'Redo first move failed');
  $('#undo').click();move(first,canonical[1]);expect(!$('#redo').disabled,'No-op erased redo');$('#redo').click();expect(ids()[0]===last,'No-op left redo unusable');
  $('[data-view="shots"]').click();expect(same(ids(),canonical),'Filming move changed canonical Shot List');choose(first);edit('[data-shot-field="notes"]','Shared canonical notes');
  $('[data-view="shot-order"]').click();choose(first);expect($('[data-shot-field="notes"]').value==='Shared canonical notes','Canonical edit not shared');edit('[data-shot-field="description"]','Shared filming detail');
  $('[data-view="shots"]').click();choose(first);expect($('[data-shot-field="description"]').value==='Shared filming detail','Filming detail edit not shared');
  const orderBefore=(await saved())._shotShootingOrder;$('[data-shot-action="down"]').click();expect(same((await saved())._shotShootingOrder,orderBefore),'Canonical reorder changed independent filming order');
  $('[data-view="shot-order"]').click();expect(same(ids(),orderBefore),'Tab switch lost independent order');
  checks.push('Legacy default; cross-scene exact moves; no-op/undo/redo; unchanged canonical records, scene scenarios and coverage; shared details in both directions; independent canonical reorder');
  // Filtered moves insert relative to full-order anchors; hidden rows retain relative order.
  change('#shot-status','Ready');const visible=ids(),full=(await saved())._shotShootingOrder,hidden=full.filter(id=>!visible.includes(id));choose(visible[20]);const pane=$('#shot-list');pane.scrollTop=1000;const top=pane.scrollTop;
  $('[data-shot-action="down"]').click();expect(ids()[21]===visible[20]&&$('#shot-list').scrollTop===top,'Filtered move/scroll failed');
  state=await saved();expect(same(state._shotShootingOrder.filter(id=>hidden.includes(id)),hidden),'Filtered move reordered hidden shots');
  change('#shot-status','all');change('#shot-scene',scenes[1].id);expect(rows().every(r=>state._shots.find(s=>s.id===r.dataset.shot).sceneId===scenes[1].id),'Scene filter wrong');change('#shot-scene','all');
  change('#shot-day','0');const dayScenes=state.stripboards[0].boards[0].breakdownIds.filter(Array.isArray)[0];expect(rows().every(r=>dayScenes.includes(state._shots.find(s=>s.id===r.dataset.shot).sceneId)),'Day filter wrong');change('#shot-day','all');
  edit('#shot-search','Order fixture 333 ·');expect(rows().length===1,'Search filter wrong');edit('#shot-search','No such shot fixture');expect(!rows().length,'Empty filter wrong');edit('#shot-search','');
  const deep=rows()[330];$('#shot-list').scrollTop+=deep.getBoundingClientRect().top-$('#shot-list').getBoundingClientRect().top-50;choose(deep.dataset.shot);const deepTop=$('#shot-list').scrollTop;expect(deepTop>15000,'Deep fixture too short');
  const selected=deep.dataset.shot;$('#shot-list').focus({preventScroll:true});$('#shot-list').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));expect($('#shot-list .selected').dataset.shot!==selected&&$('#shot-list').scrollTop===deepTop,'Deep keyboard navigation jumped');
  edit('[data-shot-field="notes"]','Deep filming notes');expect($('#shot-list').scrollTop===deepTop,'Detail edit reset scroll');
  $('[data-shot-action="up"]').click();expect($('#shot-list').scrollTop===deepTop,'Move reset deep scroll');$('#undo').click();$('#redo').click();expect($('#shot-list').scrollTop===deepTop,'Undo/redo reset deep scroll');
  checks.push('450+ variable-height strips; scene/day/status/search/empty filters; hidden-order preservation; deep keyboard access, details, moves and undo/redo retain viewport');
  // Linked deletion must preserve the order and all relationships on Undo.
  const linked=(await saved())._linedScript.documents.flatMap(d=>d.marks).find(m=>m.shotId),linkedID=linked.shotId;choose(linkedID);const beforeDelete=await saved();$('[data-shot-action="delete"]').click();$('#modal-ok').click();await new Promise(r=>setTimeout(r,0));
  state=await saved();expect(!state._shots.some(s=>s.id===linkedID)&&!state._shotShootingOrder.includes(linkedID)&&!state._linedScript.documents.some(d=>d.marks.some(m=>m.shotId===linkedID)),'Linked deletion left stale shot/order/coverage');
  $('#undo').click();expect(same(await saved(),beforeDelete),'Undo linked deletion did not restore exact data');$('#redo').click();$('#undo').click();
  const beforeAdd=await saved();$('#add-scene').click();$('#new-shot-number').value='ORDERNEW';$('#new-shot-description').value='New shot appends to filming order';$('#new-shot-save').click();state=await saved();const added=state._shots.find(s=>s.number==='ORDERNEW');expect(added&&state._shotShootingOrder.at(-1)===added.id&&state._shotShootingOrder.length===beforeAdd._shotShootingOrder.length+1,'New shot missing/duplicated/not appended');
  $('#undo').click();expect(same(await saved(),beforeAdd),'Undo addition failed');$('#redo').click();
  // Canonical creation/deletion and scene reassignment keep one shared record.
  $('[data-view="shots"]').click();$('#add-scene').click();$('#new-shot-number').value='CANONNEW';$('#new-shot-description').value='Canonical addition joins filming board';$('#new-shot-save').click();
  state=await saved();const canonicalNew=state._shots.find(s=>s.number==='CANONNEW');expect(state._shotShootingOrder.at(-1)===canonicalNew.id,'Canonical addition was not appended');
  $('[data-view="shot-order"]').click();choose(canonicalNew.id);const beforeScene=(await saved())._shotShootingOrder;change('[data-shot-field="sceneId"]',scenes.find(s=>s.id!==canonicalNew.sceneId).id);
  expect(same((await saved())._shotShootingOrder,beforeScene),'Scene reassignment moved/duplicated the shot');
  const scenarioSelect=document.querySelector('.shot-toolbar > select');if(scenarioSelect.options.length>1){const order=ids();change('.shot-toolbar > select','1');expect(same(ids(),order),'Scenario switch changed production-wide filming order');change('.shot-toolbar > select','0');}
  $('[data-view="shots"]').click();choose(canonicalNew.id);$('[data-shot-action="delete"]').click();$('#modal-ok').click();await new Promise(r=>setTimeout(r,0));
  state=await saved();expect(!state._shotShootingOrder.includes(canonicalNew.id),'Canonical deletion left a stale order ID');$('#undo').click();expect((await saved())._shotShootingOrder.includes(canonicalNew.id),'Undo canonical deletion lost order membership');
  $('[data-view="shot-order"]').click();
  // True HTML DnD guards: no self/external/cancelled gesture can mutate data.
  const fire=(row,type,transfer,y)=>{const r=row.getBoundingClientRect();row.dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:r.left+150,clientY:y??r.top+5}));};
  const beforeCancel=await saved(),source=rows()[0],dest=rows()[1],transfer=new DataTransfer();$('#shot-list').scrollTop=0;dest.scrollIntoView({block:'nearest'});
  fire(source,'dragstart',transfer);fire(dest,'dragover',transfer,dest.getBoundingClientRect().bottom-8);expect(!$('.strip-drop-marker').hidden&&!$('#strip-drag-status').hidden,'Placement feedback missing: '+JSON.stringify({target:dest.getBoundingClientRect().toJSON(),viewport:innerHeight,pane:$('#shot-list').getBoundingClientRect().toJSON(),status:$('#strip-drag-status').textContent}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));fire(dest,'drop',transfer);expect(same(await saved(),beforeCancel),'Escape gesture committed');
  const external=new DataTransfer();external.setData('text/plain',dest.dataset.shot);fire(source,'drop',external);expect(same(await saved(),beforeCancel),'External payload moved a shot');
  fire(source,'dragstart',new DataTransfer());$('[data-view="shots"]').click();expect($('#strip-drag-status').hidden,'Tab switch left active gesture');$('[data-view="shot-order"]').click();expect(same(await saved(),beforeCancel),'Tab switch committed gesture');
  checks.push('Linked and canonical deletion/undo/redo restores IDs, order and marks; additions from either view append once; scene reassignment and scenario switches retain order; real drag handlers show placement and reject Escape/external/stale tab-switch gestures');
  // Capture the actual Save As result, including original PDFs and extension IDs.
  let download;const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.href.includes('/api/download/')){download=this.href;return;}return click.call(this);};
  try{$('#save-as-open').click();await wait(()=>!!download);window.shotOrderPortable=await(await fetch(download)).json();}finally{HTMLAnchorElement.prototype.click=click;}
  window.shotOrderExpected=await saved();expect(same(window.shotOrderPortable.workspace.projects[0],window.shotOrderExpected),'Save As changed shot order or shared records');
  window.shotOrderQA={first:ids()[0],linkedID};return checks;
};
