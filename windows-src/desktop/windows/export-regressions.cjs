// Actual export/import controls; used in both native WebKit and Windows smoke QA.
module.exports = async function runExportChecks(){
  const $=s=>document.querySelector(s),expect=(value,message)=>{if(!value)throw Error(message);},same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const wait=async check=>{const end=Date.now()+15000;while(!check()){if(Date.now()>end)throw Error('Export/import UI timed out');await new Promise(r=>setTimeout(r,20));}};
  const read=async()=>{expect(await window.slateDesktop.flush(),'Export QA could not save');return(await fetch('/api/workspace')).json();};
  const active=w=>w.projects.find(p=>p.id===w.activeProject),file=value=>new File([JSON.stringify(value)],'Rich-session.productiondesk');
  const originalClick=HTMLAnchorElement.prototype.click,checks=[];let download;
  const capture=async action=>{download=null;await action();await wait(()=>!!download);return download;};
  HTMLAnchorElement.prototype.click=function(){if(this.href.includes('/api/download/')){download={url:this.href,name:this.download};return;}return originalClick.call(this);};
  try{
    if($('#modal').open)$('#modal').close();
    const portable=await(await fetch('/demo/the-last-light.productiondesk')).json(),p=portable.workspace.projects[0],b=p.breakdowns[0];
    p.id=crypto.randomUUID();portable.workspace.activeProject=p.id;p.project='Rich export QA — Café, "crew" 東京 🎬';
    b.description='Maya says "bonjour", then leaves.\nSecond line — café.';b.comments='Continuity\r\nKeep key, map and cast tags.';b._completed=true;
    p._sourceScript.text+='\n# Full source — café 東京 🎬\n';p._breakdownSettings={continuousScroll:true,futureProjectOption:{keep:true}};
    p._shotSettings={startTime:'06:45',futureSetting:{keep:'all'}};p._shotShootingOrder=p._shots.map(s=>s.id).reverse();
    p._shots[0].takes=4;p._shots[0].circleTake='3';p._shots[0].actualMinutes=11;p._shots[0].status='Done';
    p._extension={arbitrary:{preserved:[null,false,'café']},sceneId:b.id,shotId:p._shots[0].id};
    const category={id:crypto.randomUUID(),ucid:999,name:'Custom department',created:p.created};p.categories.push(category);
    const element={...structuredClone(p.elements[0]),id:crypto.randomUUID(),category:category.id,name:'Lantern, "brass"\n東京',linkedElements:[p.elements[0].id]};p.elements.push(element);b.elements.push(element.id);
    p.elements[0].linkedElements=[p.elements[1].id];
    const doc=p._linedScript.documents[0];doc.marks[0].labelAt=[-.23,.14];doc.marks[1].labelAt=[1.24,.7];
    const oldRaw=Uint8Array.from(atob(portable.workspace._pdfDocuments[doc.sha256]),c=>c.charCodeAt(0)),extra=new TextEncoder().encode('\n% UI portable revision\n');
    const bytes=new Uint8Array(oldRaw.length+extra.length);bytes.set(oldRaw);bytes.set(extra,oldRaw.length);
    const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const revision=structuredClone(doc);revision.sha256=sha;revision.filename='Revision two — café.pdf';revision.marks.forEach(m=>m.id=crypto.randomUUID());p._linedScript.documents.push(revision);p._linedScript.activePdf=sha;
    let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);portable.workspace._pdfDocuments[sha]=btoa(binary);
    const banner={id:crypto.randomUUID(),type:'banner',created:p.created,bannerText:'Company move, café',comments:null,description:null,pages:null,scene:null,scriptPage:null,duration:null,elements:[]};p.breakdowns.push(banner);
    for(const scenario of p.stripboards){
      for(const board of scenario.boards)board.breakdownIds=board.breakdownIds.map(group=>Array.isArray(group)?group.filter(id=>id!==b.id):group).filter(group=>group!==b.id);
      scenario.boards[1].breakdownIds.push(b.id,banner.id);
    }
    await window.slateDesktop.importProjectFile(file(portable));
    const before=await read(),source=active(before);expect(same(source,p),'Rich import lost breakdown/tag/script/shot/annotation/settings fields');
    $('#export-open').click();expect(!$('#export-uss')&&$('#export-breakdown-csv'),'Breakdown export is not the new CSV choice');
    const csvDownload=await capture(()=>$('#export-breakdown-csv').click());expect(csvDownload.name.endsWith('-breakdowns.csv'),'Wrong CSV extension');
    const csvResponse=await fetch(csvDownload.url),csvBytes=new Uint8Array(await csvResponse.arrayBuffer()),csv=new TextDecoder().decode(csvBytes);
    expect(csvResponse.headers.get('content-type').includes('text/csv'),'CSV has incorrect MIME type');expect(csvBytes[0]===239&&csvBytes[1]===187&&csvBytes[2]===191,'CSV lacks UTF-8 BOM');
    expect(csv.startsWith('"Production","Breakdown ID","Type","Scene"'),'CSV is JSON or has unclear columns');
    expect(csv.includes('"Category: Custom department"')&&csv.includes('"Lantern, ""brass""\n東京"'),'CSV dropped custom tags, escaping or Unicode');
    expect(csv.includes('"'+b.id+'"')&&csv.includes('"'+banner.id+'"'),'CSV omitted unscheduled scenes or banners');
    $('#modal-close').click();expect(same(await read(),before),'CSV export mutated source production');
    const savedFile=await capture(()=>$('#save-as-open').click());const exported=await(await fetch(savedFile.url)).json();
    expect(savedFile.name.endsWith('.productiondesk')&&same(exported,portable),'Save As did not preserve every project field and original revision');
    expect(same(await read(),before),'Portable export changed source production');
    checks.push('Actual breakdown CSV export is spreadsheet data with Unicode, escaped multiline fields, all categories, unscheduled scenes and banners; source remains unchanged');
    $('#import-open').click();const transfer=new DataTransfer();transfer.items.add(file(exported));$('#import-file').files=transfer.files;$('#import-submit').click();
    await wait(()=>!$('#modal').open||!!$('#modal-error').textContent);expect(!$('#modal').open,'Rich file-picker import failed: '+$('#modal-error').textContent);
    let saved=await read(),copy=active(saved),expected=structuredClone(p);expected.id=copy.id;expected.project=copy.project;
    expect(copy.id!==p.id&&same(copy,expected),'Recipient import lost fields or stable entity links');
    expect(same(saved.projects.find(x=>x.id===p.id),source),'Import changed source project');
    $('[data-view="workspace"]').click();const comments=$('[data-field="comments"]');comments.value='Recipient edit — café, "new note"';comments.dispatchEvent(new Event('change',{bubbles:true}));
    $('[data-view="shots"]').click();const notes=$('[data-shot-field="notes"]');notes.value='Recipient camera note';notes.dispatchEvent(new Event('change',{bubbles:true}));
    saved=await read();copy=active(saved);
    const reexport=await capture(()=>$('#save-as-open').click()),edited=await(await fetch(reexport.url)).json();
    expect(same(edited.workspace.projects[0],copy),'Editing and re-export lost project state');
    expect(same(saved.projects.find(x=>x.id===p.id),source),'Recipient editing altered source production');
    // Native Save As must not silently omit a draft still held in an editor.
    $('#add-scene').click();$('#new-shot-description').value='Uncommitted draft';download=null;await window.slateDesktop.saveAs();
    expect(!download&&$('#modal').open&&$('#new-shot-description').value==='Uncommitted draft','Save As exported while an editor draft was pending');$('#modal-cancel').click();
    checks.push('Actual .productiondesk Save As/import/edit/re-export retains breakdown links, cast, source/PDF revisions, shots/takes, gutter coordinates, schedules/settings/extensions; editor drafts block export');
    window.exportCheckCSV=new TextDecoder('utf-8',{ignoreBOM:true}).decode(csvBytes);window.exportCheckProject=JSON.stringify(edited);window.exportCheckSource=JSON.stringify(source);
    return checks;
  }finally{HTMLAnchorElement.prototype.click=originalClick;if($('#modal').open)$('#modal').close();}
};
