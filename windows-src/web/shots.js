import {createStripDrag,planStripMove} from './strip-drag.js';
import {shotShootingOrder} from './shot-shooting-order.js';
import {isEditing} from './lined-shortcuts.js';
import {normalizeShotNumber,shotIdentifier,shotNumberKey} from './shot-identifiers.js';
import {confirmLinkedDelete,createDeleteMenu} from './linked-actions.js';
import {removeCoverage,coverageSummary} from './lined-script.js';
// Local shot lists are a Production Desk extension. USS scene IDs remain the source of truth.
export function formatShotDuration(minutes) {
  const value=Math.max(0,Math.round(minutes)),days=Math.floor(value/1440),hours=Math.floor(value%1440/60),mins=value%60;
  return [days&&`${days}d`,hours&&`${hours}h`,(mins||!value)&&`${mins}m`].filter(Boolean).join(' ');
}
export function createShotDesk(c) {
  const {esc, id, stamp} = c;
  const orderMode=!!c.orderMode,title=orderMode?'Shot Shooting Order':'Shot list';
  let orderBoard;
  const ordered=()=>{if(!orderMode)return p()._shots;const map=new Map(p()._shots.map(s=>[s.id,s]));return shotShootingOrder(p()).map(id=>map.get(id));};
  let production, selected, day='all', scene='all', status='all', search='', dragging;
  const statuses=['Planned','Ready','Rolling','Done','Omitted'];
  const sizes=['Wide','Medium wide','Medium','Medium close-up','Close-up','Extreme close-up','Insert','Over the shoulder','POV'];
  const movements=['Static','Pan','Tilt','Dolly','Tracking','Handheld','Steadicam','Crane','Drone'];
  const deleteMenu=createDeleteMenu('shot');
  const p=()=>c.project();
  const scenes=()=>p().breakdowns.filter(b=>b.type==='scene');
  const shot=()=>p()._shots.find(s=>s.id===selected);
  const sceneOf=s=>scenes().find(b=>b.id===s.sceneId);
  const label=s=>shotIdentifier(sceneOf(s)?.scene,s.number);
  const total=s=>s.setupMinutes+s.shootMinutes;
  const active=s=>s.status!=='Omitted';
  const done=s=>s.status==='Done';
  const numberKey=(value,sceneId)=>shotNumberKey(value,scenes().find(b=>b.id===sceneId)?.scene);
  function sync() {
    if(production!==p().id){production=p().id;selected=undefined;day='all';scene='all';status='all';search='';}
    const validDays=groups().map((g,i)=>String(i));
    if(!['all','unscheduled',...validDays].includes(day))day='all';
    if(scene!=='all'&&!scenes().some(s=>s.id===scene))scene='all';
    if(!filtered().some(s=>s.id===selected))selected=filtered()[0]?.id;
  }
  function groups(){return c.groups().filter(Array.isArray);}
  function dayOf(s){const n=groups().findIndex(g=>g.includes(s.sceneId));return n<0?'unscheduled':String(n);}
  function dayName(s){const n=dayOf(s);return n==='unscheduled'?'Unscheduled':`Day ${Number(n)+1}`;}
  function scope(){return ordered().filter(s=>day==='all'||dayOf(s)===day);}
  function filtered(){return scope().filter(s=>(scene==='all'||s.sceneId===scene)&&(status==='all'||s.status===status)&&`${label(s)} ${s.description} ${s.camera} ${s.lens} ${s.notes} ${coverageSummary(p(),s.id).join(' ')} ${c.slug(sceneOf(s))}`.toLowerCase().includes(search.toLowerCase()));}
  function nextNumber(sceneId){
    const used=new Set(p()._shots.filter(s=>s.sceneId===sceneId).map(s=>numberKey(s.number,s.sceneId)));
    for(let n=0;n<10000;n++){let v=n+1,result='';while(v){v--;result=String.fromCharCode(65+v%26)+result;v=Math.floor(v/26);}if(!used.has(result))return result;}
    return String(p()._shots.length+1);
  }
  function clock(mins){const raw=Math.round(mins),n=((raw%1440)+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}${raw>=1440?` +${Math.floor(raw/1440)}d`:''}`;}
  function timings(){
    const [h,m]=p()._shotSettings.startTime.split(':').map(Number);let elapsed=0;const map=new Map();
    for(const s of scope()){map.set(s.id,day==='all'?`+${elapsed}m`:clock(h*60+m+elapsed));if(active(s))elapsed+=total(s);}
    return map;
  }
  function metrics(){
    const shots=scope().filter(active), completed=shots.filter(done),estimate=shots.reduce((n,s)=>n+total(s),0),remaining=shots.filter(s=>!done(s)).reduce((n,s)=>n+total(s),0);
    const reported=completed.filter(s=>s.actualMinutes!==null);
    const actual=reported.reduce((n,s)=>n+s.actualMinutes,0),planned=reported.reduce((n,s)=>n+total(s),0);
    const variance=actual-planned;
    return `<div class="shot-metrics"><div><strong>${shots.length}</strong><span>planned shots</span></div><div><strong>${completed.length}<small> / ${shots.length}</small></strong><span>completed</span></div><div><strong class="shot-duration">${formatShotDuration(estimate)}</strong><span>estimated total</span></div><div><strong class="shot-duration">${formatShotDuration(remaining)}</strong><span>remaining estimate</span></div><div><strong>${reported.length?(variance>0?'+':'')+variance:'—'}<small> min</small></strong><span>actual vs plan · reported</span></div></div><progress class="shot-progress" aria-label="Shots completed" max="${shots.length||1}" value="${completed.length}"></progress>`;
  }
  function selectOptions(values,value){return values.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('');}
  function sceneOptions(value){return scenes().map(b=>`<option value="${esc(b.id)}" ${b.id===value?'selected':''}>${esc(b.scene)} · ${esc(c.slug(b))}</option>`).join('');}
  function rows(){
    const times=timings(),list=filtered();
    return list.length?list.map(s=>`<article class="shot-row ${orderMode?'shot-order-strip':''} ${s.id===selected?'selected':''} ${s.status.toLowerCase()}" draggable="true" data-shot="${esc(s.id)}" ${orderMode?`data-strip="${esc(s.id)}"`: ''}>${orderMode?`<button class="shot-grip" data-move-strip="${esc(s.id)}" aria-label="Move shot ${esc(label(s))}" title="Move shot to an exact position">⠿</button>`:'<span class="shot-grip" aria-hidden="true">⠿</span>'}<${orderMode?'div role="button"':'button'} class="shot-row-main" data-shot-select="${esc(s.id)}" aria-pressed="${s.id===selected}" tabindex="${s.id===selected?0:-1}" aria-label="Select shot ${esc(label(s))}"><span class="shot-row-top"><strong>${esc(label(s))}</strong><span class="shot-state ${s.status.toLowerCase()}">${esc(s.status)}</span><span class="shot-day">${esc(dayName(s))}</span></span><span class="shot-description">${esc(s.description || 'Untitled shot')}</span><span class="shot-specs">${esc([s.size,s.camera&&'Camera '+s.camera,s.lens&&s.lens+' mm',s.movement].filter(Boolean).join(' · '))}</span>${orderMode?`<span class="shot-scene-reference">Scene ${esc(sceneOf(s)?.scene)} · ${esc(c.slug(sceneOf(s)))}</span>`:''}</${orderMode?'div':'button'}><div class="shot-row-time"><strong>${esc(times.get(s.id))}</strong><span>${total(s)} min</span></div><button class="shot-check" data-shot-done="${esc(s.id)}" aria-label="${done(s)?'Reopen':'Complete'} shot ${esc(label(s))}" ${s.status==='Omitted'?'disabled':''}>${done(s)?'✓':'○'}</button></article>`).join(''):`<div class="shot-empty"><span class="empty-frame">＋</span><h2>${p()._shots.length?'No shots match this view':'Build your coverage'}</h2><p>${p()._shots.length?'Try a different day, scene, or status.':'Start with a scene, then add your camera setups, coverage, and time estimates.'}</p><button class="primary" data-shot-action="new">＋ Add a shot</button></div>`;
  }
  function editField(label,key,value,type='text',wide=false,extra='') {return `<label class="field ${wide?'wide':''}">${label}<input data-shot-field="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
  function suggestions(label,key,value,values){return editField(label,key,value,'text',false,`list="shot-${key}-options"`)+`<datalist id="shot-${key}-options">${values.map(v=>`<option value="${esc(v)}">`).join('')}</datalist>`;}
  function coverageNotes(s){
    const notes=coverageSummary(p(),s.id);
    return notes.length?`<section class="shot-coverage"><h3>Script coverage</h3><p class="tiny">Page references and timing notes from linked coverage lines.</p><ul>${notes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul></section>`:'';
  }
  function editor(){
    const s=shot();if(!s)return '<div class="shot-editor-empty"><div class="eyebrow">SHOT DETAILS</div><p>Select a shot to plan its setup and track your takes.</p></div>';
    return `<div class="shot-detail-heading"><div><div class="eyebrow">SHOT DETAILS</div><h2 id="shot-detail-label">${esc(label(s))}</h2></div><div class="shot-order"><button data-shot-action="up" aria-label="Move shot up" title="Move up">↑</button><button data-shot-action="down" aria-label="Move shot down" title="Move down">↓</button></div></div><div class="shot-editor-scroll"><div class="form-grid"><label class="field wide">Scene<select data-shot-field="sceneId">${sceneOptions(s.sceneId)}</select></label>${editField('Shot number / suffix','number',s.number,'text',false,'required maxlength="24"')}<label class="field">Status<select data-shot-field="status">${selectOptions(statuses,s.status)}</select></label><label class="field wide">Shot description<textarea data-shot-field="description" rows="3">${esc(s.description)}</textarea></label>${suggestions('Shot size','size',s.size,sizes)}${suggestions('Movement','movement',s.movement,movements)}${editField('Camera','camera',s.camera)}${editField('Lens (mm)','lens',s.lens)}${editField('Equipment / support','equipment',s.equipment,'text',true)}${editField('Setup (minutes)','setupMinutes',s.setupMinutes,'number',false,'min="0" max="1440" step="1"')}${editField('Shoot (minutes)','shootMinutes',s.shootMinutes,'number',false,'min="0" max="1440" step="1"')}${editField('Actual total (minutes)','actualMinutes',s.actualMinutes,'number',false,'min="0" max="10080" step="1"')}${editField('Takes','takes',s.takes,'number',false,'min="0" max="10000" step="1"')}<label class="field">Priority<select data-shot-field="priority">${selectOptions(['Essential','Preferred','Optional'],s.priority)}</select></label>${editField('Circle take','circleTake',s.circleTake)}<label class="field wide">Notes<textarea data-shot-field="notes" rows="3">${esc(s.notes)}</textarea></label></div>${coverageNotes(s)}<div class="shot-editor-actions"><button data-shot-action="take">＋ Take</button><button data-shot-action="duplicate">Duplicate</button><button class="danger" data-shot-action="delete">Delete</button></div><p class="shot-editor-note">Details save as you type. Actual time is entered manually and includes setup. Omitted shots are excluded from estimates.</p></div>`;
  }
  function render(){sync();const ds=c.dates(groups().length);
    return `<div class="shot-page-heading"><div><div class="eyebrow">CAMERA DEPARTMENT</div><h2>${title}</h2><p>${orderMode?'One production-wide filming order. Shared shots; independent arrangement.':'Plan the coverage. Keep the day moving.'}</p></div><div class="shot-heading-tools"><button data-shot-action="csv">Export shots</button><button data-shot-action="print">Print / PDF</button></div></div><div id="shot-metrics">${metrics()}</div><div class="shot-toolbar">${c.scenarioSelect()}<label>Shoot day<select id="shot-day"><option value="all" ${day==='all'?'selected':''}>All days</option>${groups().map((g,i)=>`<option value="${i}" ${day===String(i)?'selected':''}>Day ${i+1} · ${esc(c.dateLabel(ds[i]))}</option>`).join('')}<option value="unscheduled" ${day==='unscheduled'?'selected':''}>Unscheduled</option></select></label><label>Scene<select id="shot-scene"><option value="all">All scenes</option>${sceneOptions(scene)}</select></label><label>Status<select id="shot-status"><option value="all">All statuses</option>${selectOptions(statuses,status)}</select></label><label class="shot-start">Start time<input type="time" id="shot-start" value="${esc(p()._shotSettings.startTime)}" ${day==='all'?'disabled':''}></label></div><div class="shot-layout"><section class="panel shot-list-panel"><div class="panel-header"><div class="panel-title">${orderMode?'Filming order':'Shooting order'} <span class="count" id="shot-count">${filtered().length} shots</span></div><span class="tiny">${orderMode?'DRAG STRIPS · CLICK ⠿ TO MOVE':'↑ ↓ SELECT · DRAG TO REORDER'}</span></div><div class="shot-search-wrap"><input id="shot-search" type="search" aria-label="Search shots" placeholder="Search shots, cameras, notes…" value="${esc(search)}"></div><div class="shot-list ${orderMode?'board-scroll shot-order-board':''}" id="shot-list" tabindex="0" role="region" aria-label="${title}. Up and Down select a shot.">${rows()}</div><div class="panel-footer">${orderMode?'Drag top/bottom halves to insert before/after. Esc cancels. Hidden shots keep their relative order. New shots append. Scene days are reference only.':day==='all'?'All days show cumulative minute offsets. Select one day for clock times.':'Times follow the day’s full shot order, including shots hidden by filters.'}</div></section><section class="panel shot-editor" id="shot-editor">${editor()}</section></div>`;
  }
  function refreshEditor(){
    const top=document.querySelector('.shot-editor-scroll')?.scrollTop||0;
    document.querySelector('#shot-editor').innerHTML=editor();bindEditor();
    const scroll=document.querySelector('.shot-editor-scroll');if(scroll)scroll.scrollTop=top;
  }
  function updateSelection(){
    document.querySelectorAll('#shot-list [data-shot]').forEach(row=>{
      const active=row.dataset.shot===selected;row.classList.toggle('selected',active);
      const button=row.querySelector('[data-shot-select]');button.setAttribute('aria-pressed',String(active));button.tabIndex=active?0:-1;
    });
  }
  function revealRow(row){
    const list=document.querySelector('#shot-list'),bounds=list.getBoundingClientRect(),box=row.getBoundingClientRect();
    const top=bounds.top+list.clientTop,bottom=top+list.clientHeight;
    // Touch only this scroll pane; scrolling ancestors would move the whole workspace.
    if(box.height>list.clientHeight){if(box.top<top||box.top>=bottom)list.scrollTop+=box.top-top;}
    else if(box.top<top)list.scrollTop+=box.top-top;
    else if(box.bottom>bottom)list.scrollTop+=box.bottom-bottom;
  }
  function selectShot(sid,keyboard=false){
    if(!filtered().some(s=>s.id===sid))return;
    if(selected!==sid){selected=sid;updateSelection();refreshEditor();}
    if(keyboard){const button=[...document.querySelectorAll('#shot-list [data-shot-select]')].find(b=>b.dataset.shotSelect===sid);if(button){button.focus({preventScroll:true});revealRow(button.closest('[data-shot]'));}}
  }
  function refreshList(){
    const list=document.querySelector('#shot-list'),top=list.scrollTop,left=list.scrollLeft,previous=selected;
    if(!filtered().some(s=>s.id===selected))selected=filtered()[0]?.id;
    document.querySelector('#shot-metrics').innerHTML=metrics();list.innerHTML=rows();list.scrollTop=top;list.scrollLeft=left;
    document.querySelector('#shot-count').textContent=`${filtered().length} shots`;
    if(previous!==selected)refreshEditor();
    const heading=document.querySelector('#shot-detail-label');if(heading&&shot())heading.textContent=label(shot());bindRows();
  }
  function captureState(){return {kind:orderMode?'shot-order':'shots',production:p().id,selected,index:filtered().findIndex(s=>s.id===selected),top:document.querySelector('#shot-list')?.scrollTop||0,left:document.querySelector('#shot-list')?.scrollLeft||0,editorTop:document.querySelector('.shot-editor-scroll')?.scrollTop||0,pageTop:document.scrollingElement.scrollTop,pageLeft:document.scrollingElement.scrollLeft,focusInList:!!document.activeElement?.closest?.('#shot-list')};}
  function restoreView(state){
    const list=document.querySelector('#shot-list'),editor=document.querySelector('.shot-editor-scroll');
    if(list){list.scrollTop=state.top;list.scrollLeft=state.left;}if(editor)editor.scrollTop=state.editorTop;
    document.scrollingElement.scrollTop=state.pageTop;document.scrollingElement.scrollLeft=state.pageLeft;
  }
  function refreshHistory(previous){
    if(production!==p().id||!document.querySelector('#shot-list'))return false;
    const current=captureState(),visible=filtered();
    const prior=previous?.kind===(orderMode?'shot-order':'shots')&&previous.production===p().id?previous:undefined;
    selected=visible.find(s=>s.id===prior?.selected)?.id||visible.find(s=>s.id===selected)?.id||visible[Math.max(0,Math.min(current.index,visible.length-1))]?.id;
    refreshList();refreshEditor();restoreView(current);
    if(prior&&Math.abs(prior.top-current.top)<=document.querySelector('#shot-list').clientHeight){const row=document.querySelector('#shot-list .selected');if(row)revealRow(row);}
    if(current.focusInList)document.querySelector('#shot-list .selected [data-shot-select]')?.focus({preventScroll:true});
    return true;
  }
  function keepView(fn){const state=captureState();fn();restoreView(state);}
  function moveBefore(moving,target){if(moving===target)return;keepView(()=>c.mutate(()=>{const list=p()._shots,s=list.find(s=>s.id===moving);if(!s)return;list.splice(list.indexOf(s),1);list.splice(list.findIndex(s=>s.id===target),0,s);}));}
  function commitOrder(bid,boards){
    keepView(()=>{c.mutate(()=>{p()._shotShootingOrder=boards[1];selected=bid;});});
    document.querySelector('#shot-list .selected [data-shot-select]')?.focus({preventScroll:true});
    c.toast('Shot moved. Undo restores its previous position.');
  }
  const orderDrag=orderMode?createStripDrag({project:p,scenario:()=>orderBoard,hasItem:bid=>p()._shots.some(s=>s.id===bid),label:bid=>label(p()._shots.find(s=>s.id===bid)),
    destination:(target,y,root)=>{
      const pane=root.querySelector('#shot-list');if(!pane?.contains(target))return null;
      const row=target.closest('[data-shot]');if(row){const r=row.getBoundingClientRect(),after=y>=r.top+r.height/2;return {zone:'board',index:1,position:orderBoard.boards[1].breakdownIds.indexOf(row.dataset.shot)+(after?1:0),anchor:row,after,container:pane};}
      const rows=[...pane.querySelectorAll('[data-shot]')],next=rows.find(row=>y<row.getBoundingClientRect().top+row.getBoundingClientRect().height/2),anchor=next||rows.at(-1)||pane;
      return {zone:'board',index:1,position:next?orderBoard.boards[1].breakdownIds.indexOf(next.dataset.shot):orderBoard.boards[1].breakdownIds.length,anchor,after:!next,container:pane};
    },describe:d=>{const next=orderBoard.boards[1].breakdownIds[d.position];return 'Filming order · '+(next?'before '+label(p()._shots.find(s=>s.id===next)):'at the end');},commit:commitOrder}):null;
  function moveDialog(sid){
    const project=p(),ids=shotShootingOrder(project),shots=new Map(project._shots.map(s=>[s.id,s]));
    c.modal('Move shot '+esc(label(shots.get(sid))),'<p>Place this shot in the full filming order, including shots hidden by filters.</p><label class="field">Place before<select id="shot-move-target">'+ids.filter(id=>id!==sid).map(id=>`<option value="${esc(id)}">${esc(label(shots.get(id)))} · ${esc(shots.get(id).description)}</option>`).join('')+'<option value="">End of filming order</option></select></label>','<button id="modal-cancel">Cancel</button><button class="primary" id="shot-move-save">Move shot</button>');
    document.querySelector('#shot-move-target').value=ids[ids.indexOf(sid)+1]||'';
    document.querySelector('#shot-move-save').onclick=()=>{
      if(p()!==project||JSON.stringify(shotShootingOrder(p()))!==JSON.stringify(ids)){c.toast('The shot order changed. Open Move again.');return;}
      const target=document.querySelector('#shot-move-target').value,scenario={boards:[{breakdownIds:[]},{breakdownIds:ids}]};
      const plan=planStripMove(scenario,sid,{zone:'board',index:1,position:target?ids.indexOf(target):ids.length});
      document.querySelector('#modal').close();if(plan)commitOrder(sid,plan);
    };
    document.querySelector('#shot-move-target').focus();
  }
  function bindRows(){
    if(orderMode){
      orderDrag.stop();orderBoard={boards:[{breakdownIds:[]},{name:'Filming order',breakdownIds:shotShootingOrder(p())}]};
      document.querySelectorAll('[data-move-strip]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(!orderDrag.consumeClick(b.dataset.moveStrip,e))moveDialog(b.dataset.moveStrip);});
      orderDrag.bind(document.querySelector('#content'));
    }
    document.querySelectorAll('[data-shot-select]').forEach(b=>b.onclick=e=>{if(!orderMode||!orderDrag.consumeClick(b.dataset.shotSelect,e))selectShot(b.dataset.shotSelect);});
    document.querySelectorAll('[data-shot-done]').forEach(b=>b.onclick=()=>c.mutate(()=>{const s=p()._shots.find(s=>s.id===b.dataset.shotDone);s.status=done(s)?'Planned':'Done';}));
    document.querySelectorAll('[data-shot]').forEach(row=>{
      row.oncontextmenu=e=>{const sid=row.dataset.shot;deleteMenu.open(e,()=>deleteShot(sid));};
      if(orderMode){row.querySelector('[data-shot-select]').onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();selectShot(row.dataset.shot);}};return;}
      row.ondragstart=e=>{dragging=row.dataset.shot;e.dataTransfer.setData('text/plain',dragging);e.dataTransfer.effectAllowed='move';};
      row.ondragend=()=>{dragging=null;document.querySelectorAll('.shot-drop').forEach(r=>r.classList.remove('shot-drop'));};
      row.ondragover=e=>{if(!dragging)return;e.preventDefault();row.classList.add('shot-drop');};
      row.ondragleave=()=>row.classList.remove('shot-drop');
      row.ondrop=e=>{e.preventDefault();if(dragging)moveBefore(dragging,row.dataset.shot);dragging=null;};
    });
    document.querySelectorAll('#shot-list [data-shot-action]').forEach(b=>b.onclick=()=>action(b.dataset.shotAction));
  }
  function bind(){
    bindRows();
    for(const [key,set] of [['day',v=>day=v],['scene',v=>scene=v],['status',v=>status=v]])document.querySelector('#shot-'+key).onchange=e=>{set(e.target.value);selected=filtered()[0]?.id;c.render();};
    document.querySelector('#shot-search').oninput=e=>{search=e.target.value;refreshList();};
    document.querySelector('#shot-start').onchange=e=>{if(e.target.checkValidity()&&e.target.value)c.mutate(()=>p()._shotSettings.startTime=e.target.value);};
    document.querySelectorAll('[data-shot-action]').forEach(b=>b.onclick=()=>action(b.dataset.shotAction));
    bindEditor();
  }
  function bindEditor(){
    document.querySelectorAll('#shot-editor [data-shot-action]').forEach(b=>b.onclick=()=>action(b.dataset.shotAction));
    document.querySelectorAll('[data-shot-field]').forEach(input=>{
      let editing=false;const target=shot();
      const update=()=>{
        input.setCustomValidity('');
        if(!target||!input.reportValidity())return;
        const key=input.dataset.shotField,value=input.type==='number'?(key==='actualMinutes'&&input.value===''?null:Number(input.value)):key==='number'?normalizeShotNumber(input.value,sceneOf(target)?.scene):input.value;
        if(key==='number'&&(!value||value==='.'||value.length>24)){input.setCustomValidity('Enter a shot number.');input.reportValidity();return;}
        if((key==='number'||key==='sceneId')&&p()._shots.some(s=>s.id!==target.id&&s.sceneId===(key==='sceneId'?value:target.sceneId)&&numberKey(s.number,s.sceneId)===numberKey(key==='number'?value:target.number,key==='sceneId'?value:target.sceneId))){input.setCustomValidity('This scene already has that shot number.');input.reportValidity();return;}
        if(target[key]===value)return;
        c.edit(()=>target[key]=value,!editing);editing=true;refreshList();
      };
      input.oninput=update;input.onchange=()=>{update();editing=false;};input.onblur=()=>{editing=false;if(input.dataset.shotField==='number'){input.value=target.number;input.setCustomValidity('');}};
    });
  }
  function insertShot(data,after) {
    const selectors=['#shot-list','.shot-editor-scroll'];
    const positions=selectors.map(selector=>[selector,document.querySelector(selector)?.scrollTop||0]);
    const pageTop=document.scrollingElement.scrollTop;
    c.mutate(()=>{
      if(after)p()._shots.splice(p()._shots.indexOf(after)+1,0,data);else p()._shots.push(data);
      // Keep the user's view. A new planned shot can be hidden by a status,
      // search, scene, or day filter; creating it must not clear those filters.
      if(filtered().some(s=>s.id===data.id))selected=data.id;
    });
    document.querySelector('#modal').close();
    for(const [selector,top] of positions){const element=document.querySelector(selector);if(element)element.scrollTop=top;}
    document.scrollingElement.scrollTop=pageTop;
    if(!filtered().some(s=>s.id===data.id))c.toast('Shot added. It is hidden by your current filters.');
  }
  function add(){
    if(!scenes().length){c.toast('Add or import a scene before creating a shot.');return;}
    const initialScene=scene!=='all'?scene:shot()?.sceneId||c.selectedScene()||scenes()[0].id;
    const validScene=scenes().some(b=>b.id===initialScene)?initialScene:scenes()[0].id;
    const setup=shot()?.setupMinutes??10,shoot=shot()?.shootMinutes??15;
    c.modal('Add a shot',`<p>Link the shot to a scene. Its shooting day follows that scene’s schedule.</p><form id="new-shot-form"><div class="form-grid"><label class="field wide">Scene<select id="new-shot-scene">${sceneOptions(validScene)}</select></label><label class="field">Shot number / suffix<input id="new-shot-number" value="${esc(nextNumber(validScene))}" required maxlength="24"></label><label class="field">Shot size<input id="new-shot-size" value="Wide" list="new-shot-sizes"><datalist id="new-shot-sizes">${sizes.map(v=>`<option value="${esc(v)}">`).join('')}</datalist></label><label class="field wide">Description<textarea id="new-shot-description" placeholder="e.g. Wide master — Maya enters the kitchen" rows="3" required></textarea></label><label class="field">Setup (minutes)<input id="new-shot-setup" type="number" value="${setup}" min="0" max="1440" step="1" required></label><label class="field">Shoot (minutes)<input id="new-shot-shoot" type="number" value="${shoot}" min="0" max="1440" step="1" required></label></div></form>`,'<button id="modal-cancel">Cancel</button><button id="new-shot-save" class="primary">Add shot</button>');
    document.querySelector('#new-shot-scene').onchange=e=>document.querySelector('#new-shot-number').value=nextNumber(e.target.value);
    document.querySelector('#new-shot-save').onclick=()=>{
      const form=document.querySelector('#new-shot-form');if(!form.reportValidity())return;
      const sceneId=document.querySelector('#new-shot-scene').value,number=normalizeShotNumber(document.querySelector('#new-shot-number').value,scenes().find(b=>b.id===sceneId)?.scene),description=document.querySelector('#new-shot-description').value.trim();
      if(!number||number==='.'||number.length>24||!description)return;
      if(p()._shots.some(s=>s.sceneId===sceneId&&numberKey(s.number,s.sceneId)===numberKey(number,sceneId))){document.querySelector('#modal-error').textContent='This scene already has that shot number.';return;}
      const data={id:id(),created:stamp(),sceneId,number,description,size:document.querySelector('#new-shot-size').value,movement:'Static',camera:'A',lens:'',equipment:'Tripod',setupMinutes:Number(document.querySelector('#new-shot-setup').value),shootMinutes:Number(document.querySelector('#new-shot-shoot').value),actualMinutes:null,takes:0,circleTake:'',priority:'Essential',notes:'',status:'Planned'};
      insertShot(data);
    };
    document.querySelector('#new-shot-description').focus();
  }
  function csv(){sync();const rows=[['Day','Scene','Shot','Description','Size','Movement','Camera','Lens mm','Equipment','Setup minutes','Shoot minutes','Actual minutes','Status','Takes','Circle take','Priority','Notes','Script coverage'],...filtered().map(s=>[dayName(s),sceneOf(s)?.scene,label(s),s.description,s.size,s.movement,s.camera,s.lens,s.equipment,s.setupMinutes,s.shootMinutes,s.actualMinutes,s.status,s.takes,s.circleTake,s.priority,s.notes,coverageSummary(p(),s.id).join('\n')])];const safe=v=>{let value=String(v??'');if(/^[=+@\-\t\r]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';};c.download(orderMode?'shot-shooting-order.csv':'shot-list.csv',rows.map(row=>row.map(safe).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
  function print(){const times=timings();document.querySelector('#print-area').innerHTML=`<h1>${esc(p().project||p().name)} · ${title}</h1><p>${esc(c.scenarioName())} · ${day==='all'?'All days':day==='unscheduled'?'Unscheduled':'Day '+(Number(day)+1)} · ${filtered().length} shots</p><table><thead><tr><th>Day / Time</th><th>Shot</th><th>Description</th><th>Camera setup</th><th>Est. / Actual</th><th>Status / Takes</th><th>Notes</th></tr></thead><tbody>${filtered().map(s=>`<tr><td>${esc(dayName(s))}<br>${esc(times.get(s.id))}</td><td>${esc(label(s))}</td><td>${esc(s.description)}</td><td>${esc([s.size,s.camera&&'Cam '+s.camera,s.lens&&s.lens+'mm',s.movement,s.equipment].filter(Boolean).join(' · '))}</td><td>${total(s)} / ${s.actualMinutes??'—'} min</td><td>${esc(s.status)} · ${s.takes}${s.circleTake?' · circle '+esc(s.circleTake):''}</td><td>${esc([s.notes,...coverageSummary(p(),s.id)].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table>`;window.print();}
  function deleteShot(sid){
    const project=p(),s=project._shots.find(s=>s.id===sid);if(!s)return;
    const remove=()=>{
      if(p()!==project||!project._shots.includes(s))return;
      const state=captureState(),visible=filtered(),index=visible.indexOf(s),neighbor=visible[index+1]||visible[index-1];
      c.mutate(()=>{removeCoverage(project,[s.id]);project._shots=project._shots.filter(x=>x.id!==s.id);if(selected===sid)selected=neighbor?.id;},false);
      refreshList();refreshEditor();restoreView(state);
      // The generic confirmation closes after this callback; focus the surviving
      // row only after it closes, without scrolling either pane or the page.
      queueMicrotask(()=>{if(p()===project&&c.isActive()){document.querySelector('#shot-list .selected [data-shot-select]')?.focus({preventScroll:true});restoreView(state);}});
    };
    if(coverageSummary(project,sid).length)confirmLinkedDelete(c,'shots','Delete shot '+esc(label(s))+'?', 'This shot is linked to Lined script. Deleting it removes the shot and all of its linked coverage lines, including lines in other PDF revisions.',remove);
    else c.confirm('Delete shot '+esc(label(s))+'?','You can undo this change.',remove);
  }
  function action(name){
    if(name==='new')return add();if(name==='csv')return csv();if(name==='print')return print();
    const s=shot();if(!s)return;
    if(name==='take')c.mutate(()=>s.takes=Math.min(10000,s.takes+1));
    if(name==='duplicate')insertShot({...structuredClone(s),id:id(),created:stamp(),number:nextNumber(s.sceneId),status:'Planned',actualMinutes:null,takes:0,circleTake:''},s);
    if(name==='delete')deleteShot(s.id);
    if(orderMode&&(name==='up'||name==='down')){const visible=filtered(),i=visible.findIndex(x=>x.id===s.id),neighbor=visible[i+(name==='up'?-1:1)];if(neighbor){const ids=shotShootingOrder(p()),plan=planStripMove({boards:[{breakdownIds:[]},{breakdownIds:ids}]},s.id,{zone:'board',index:1,position:ids.indexOf(neighbor.id)+(name==='down'?1:0)});if(plan)commitOrder(s.id,plan);}return;}
    if(name==='up'||name==='down'){const visible=filtered(),i=visible.indexOf(s),neighbor=visible[i+(name==='up'?-1:1)];if(neighbor)keepView(()=>c.mutate(()=>{const list=p()._shots,a=list.indexOf(s),b=list.indexOf(neighbor);[list[a],list[b]]=[list[b],list[a]];}));}
  }
  function focusedControl(target){
    if(isEditing(target))return true;
    const control=target?.closest?.('button,a[href],summary,[role="button"],[role="slider"],[role="spinbutton"],[role="listbox"],[role="menu"],[role="menuitem"],[role="tab"],[role="tree"],[role="grid"],[tabindex]');
    return control&&!control.matches('[data-shot-select],#shot-list');
  }
  document.addEventListener('keydown',event=>{
    if(!c.isActive()||event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||dragging||document.querySelector('dialog[open]')||!['ArrowUp','ArrowDown'].includes(event.key)||focusedControl(document.activeElement)||focusedControl(event.target))return;
    const list=filtered();if(!list.length)return;
    const index=list.findIndex(s=>s.id===selected),step=event.key==='ArrowDown'?1:-1;
    const next=index<0?(step>0?0:list.length-1):Math.max(0,Math.min(list.length-1,index+step));
    event.preventDefault();selectShot(list[next].id,true);
  });
  return {render,bind,add,csv,print,captureState,refreshHistory,stop:()=>orderDrag?.stop()};
}
