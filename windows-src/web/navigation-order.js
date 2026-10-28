export const NAVIGATION_TABS = Object.freeze({
  workspace:'Main breakdown', lined:'Lined script', shots:'Shot list',
  schedule:'Shooting schedule', reports:'Reports', elements:'Elements'
});
export const DEFAULT_NAVIGATION_ORDER = Object.freeze(Object.keys(NAVIGATION_TABS));

export function navigationOrder(value) {
  return Array.isArray(value) && value.length===DEFAULT_NAVIGATION_ORDER.length &&
    new Set(value).size===value.length && value.every(id=>typeof id==='string'&&Object.hasOwn(NAVIGATION_TABS,id))
    ? [...value] : [...DEFAULT_NAVIGATION_ORDER];
}

export function moveNavigationTab(value,id,direction) {
  const order=navigationOrder(value),from=order.indexOf(id),to=from+direction;
  if(from<0 || ![-1,1].includes(direction) || to<0 || to>=order.length)return order;
  [order[from],order[to]]=[order[to],order[from]];
  return order;
}

export function applyNavigationOrder(navigation,value) {
  if(!navigation)return;
  const buttons=new Map([...navigation.querySelectorAll('[data-view]')].map(button=>[button.dataset.view,button]));
  // Move the existing controls only. Keep their active state, handlers and the
  // current editor DOM, selection, unsaved fields and scroll position intact.
  for(const id of navigationOrder(value))if(buttons.has(id))navigation.append(buttons.get(id));
}

export function navigationOrderSettings({get,persist}) {
  const section=document.createElement('section');
  section.className='settings-section navigation-settings';
  section.innerHTML='<div class="navigation-order-heading"><h3>Navigation tabs</h3><button type="button" id="navigation-order-reset">Restore default order</button></div><p id="navigation-order-help">Use Move up or Move down to arrange your tabs. Changes are saved on this device.</p><ol id="navigation-order-list" aria-label="Navigation tab order" aria-describedby="navigation-order-help"></ol><p id="navigation-order-status" role="status" aria-live="polite"></p>';
  const list=section.querySelector('#navigation-order-list'),reset=section.querySelector('#navigation-order-reset'),status=section.querySelector('#navigation-order-status');
  let busy=false;
  const isDefault=order=>order.every((id,index)=>id===DEFAULT_NAVIGATION_ORDER[index]);
  function controls() {
    const order=navigationOrder(get().navigationOrder);
    for(const button of list.querySelectorAll('button')) {
      const index=order.indexOf(button.dataset.tab);
      button.disabled=busy || (button.dataset.direction==='-1'?index===0:index===order.length-1);
    }
    reset.disabled=busy || isDefault(order);
    section.setAttribute('aria-busy',String(busy));
  }
  function render(focusId,focusDirection) {
    list.innerHTML=navigationOrder(get().navigationOrder).map((id,index)=>`<li class="navigation-order-row"><span class="navigation-order-label"><span aria-hidden="true">${index+1}.</span>${NAVIGATION_TABS[id]}</span><button type="button" data-tab="${id}" data-direction="-1" aria-label="Move ${NAVIGATION_TABS[id]} up" title="Move up">↑</button><button type="button" data-tab="${id}" data-direction="1" aria-label="Move ${NAVIGATION_TABS[id]} down" title="Move down">↓</button></li>`).join('');
    controls();
    if(focusId && section.isConnected) {
      const rowButtons=[...list.querySelectorAll('button')].filter(button=>button.dataset.tab===focusId);
      (rowButtons.find(button=>button.dataset.direction===String(focusDirection)&&!button.disabled)||rowButtons.find(button=>!button.disabled))?.focus();
    }
  }
  async function save(order,message,focusId,focusDirection) {
    if(busy)return;
    busy=true;controls();status.textContent='Saving tab order…';
    try { await persist({navigationOrder:order});status.textContent=message; }
    catch(error) { status.textContent='Tab order could not be saved: '+error.message; }
    finally { busy=false;render(focusId,focusDirection); }
  }
  list.addEventListener('click',event=>{
    const button=event.target.closest('button[data-tab]');
    if(!button||button.disabled||busy)return;
    const id=button.dataset.tab,direction=Number(button.dataset.direction),order=moveNavigationTab(get().navigationOrder,id,direction);
    void save(order,`${NAVIGATION_TABS[id]} is now tab ${order.indexOf(id)+1} of ${order.length}. Tab order saved.`,id,direction);
  });
  reset.onclick=()=>{void save([...DEFAULT_NAVIGATION_ORDER],'Default tab order restored.',DEFAULT_NAVIGATION_ORDER[0],1);};
  render();
  return section;
}
