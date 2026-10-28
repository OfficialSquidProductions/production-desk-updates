module.exports = async function runNavigationOrderChecks({leaveCustom=false,afterReload=false}={}) {
  const $=selector=>document.querySelector(selector),checks=[],expect=(value,message)=>{if(!value)throw Error(message);};
  const defaults=['workspace','lined','shots','schedule','reports','elements'],custom=['lined','workspace','shots','schedule','reports','elements'];
  const order=()=>[...document.querySelectorAll('#navigation [data-view]')].map(button=>button.dataset.view);
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const native=!!window.webkit?.messageHandlers?.scheduler;
  const read=async path=>native?(await import('/native-platform.js')).nativeAPI(path):(await fetch(path)).json();
  const preferences=async()=>native?JSON.parse(localStorage.getItem('productionDeskPreferences')||'{}'):(await read('/api/settings')).preferences;
  const wait=async check=>{const deadline=Date.now()+10000;while(!check()){if(Date.now()>deadline)throw Error('Tab order timed out: '+$('#navigation-order-status')?.textContent);await new Promise(resolve=>setTimeout(resolve,20));}};
  const open=()=>{if($('#modal').open)$('#modal').close();$('#app-settings-open').click();};
  const settled=async()=>wait(()=>$('.navigation-settings').getAttribute('aria-busy')==='false'&&!$('#navigation-order-status').textContent.startsWith('Saving'));
  const reset=async()=>{if(!$('#navigation-order-reset').disabled){$('#navigation-order-reset').click();await settled();}expect(same(order(),defaults),'Restore default order did not restore all six tabs');};
  const move=async(id,direction)=>{const button=$(`[data-tab="${id}"][data-direction="${direction}"]`);expect(!button.disabled,'Requested tab move is unexpectedly disabled');button.click();await settled();};
  if(afterReload) {
    expect(same(order(),custom),'Custom tab order did not survive a new editor instance');
    expect(same((await preferences()).navigationOrder,custom),'Saved custom order differs after relaunch');
    open();await reset();$('#modal').close();
    return ['Custom navigation order survives a new editor instance; Restore default order persists the requested six-tab layout'];
  }
  expect(await window.slateDesktop.flush(),'Cannot start tab-order checks with an unfinished project save');
  const before=await read('/api/workspace'),beforePreferences=await preferences();
  const withoutOrder=value=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='navigationOrder'));
  const active=$('#navigation .active')?.dataset.view,content=$('#content');
  const draft=document.createElement('input');draft.value='Unsaved local editor draft';draft.setAttribute('data-navigation-qa','');content.append(draft);
  try {
    open();await reset();await move('lined',-1);
    expect(same(order(),custom),'Move up did not reorder the existing navigation controls');
    expect($('#navigation .active')?.dataset.view===active&&$('#content')===content&&draft.isConnected&&draft.value==='Unsaved local editor draft','Reordering recreated the editor or lost its active view/draft');
    expect(same((await preferences()).navigationOrder,custom),'Custom tab order was not stored');
    expect(same(withoutOrder(await preferences()),withoutOrder(beforePreferences)),'Tab order changed another device preference');
    expect(same(await read('/api/workspace'),before),'Tab order changed project data');
    expect([...document.querySelectorAll('#navigation-order-list button')].every(button=>{const rect=button.getBoundingClientRect();return rect.width>=44&&rect.height>=44;}),'Move controls are too small for touch');
    expect($('[data-tab="lined"][data-direction="-1"]').disabled&&!$('[data-tab="lined"][data-direction="1"]').disabled,'Boundary moves are not constrained');
    expect(document.activeElement===$('[data-tab="lined"][data-direction="1"]'),'Keyboard focus did not follow the moved tab to an enabled control');
    checks.push('Move controls save device tab order, preserve active editor/draft/project data and other preferences, expose 44px touch targets and retain keyboard focus');
    const saved=order(),originalFetch=window.fetch,originalSet=Storage.prototype.setItem;
    try {
      if(native)Storage.prototype.setItem=function(key,value){if(key==='productionDeskPreferences')throw Error('Synthetic storage failure');return originalSet.call(this,key,value);};
      else window.fetch=async function(input,options){if(String(input).endsWith('/api/settings')&&options?.method==='POST')return new Response(JSON.stringify({error:'Synthetic settings save failure'}),{status:500,headers:{'Content-Type':'application/json'}});return originalFetch.apply(this,arguments);};
      await move('reports',-1);
      expect($('#navigation-order-status').textContent.startsWith('Tab order could not be saved:'),'Failed preference save was reported as success');
      expect(same(order(),saved),'Failed save changed the live tab order');
      expect(same((await preferences()).navigationOrder,saved),'Failed save overwrote stored tab order');
    } finally {window.fetch=originalFetch;Storage.prototype.setItem=originalSet;}
    checks.push('Failed tab-order saves leave live and persisted order intact and provide an accessible error with retry controls');
    await reset();
    expect(same((await preferences()).navigationOrder,defaults),'Restored default order did not persist');
    if(leaveCustom)await move('lined',-1);
    $('#modal').close();
    expect($('#navigation .active')?.dataset.view===active&&draft.isConnected&&same(await read('/api/workspace'),before),'Restore default changed editor state or project data');
    checks.push('Restore default order saves the exact requested layout without rewriting projects or changing the active view');
  } finally {draft.remove();if($('#modal').open)$('#modal').close();}
  return checks;
};
