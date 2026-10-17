// Device preferences are independent for deletion from each tab.
const keys={shots:'productionDeskSkipShotLinkDelete',lined:'productionDeskSkipCoverageLinkDelete'};
const skipped=new Set();
export function resetLinkedDeleteWarnings(){for(const key of Object.values(keys)){skipped.delete(key);try{localStorage.removeItem(key);}catch{}}}
export function confirmLinkedDelete(c,source,title,message,remove){
  const key=keys[source];let skip=skipped.has(key);try{skip||=localStorage.getItem(key)==='true';}catch{}
  if(skip){remove();return;}
  c.modal(title,`<p>${c.esc(message)} You can undo this change.</p><label class="delete-warning-choice"><input id="linked-delete-skip" type="checkbox">Don’t show again for deletions from ${source==='shots'?'Shot list':'Lined script'}</label>`, '<button id="modal-cancel">Cancel</button><button id="modal-ok" class="danger">Delete both</button>');
  document.querySelector('#modal-ok').onclick=()=>{
    if(document.querySelector('#linked-delete-skip').checked){skipped.add(key);try{localStorage.setItem(key,'true');}catch{}}
    document.querySelector('#modal').close();remove();
  };
}
export function createDeleteMenu(name){
  const menu=document.createElement('div');menu.className='linked-context-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label',name+' actions');
  const button=document.createElement('button');button.type='button';button.className='danger';button.setAttribute('role','menuitem');button.textContent='Delete '+name;menu.append(button);document.body.append(menu);
  let action,origin;
  const close=(restore=false)=>{menu.hidden=true;action=null;if(restore&&origin?.isConnected)origin.focus();};
  button.onclick=()=>{const callback=action;close();callback?.();};
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))close();},true);
  document.addEventListener('keydown',e=>{if(!menu.hidden&&['Escape','Tab'].includes(e.key)){close(true);if(e.key==='Escape')e.preventDefault();}},true);
  document.addEventListener('scroll',()=>close(),true);window.addEventListener('resize',()=>close());document.addEventListener('production-delete-menu',()=>close());
  return {open(event,callback){event.preventDefault();document.dispatchEvent(new Event('production-delete-menu'));origin=event.target;action=callback;menu.hidden=false;const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-r.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-r.height-8))+'px';button.focus();},close};
}
