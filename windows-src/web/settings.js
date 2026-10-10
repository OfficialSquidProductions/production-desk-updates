export function createAppSettings({api,modal,toast,isIPad}) {
  let preferences={theme:'light'};
  const $=s=>document.querySelector(s);
  const applyTheme=theme=>{document.documentElement.dataset.theme=theme;};
  async function init(){
    if(isIPad){
      try{preferences.theme=localStorage.getItem('productionDeskTheme')==='dark'?'dark':'light';}catch{}
    }else{
      try{preferences=(await api('/api/settings')).preferences;}catch(e){toast(e.message);}
    }
    applyTheme(preferences.theme);
  }
  async function persist(theme){
    if(isIPad){
      localStorage.setItem('productionDeskTheme',theme);
      preferences={theme};
    }else preferences=(await api('/api/settings',{theme})).preferences;
  }
  function open(){
    modal('Settings',`<div id="app-settings"><section class="settings-section"><h3>Appearance</h3><p>Choose how Production Desk looks on this device.</p><div class="theme-options" role="group" aria-label="Appearance"><button data-theme-choice="light" aria-pressed="${preferences.theme==='light'}"><span>☀</span>Light</button><button data-theme-choice="dark" aria-pressed="${preferences.theme==='dark'}"><span>☾</span>Dark</button></div></section><p id="settings-status" role="status"></p></div>`);
    const buttons=[...document.querySelectorAll('[data-theme-choice]')];
    const message=$('#settings-status');
    for(const button of buttons)button.onclick=async()=>{
      const previous=preferences.theme,theme=button.dataset.themeChoice;
      message.textContent='';
      applyTheme(theme);
      for(const b of buttons){b.disabled=true;b.setAttribute('aria-pressed',String(b===button));}
      try{await persist(theme);}catch(e){
        applyTheme(previous);
        for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.themeChoice===previous));
        message.textContent='Appearance could not be saved: '+e.message;
        message.classList.add('modal-error');
      }finally{for(const b of buttons)b.disabled=false;}
    };
  }
  return {init,open};
}
