module.exports = async function runSettingsDialogChecks(){
 const $=s=>document.querySelector(s),expect=(v,m)=>{if(!v)throw Error(m);},checks=[];
 const wait=async f=>{for(let i=0;i<300;i++){if(await f())return;await new Promise(r=>setTimeout(r,20));}throw Error('Settings persistence timed out');};
 const preferences=async()=>(await(await fetch('/api/settings')).json()).preferences;
 const saved=async()=>{expect(await window.slateDesktop.flush(),'Settings fixture save failed');const w=await(await fetch('/api/workspace')).json();return w.projects.find(p=>p.id===w.activeProject);};
 const outside=()=>{
   const dialog=$('#modal'),rect=dialog.getBoundingClientRect();expect(rect.left>1||rect.top>1,'No exposed backdrop');
   const x=rect.left>1?1:rect.right+1,y=rect.top>1?1:rect.bottom+1;
   let bubbled=0;const count=()=>bubbled++;document.addEventListener('click',count);
   dialog.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x,clientY:y,pointerId:8}));
   expect(dialog.open,'Backdrop dismissed before consuming the click');
   dialog.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,clientX:x,clientY:y,pointerId:8}));
   dialog.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y}));
   document.removeEventListener('click',count);expect(!dialog.open&&bubbled===0,'Backdrop did not dismiss safely or click escaped to the app');
 };
 const inside=()=>{const dialog=$('#modal'),body=$('.modal-body'),r=body.getBoundingClientRect();body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+10,clientY:r.top+10}));body.click();expect(dialog.open,'Inside click dismissed Settings');};
 for(const selector of ['#app-settings-open','#settings-open'])for(let i=0;i<3;i++){
   $(selector).click();expect($('#modal').open,'Settings did not open');inside();outside();
   $(selector).click();inside();$('#modal-close').click();expect(!$('#modal').open,'Settings X did not dismiss');
 }
 checks.push('Both Settings dialogs repeatedly close from their backdrop or X, retain inside clicks and consume outside clicks before releasing the modal');
 $('#app-settings-open').click();
 const rows=[...document.querySelectorAll('.lined-annotation-option')],first=rows[0].getBoundingClientRect(),second=rows[1].getBoundingClientRect(),keyBinds=$('#lined-key-binds').getBoundingClientRect();
 expect(first.height>=32&&second.top>=first.bottom+7,'Annotation option rows are cramped');expect(keyBinds.top>=second.bottom+16,'Key Binds crowds the annotation options');
 for(const row of rows){const box=row.querySelector('input').getBoundingClientRect(),text=row.querySelector('span').getBoundingClientRect();expect(box.width===16&&Math.abs(box.top+box.height/2-(text.top+parseFloat(getComputedStyle(row).lineHeight)/2))<3,'Checkbox and first text line are not aligned');}
 $('#modal-close').click();checks.push('Annotation options have separate aligned sentence-case rows and a clear gap before Key Binds');
 const initial=(await preferences()).linedShowMovement??false;
 $('#app-settings-open').click();$('#lined-show-movement').click();outside();
 // Reopening another dialog while the device preference save is pending must
 // neither lose the save nor write its status into a newly opened dialog.
 $('#settings-open').click();await wait(async()=>((await preferences()).linedShowMovement??false)===!initial);expect($('#modal').open,'Preference completion closed Production settings');$('#modal-close').click();
 $('#app-settings-open').click();expect($('#lined-show-movement').checked===!initial,'Global setting was not saved after backdrop close');$('#lined-show-movement').click();await wait(()=>!$('#lined-show-movement').disabled);outside();await wait(async()=>((await preferences()).linedShowMovement??false)===initial);
 checks.push('Global settings autosave through outside dismissal, survive reopening and tolerate a pending save while Production settings opens');
 const original=await saved(),title=original.project||original.name;
 $('#settings-open').click();$('[data-field="title"]').value='Unsaved outside draft';inside();outside();expect((await saved()).project===original.project,'Outside dismissal saved an unsubmitted production draft');
 $('#settings-open').click();expect($('[data-field="title"]').value===title,'Outside dismissal retained an unsubmitted draft');$('[data-field="title"]').value=title+' · saved settings QA';$('#settings-submit').click();expect(!$('#modal').open,'Save settings did not close');
 const committed=(await saved()).project;expect(committed===title+' · saved settings QA','Production settings Save did not persist');
 $('#settings-open').click();$('[data-field="title"]').value='Unsaved X draft';$('#modal-close').click();expect((await saved()).project===committed,'X dismissal saved an unsubmitted draft');
 $('#settings-open').click();expect($('[data-field="title"]').value===committed,'Saved production title was lost');$('[data-field="title"]').value=title;$('#settings-submit').click();await saved();
 checks.push('Production settings Save still commits explicitly; backdrop and X discard drafts consistently; saved values persist on reopening');
 return checks;
};
