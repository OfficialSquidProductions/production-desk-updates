module.exports = async function runProjectImportChecks(){
  const $=s=>document.querySelector(s),checks=[],expect=(v,m)=>{if(!v)throw Error(m);};
  const read=async()=>{expect(await window.slateDesktop.flush(),'Import QA could not save');return(await fetch('/api/workspace')).json();};
  const active=w=>w.projects.find(p=>p.id===w.activeProject),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const file=value=>new File([JSON.stringify(value)],'Disposable.productiondesk');
  const originalFetch=window.fetch,anchorClick=HTMLAnchorElement.prototype.click;
  const close=()=>{if($('#modal').open)$('#modal').close();};
  const failImport=async(value,pattern)=>{let error;try{await window.slateDesktop.importProjectFile(file(value));}catch(e){error=e;}expect(error&&pattern.test(error.message),'Missing clear import failure: '+error?.message);close();};
  try{
    close();expect($('#save-as-open').nextElementSibling?.id==='import-open','Import is not beside Save As');
    const start=await read();$('#import-open').click();expect($('#modal').open&&$('#import-file').accept.includes('.productiondesk'),'Header Import cannot choose portable projects');$('#modal-cancel').click();expect(same(await read(),start),'Cancelled picker changed workspace');
    checks.push('Header Import and cancellation preserve existing productions');
    const portable=await(await fetch('/demo/the-last-light.productiondesk')).json(),p=portable.workspace.projects[0];
    p.id=crypto.randomUUID();p.project='Complete portable import QA';portable.workspace.activeProject=p.id;
    p._sourceScript={filename:'Original QA.fountain',text:'Title: Original QA\n\nINT. ROOM - DAY\nÉLI\nPreserve all original source.\n'};
    p._extension={id:'extension-owned-id',sceneId:p.breakdowns[0].id,shotId:p._shots[0].id,notes:p._shots[0].id,asset:'data:image/png;base64,aGVsbG8=',nested:{keep:[null,true,3,'café']}};
    p._shotSettings.extraPreference='preserved';
    $('#import-open').click();const transfer=new DataTransfer();transfer.items.add(file(portable));$('#import-file').files=transfer.files;$('#import-submit').click();
    const importedDeadline=Date.now()+15000;while($('#modal').open){if($('#modal-error').textContent)throw Error($('#modal-error').textContent);if(Date.now()>importedDeadline)throw Error('Header file import timed out');await new Promise(r=>setTimeout(r,20));}
    let saved=await read(),imported=active(saved);
    expect(same(imported,p),'Complete portable import changed production fields or IDs');
    expect(saved.projects.length===start.projects.length+1&&same(saved.projects.slice(0,-1),start.projects),'Import changed existing productions');
    for(const [hash,encoded] of Object.entries(portable.workspace._pdfDocuments)){
      const response=await fetch('/api/pdf/'+hash),raw=new Uint8Array(await response.arrayBuffer());let text='';for(let i=0;i<raw.length;i+=8192)text+=String.fromCharCode(...raw.subarray(i,i+8192));expect(btoa(text)===encoded,'Original PDF bytes changed');
    }
    let download;HTMLAnchorElement.prototype.click=function(){if(this.href.includes('/api/download/')){download=this.href;return;}return anchorClick.call(this);};
    $('#save-as-open').click();const deadline=Date.now()+10000;while(!download){if(Date.now()>deadline)throw Error('Save As timed out');await new Promise(r=>setTimeout(r,20));}
    const exported=await(await fetch(download)).json();expect(same(exported,portable),'Real Save As lost project information or attachments');
    await window.slateDesktop.importProjectFile(file(exported));saved=await read();const copy=active(saved),expected=structuredClone(p);expected.id=copy.id;expected.project=copy.project;
    expect(copy.id!==p.id&&copy.project.includes('imported copy')&&same(copy,expected),'Duplicate import changed entity IDs, extension references or fields');
    $('#undo').click();expect(same(await read(),{...saved,projects:saved.projects.slice(0,-1),activeProject:p.id}),'Undo import did not restore prior workspace');$('#redo').click();expect(same(await read(),saved),'Redo import lost IDs or references');
    checks.push('Actual Save As → import preserves all fields, source, original PDFs, stable entity IDs, extensions, duplicate copies and undo/redo');
    // A live field edit is committed on blur; failure to save it must block import.
    $('[data-view="shots"]').click();const notes=$('[data-shot-field="notes"]');notes.value='Unsaved work retained by import gate';notes.dispatchEvent(new Event('input',{bubbles:true}));notes.dispatchEvent(new Event('change',{bubbles:true}));
    let readImport=false;window.fetch=async(...args)=>{if(args[0]==='/api/import')readImport=true;if(args[0]==='/api/workspace'&&args[1]?.method==='POST')return new Response(JSON.stringify({error:'Synthetic prior save failure'}),{status:500});return originalFetch(...args);};
    await failImport(portable,/current work could not be saved/);window.fetch=originalFetch;expect(!readImport,'Import read the file despite unsaved work');expect($('[data-shot-field="notes"]').value==='Unsaved work retained by import gate','Save failure lost an editor draft');
    checks.push('Unsaved edits save first; failed prior save blocks import and preserves the edited field');
    const before=await read();
    for(const mutate of [v=>v.formatVersion=99,v=>v.workspace.version=2,v=>v.workspace.projects[0].categories[1].id=v.workspace.projects[0].categories[0].id,v=>v.workspace.projects[0]._shots[0].sceneId='missing',v=>v.workspace.projects[0].elements[0].linkedElements=['missing'],v=>v.workspace.projects[0]._linedScript.documents[0].marks[0].shotId='missing',v=>v.workspace._pdfDocuments={},v=>v.workspace._pdfDocuments[Object.keys(v.workspace._pdfDocuments)[0]]='JVBERS1iYWQ=']){
      const value=structuredClone(portable);mutate(value);await failImport(value,/unsupported|not supported|[Ii]nvalid|[Dd]uplicate|unknown|missing|checksum|version|valid shot/i);expect(same(await read(),before),'Failed import changed current workspace');
    }
    checks.push('Unsupported versions, duplicate IDs, broken scene/element/coverage links and missing/corrupt assets reject without changing the workspace');
    let release,reached;const reachedPromise=new Promise(r=>reached=r),gate=new Promise(r=>release=r);
    window.fetch=async(...args)=>{if(args[0]==='/api/import'){reached();await gate;}return originalFetch(...args);};
    const cancelled=window.slateDesktop.importProjectFile(file(portable));await reachedPromise;$('#modal-cancel').click();release();expect(await cancelled===false,'Cancelled in-flight import committed');window.fetch=originalFetch;
    expect(same(await read(),before),'In-flight cancellation changed workspace');
    checks.push('Cancelling while a file is being read cannot commit a late import');
    let importedRequest=false;
    window.fetch=async(...args)=>{if(args[0]==='/api/import')importedRequest=true;if(args[0]==='/api/workspace'&&args[1]?.method==='POST')return new Response(JSON.stringify({error:'Synthetic disk unavailable'}),{status:500});return originalFetch(...args);};
    await failImport(portable,/Synthetic disk unavailable/);window.fetch=originalFetch;expect(importedRequest&&same(await read(),before),'Failed final save changed the current production');
    checks.push('Final disk-save failure leaves current selection, workspace and history intact');
    // Old exports without optional extensions still become editable productions.
    const old=structuredClone(portable);old.workspace._pdfDocuments={};const legacy=old.workspace.projects[0];legacy.id=crypto.randomUUID();old.workspace.activeProject=legacy.id;legacy.project='Older project QA';delete legacy._linedScript;delete legacy._sourceScript;delete legacy._shots;delete legacy._shotSettings;delete legacy._extension;legacy.stripboards=[];
    await window.slateDesktop.importProjectFile(file(old));saved=await read();expect(active(saved).stripboards.length&&active(saved).breakdowns.length===legacy.breakdowns.length,'Older breakdown-only export was not repaired');
    // Large lists use stable IDs and retain all relationships at the same limits.
    const large=structuredClone(portable),lp=large.workspace.projects[0];lp.id=crypto.randomUUID();large.workspace.activeProject=lp.id;lp.project='Large import QA';const seed=lp._shots[0];lp._shots.push(...Array.from({length:2400},(_,i)=>({...seed,id:crypto.randomUUID(),number:'QA'+i,description:'Large portable QA '.repeat(12)})));
    await window.slateDesktop.importProjectFile(file(large));saved=await read();expect(active(saved)._shots.length===lp._shots.length&&same(active(saved),lp),'Large project lost shots or references');
    checks.push('Older breakdown-only project repair and 2,400 additional shots import/save intact');
    window.projectImportExpected=saved;
    return checks;
  }finally{window.fetch=originalFetch;HTMLAnchorElement.prototype.click=anchorClick;close();}
};
