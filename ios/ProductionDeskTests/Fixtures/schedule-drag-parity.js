async function runScheduleDragChecks(){
  const stableStringify=value=>JSON.stringify((function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;})(value));
  const $=s=>document.querySelector(s),checks=[],expect=(value,message)=>{if(!value)throw Error(message);};
  const wait=async fn=>{const deadline=Date.now()+10000;while(!fn()){if(Date.now()>deadline)throw Error('Schedule drag timed out: '+fn);await new Promise(r=>setTimeout(r,30));}};
  const saved=async()=>{expect(await window.slateDesktop.flush(),'Board save failed');const {nativeAPI}=await import('/native-platform.js');const w=await nativeAPI('/api/workspace');return w.projects.find(p=>p.id===w.activeProject);};
  if($('#modal').open)$('#modal').close();let project=await saved(),sample=structuredClone(project.breakdowns.find(b=>b.type==='scene'));
  project.id=crypto.randomUUID();project.name=project.project='Stripboard drag disposable QA';
  const scenes=Array.from({length:200},(_,i)=>({...structuredClone(sample),id:crypto.randomUUID(),scene:String(i+1),elements:[],description:'Synthetic strip '+(i+1),_scriptText:'INT. BOARD QA - DAY\nA synthetic schedule scene.'}));
  const banners=Array.from({length:3},(_,i)=>({id:crypto.randomUUID(),created:sample.created,type:'banner',bannerText:'Synthetic banner '+i,comments:null,description:null,elements:[],pages:null,scene:null,scriptPage:null,duration:null}));
  project.breakdowns=[...scenes,...banners];
  const ids=scenes.map(s=>s.id),bid=banners.map(b=>b.id),scenario=project.stripboards[0];
  scenario.boards=[{id:crypto.randomUUID(),name:'Shooting order',breakdownIds:[bid[0],ids.slice(0,60),bid[1],ids.slice(60,120),[]]},{id:crypto.randomUUID(),name:'Unscheduled',breakdownIds:ids.slice(120,170)},{id:crypto.randomUUID(),name:'Holding',breakdownIds:[...ids.slice(170),bid[2]]}];
  scenario.name='Drag QA';const other=structuredClone(scenario);other.id=crypto.randomUUID();other.name='Untouched alternate';other.boards.forEach(b=>b.id=crypto.randomUUID());project.stripboards=[scenario,other];
  const seed={created:sample.created,number:'.1',description:'Preserved coverage shot',movement:'Static',size:'Wide',camera:'A',lens:'35',equipment:'Tripod',notes:'Preserved manual notes',circleTake:'',priority:'Essential',status:'Planned',setupMinutes:10,shootMinutes:15,actualMinutes:null,takes:0};
  project._shots=[0,100].map(i=>({...seed,id:crypto.randomUUID(),sceneId:ids[i]}));
  if(project._linedScript?.documents?.length){const doc=structuredClone(project._linedScript.documents[0]);doc.marks=project._shots.map((s,i)=>({id:crypto.randomUUID(),type:'coverage',page:0,start:[.2+i*.1,.2],end:[.2+i*.1,.6],shotId:s.id,style:'solid',width:2,color:'#E60026'}));project._linedScript={activePdf:doc.sha256,documents:[doc]};}
  delete project._demo;delete project._scriptSource;
  await window.slateDesktop.importProjectFile(new File([stableStringify({version:1,activeProject:project.id,projects:[project]})],'Stripboard-QA.json'));
  $('[data-view="schedule"]').click();
  const strip=id=>$(`[data-strip="${id}"]`),day=n=>document.querySelectorAll('.day-block')[n],flat=p=>p.stripboards[0].boards.flatMap(b=>b.breakdownIds.flat()).sort();
  const first=await saved(),expected=flat(first),references=stableStringify({breakdowns:first.breakdowns,shots:first._shots,lining:first._linedScript,alternate:first.stripboards[1]});
  const integrity=async()=>{const p=await saved();expect(stableStringify(flat(p))===stableStringify(expected),'Drag lost/duplicated a schedule strip');expect(stableStringify({breakdowns:p.breakdowns,shots:p._shots,lining:p._linedScript,alternate:p.stripboards[1]})===references,'Drag changed scene/shot/coverage data or another scenario');return p;};
  function show(node){const pane=node.closest('.board-scroll');pane.scrollIntoView({block:'center'});pane.scrollTop+=node.getBoundingClientRect().top-pane.getBoundingClientRect().top-70;}
  const transfer=()=>new DataTransfer();
  function fire(target,type,data,fraction=.5,point){const r=target.getBoundingClientRect(),value={x:r.left+r.width*.5,y:r.top+r.height*fraction,...point};const e=new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:data,clientX:value.x,clientY:value.y});target.dispatchEvent(e);return e;}
  function start(id){const source=strip(id);show(source);const data=transfer();fire(source.querySelector('.strip-heading'),'dragstart',data);return data;}
  function drag(id,target,fraction=.5){const data=start(id);show(target);fire(target,'dragenter',data,fraction);expect(!$('#strip-drag-status').hidden,'Drag entry has no placement feedback');fire(target,'dragover',data,fraction);expect(!$('#strip-drag-status').hidden,'Dragging has no visible placement feedback');fire(target,'drop',data,fraction);expect(!document.body.classList.contains('strip-drag-active')&&$('.strip-drop-marker').hidden,'Drop left stale feedback');}
  const grab=strip(ids[0]).querySelector('[data-move-strip]');expect(grab&&grab.getBoundingClientRect().width>=40&&grab.getBoundingClientRect().height>=40,'Large grab handle is missing or too small');
  drag(ids[0],strip(ids[1]),.8);let p=await integrity();expect(p.stripboards[0].boards[0].breakdownIds[1].slice(0,2).join()===ids.slice(0,2).reverse().join(),'Lower-half drop did not insert after the target');
  drag(ids[0],strip(ids[1]),.2);p=await integrity();expect(p.stripboards[0].boards[0].breakdownIds[1].slice(0,2).join()===ids.slice(0,2).join(),'Upper-half drop did not insert before the target');
  drag(ids[5],strip(ids[50]),.8);p=await integrity();let list=p.stripboards[0].boards[0].breakdownIds[1];expect(list.indexOf(ids[5])===list.indexOf(ids[50])+1,'Distant downward placement failed');
  drag(ids[5],strip(ids[2]),.2);p=await integrity();list=p.stripboards[0].boards[0].breakdownIds[1];expect(list.indexOf(ids[5])+1===list.indexOf(ids[2]),'Distant upward placement failed');
  checks.push('Large grab handles and full-row upper/lower placement move adjacent or distant strips in either direction with visible feedback and no lost/duplicate data');
  drag(ids[6],day(1).querySelector('.day-header'));p=await integrity();expect(p.stripboards[0].boards[0].breakdownIds[3][0]===ids[6],'Day header did not accept a broad start-of-day drop');
  drag(ids[7],day(1).querySelector('.day-total'));p=await integrity();expect(p.stripboards[0].boards[0].breakdownIds[3].at(-1)===ids[7],'Day footer did not accept an end-of-day drop');
  drag(ids[8],$('[data-holding-index="2"]'));p=await integrity();expect(p.stripboards[0].boards[2].breakdownIds[0]===ids[8],'Holding header did not accept a drop');
  drag(ids[175],day(2).querySelector('.empty-drop'));p=await integrity();expect(p.stripboards[0].boards[0].breakdownIds[4][0]===ids[175],'Empty day drop failed');
  drag(ids[120],strip(ids[10]),.2);await integrity();
  drag(bid[0],day(1).querySelector('.day-header'));p=await integrity();expect(p.stripboards[0].boards[0].breakdownIds[2][0]===bid[0],'Removing a banner shifted the destination day incorrectly');
  const main=$('.main-strip-board');const data=start(ids[175]);show(main);const top=day(0).getBoundingClientRect().top;fire(main,'dragover',data,.5,{y:top-2});fire(main,'drop',data,.5,{y:top-2});p=await integrity();expect(p.stripboards[0].boards[0].breakdownIds[0]===ids[175],'Between-day main board placement failed');
  checks.push('Broad day headers/footers, empty days, Unscheduled, Holding and between-day targets preserve scene/shot/coverage references and every untouched alternate scenario');
  const beforeUndo=stableStringify(p.stripboards[0].boards);$('#undo').click();await integrity();expect(stableStringify((await saved()).stripboards[0].boards)!==beforeUndo,'Move was not undoable');
  const noOpBefore=stableStringify((await saved()).stripboards[0].boards),source=strip(ids[0]);const self=start(ids[0]);fire(source,'dragover',self,.2);fire(source,'drop',self,.2);expect(!$('#redo').disabled&&stableStringify((await saved()).stripboards[0].boards)===noOpBefore,'Self-drop created history or changed data');$('#redo').click();await integrity();
  const unchanged=stableStringify((await saved()).stripboards);
  let cancel=start(ids[9]);fire(strip(ids[11]),'dragover',cancel,.8);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));fire(strip(ids[11]),'drop',cancel,.8);expect(stableStringify((await saved()).stripboards)===unchanged,'Escape committed a move');
  cancel=start(ids[9]);fire(document.body,'drop',cancel);expect(stableStringify((await saved()).stripboards)===unchanged,'Dropping outside a board changed the schedule');
  const external=transfer();external.setData('text/plain',ids[9]);fire(strip(ids[11]),'drop',external);expect(stableStringify((await saved()).stripboards)===unchanged,'External payload reordered a scene');
  cancel=start(ids[9]);$('#scenario-picker').value='1';$('#scenario-picker').dispatchEvent(new Event('change'));fire(strip(ids[11]),'drop',cancel);expect(stableStringify((await saved()).stripboards)===unchanged,'Scenario switch committed a stale drag');$('#scenario-picker').value='0';$('#scenario-picker').dispatchEvent(new Event('change'));
  expect(!document.body.classList.contains('strip-drag-active')&&$('#strip-drag-status').hidden,'Cancellation left drag state');
  checks.push('One move is undoable/redoable; self-drops preserve redo; Escape, outside drops, foreign payloads and scenario changes cancel without reordering');
  for(const direction of [1,-1]){
    const d=start(ids[30]),pane=strip(ids[30]).closest('.board-scroll'),r=pane.getBoundingClientRect(),x=r.left+r.width*.55,y=direction>0?Math.min(innerHeight,r.bottom)-12:Math.max(0,r.top)+12,before=pane.scrollTop;
    const hit=document.elementFromPoint(x,y);fire(hit,'dragover',d,.5,{x,y});await wait(()=>direction>0?pane.scrollTop>before+100:pane.scrollTop<before-100);
    expect(!$('#strip-drag-status').hidden,'Autoscroll lost placement feedback');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(stableStringify((await saved()).stripboards)===unchanged,'Autoscroll moved data before dropping');
  }
  strip(ids[15]).querySelector('[data-color-strip]').click();expect($('#modal').open&&$('#strip-color-auto'),'Color control no longer opens independently');$('#modal-close').click();
  strip(ids[15]).querySelector('[data-move-strip]').click();expect($('#strip-move-target')&&$('#modal').open,'Grab-handle click has no keyboard-friendly placement alternative');$('#modal-cancel').click();
  strip(ids[15]).click();expect($('[data-view="workspace"]').classList.contains('active'),'Intentional strip click no longer opens its breakdown');$('[data-view="schedule"]').click();
  await integrity();window.scheduleDragQA={projectId:project.id};
  checks.push('Long-board edge autoscroll works up/down without committing until drop; color controls, handle placement dialogs and intentional strip editing remain independent');
  return checks;
};
