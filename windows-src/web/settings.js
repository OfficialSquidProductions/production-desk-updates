import {LINED_ACTIONS,DEFAULT_BINDS,eventBinding,bindingError} from './lined-shortcuts.js';
import {resetLinkedDeleteWarnings} from './linked-actions.js';
export function createAppSettings({api,modal,toast,isIPad}) {
  let preferences={theme:'light'};
  const get=()=>({...preferences,linedKeyBinds:{...DEFAULT_BINDS,...preferences.linedKeyBinds},linedLabelOpacity:preferences.linedLabelOpacity??.94});
  const notify=()=>document.dispatchEvent(new Event('productiondesk:preferences'));
  const $=s=>document.querySelector(s);
  const applyTheme=theme=>{document.documentElement.dataset.theme=theme;};
  async function init(){
    if(isIPad){
      try{preferences=JSON.parse(localStorage.getItem('productionDeskPreferences')||'{}');preferences.theme=localStorage.getItem('productionDeskTheme')==='dark'?'dark':'light';}catch{preferences={theme:'light'};}
    }else{
      try{preferences=(await api('/api/settings')).preferences;}catch(e){toast(e.message);}
    }
    applyTheme(preferences.theme);notify();
  }
  async function persist(changes){
    if(isIPad){
      const next={...preferences,...changes};
      localStorage.setItem('productionDeskPreferences',JSON.stringify(next));
      localStorage.setItem('productionDeskTheme',next.theme);
      preferences=next;
    }else preferences=(await api('/api/settings',changes)).preferences;
    notify();
  }
  function keyBinds(){
    const draft={...get().linedKeyBinds};
    modal('Lined Script key binds',`<p>Select a field and press a shortcut. Delete or Backspace clears it. Mod means Command on Mac or Ctrl on Windows. Shortcuts pause while typing or using a dialog.</p><div class="key-bind-grid">${Object.entries(LINED_ACTIONS).map(([key,name])=>`<label class="field">${name}<input data-lined-binding="${key}" readonly aria-label="${name} shortcut"></label>`).join('')}</div>`,'<button id="modal-cancel">Cancel</button><button id="lined-reset-binds">Reset defaults</button><button id="lined-save-binds" class="primary">Save key binds</button>');
    const fields=[...document.querySelectorAll('[data-lined-binding]')];
    const refresh=()=>{for(const field of fields)field.value=draft[field.dataset.linedBinding]||'';$('#modal-error').textContent=bindingError(draft);};
    for(const field of fields)field.onkeydown=event=>{
      if(event.key==='Tab'||event.key==='Escape')return;
      event.preventDefault();event.stopPropagation();
      const binding=eventBinding(event);if(!binding)return;
      draft[field.dataset.linedBinding]=['Backspace','Delete'].includes(event.key)&&!event.metaKey&&!event.ctrlKey&&!event.altKey?'':binding;refresh();
    };
    $('#lined-reset-binds').onclick=()=>{Object.assign(draft,DEFAULT_BINDS);refresh();};
    $('#lined-save-binds').onclick=async()=>{
      const error=bindingError(draft);if(error){$('#modal-error').textContent=error;return;}
      const button=$('#lined-save-binds');button.disabled=true;
      try{await persist({linedKeyBinds:draft});open();$('#settings-status').textContent='Key binds saved.';}
      catch(error){$('#modal-error').textContent='Key binds could not be saved: '+error.message;}
      finally{button.disabled=false;}
    };
    refresh();
  }
  function open(){
    modal('Settings',`<div id="app-settings"><section class="settings-section"><h3>Appearance</h3><p>Choose how Production Desk looks on this device.</p><div class="theme-options" role="group" aria-label="Appearance"><button data-theme-choice="light" aria-pressed="${preferences.theme==='light'}"><span>☀</span>Light</button><button data-theme-choice="dark" aria-pressed="${preferences.theme==='dark'}"><span>☾</span>Dark</button></div></section><p id="settings-status" role="status"></p></div>`);
    window.productionDeskSupport?.attachSettings($('#app-settings'));
    const deletion=document.createElement('section');deletion.className='settings-section';
    deletion.innerHTML='<h3>Deletion warnings</h3><p>Show confirmations again when deleting linked shots and coverage lines.</p><button id="reset-delete-warnings">Reset deletion warnings</button>';
    $('#app-settings').append(deletion);
    const lined=document.createElement('section');lined.className='settings-section';
    lined.innerHTML='<h3>Lined Script</h3><button id="lined-key-binds">Key Binds</button><label class="field" for="lined-label-opacity">Information box opacity <output id="lined-opacity-value"></output></label><input id="lined-label-opacity" type="range" min="15" max="100" step="1"><p>Drag boxes into either page gutter. A connector identifies the owning coverage line. Exports keep gutter boxes inside the original PDF page.</p>';
    $('#app-settings').append(lined);$('#lined-key-binds').onclick=keyBinds;
    const opacity=$('#lined-label-opacity'),output=$('#lined-opacity-value');
    opacity.value=Math.round(get().linedLabelOpacity*100);output.textContent=opacity.value+'%';
    opacity.oninput=()=>output.textContent=opacity.value+'%';
    opacity.onchange=async()=>{opacity.disabled=true;try{await persist({linedLabelOpacity:Number(opacity.value)/100});$('#settings-status').textContent='Information box opacity saved.';}catch(error){opacity.value=Math.round(get().linedLabelOpacity*100);output.textContent=opacity.value+'%';$('#settings-status').textContent='Opacity could not be saved: '+error.message;}finally{opacity.disabled=false;}};
    $('#reset-delete-warnings').onclick=()=>{resetLinkedDeleteWarnings();$('#settings-status').textContent='Linked deletion warnings are enabled for both tabs.';};
    const buttons=[...document.querySelectorAll('[data-theme-choice]')];
    const message=$('#settings-status');
    for(const button of buttons)button.onclick=async()=>{
      const previous=preferences.theme,theme=button.dataset.themeChoice;
      message.textContent='';
      applyTheme(theme);
      for(const b of buttons){b.disabled=true;b.setAttribute('aria-pressed',String(b===button));}
      try{await persist({theme});}catch(e){
        applyTheme(previous);
        for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.themeChoice===previous));
        message.textContent='Appearance could not be saved: '+e.message;
        message.classList.add('modal-error');
      }finally{for(const b of buttons)b.disabled=false;}
    };
  }
  return {init,open,get};
}
