// Compatibility checks after removing the separate filming-order view.
module.exports = async function runShotOrderChecks(){
  const $=s=>document.querySelector(s),expect=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const saved=async()=>{expect(await window.slateDesktop.flush(),'Compatibility save failed');const w=await(await fetch('/api/workspace')).json();return w.projects.find(p=>p.id===w.activeProject);};
  const wait=async f=>{const end=Date.now()+15000;while(!f()){if(Date.now()>end)throw Error('Compatibility export timed out');await new Promise(r=>setTimeout(r,25));}};
  if($('#modal').open)$('#modal').close();
  expect(!$('[data-view="shot-order"]'),'Removed Shot Shooting Order tab is present');
  expect(!!$('[data-view="shots"]'),'Regular Shot List is missing');
  const file=await(await fetch('/demo/the-last-light.productiondesk')).json(),p=file.workspace.projects[0];
  p.id=crypto.randomUUID();p.project='Retired shot order compatibility QA';file.workspace.activeProject=p.id;
  // Older clients may contain IDs for deleted shots; preserve this opaque field.
  const order=p._shotShootingOrder=[...p._shots.map(s=>s.id).reverse(),'older-client-deleted-shot'];
  await window.slateDesktop.importProjectFile(new File([JSON.stringify(file)],'Compatibility.productiondesk'));
  $('[data-view="shots"]').click();
  const rows=()=>[...document.querySelectorAll('#shot-list [data-shot]')].map(r=>r.dataset.shot);
  expect(same(rows(),p._shots.map(s=>s.id)),'Regular Shot List used retired filming order');
  expect(same((await saved())._shotShootingOrder,order),'Import/viewing altered saved filming data');
  const notes=$('[data-shot-field="notes"]');notes.value='Regular Shot List remains editable';notes.dispatchEvent(new Event('input',{bubbles:true}));notes.blur();
  const beforeMove=await saved();$('[data-shot-action="down"]').click();
  expect(!same((await saved())._shots,beforeMove._shots),'Regular Shot List reorder failed');
  expect(same((await saved())._shotShootingOrder,order),'Regular edit/reorder altered retired data');
  $('#undo').click();expect(same((await saved())._shots,beforeMove._shots),'Regular Shot List reorder Undo failed');
  $('#redo').click();expect(same((await saved())._shotShootingOrder,order),'Redo altered retired data');
  $('[data-view="schedule"]').click();$('[data-view="shots"]').click();
  let download;const click=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(this.href.includes('/api/download/')){download=this.href;return;}return click.call(this);};
  let portable;
  try{$('#save-as-open').click();await wait(()=>!!download);portable=await(await fetch(download)).json();}finally{HTMLAnchorElement.prototype.click=click;}
  const expected=await saved();expect(same(portable.workspace.projects[0],expected),'Portable export changed project fields');
  expect(same(portable.workspace.projects[0]._shotShootingOrder,order),'Portable export lost retired data');
  await window.slateDesktop.importProjectFile(new File([JSON.stringify(portable)],'Recipient.productiondesk'));
  expect(same((await saved())._shotShootingOrder,order),'Portable recipient import lost retired data');
  $('[data-view="shots"]').click();expect(same(rows(),expected._shots.map(s=>s.id)),'Recipient changed regular Shot List order');
  expect(!$('[data-view="shot-order"]'),'Import recreated removed navigation');
  return ['Shot Shooting Order navigation and route removed; regular Shot List editing/reorder/Undo/Redo remain available',
    'Older filming-order data, including stale IDs, survives import, viewing, editing, save and portable export/recipient import unchanged'];
};
