module.exports = async function runLinedChecks(fixture) {
  const $=s=>document.querySelector(s);
  const expect=(value,message)=>{if(!value)throw Error(message);};
  const wait=async fn=>{const deadline=Date.now()+20000;while(!fn()){if(Date.now()>deadline)throw Error('Lined UI timed out: '+fn+'; status: '+$('#lined-status')?.textContent);await new Promise(r=>setTimeout(r,50));}};
  const saved=async()=>{expect(await window.slateDesktop.flush(),'Lined save failed');const w=await(await fetch('/api/workspace')).json();return w.projects.find(p=>p.id===w.activeProject);};
  const marks=async()=>((await saved())._linedScript.documents[0].marks);
  const drag=(tool,a,b)=>{
    $(`[data-lined-tool="${tool}"]`).click();const el=$('#lined-overlay'),r=el.getBoundingClientRect();
    // Synthetic events exercise the same pointer handlers in WebKit and Electron.
    el.setPointerCapture=()=>{};
    const fire=(type,p)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:7,clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));
    fire('pointerdown',a);fire('pointermove',b);fire('pointerup',b);
  };
  $('[data-view="lined"]').click();
  const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob(fixture),c=>c.charCodeAt(0))],'lined-original.pdf',{type:'application/pdf'}));
  $('#lined-file').files=transfer.files;$('#lined-file').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>$ ('#lined-pages')?.textContent==='Page 1 of 2'&&$('#lined-status').textContent.includes('Marks save'));
  const initialShotCount=(await saved())._shots.length;
  drag('coverage',[.12,.18],[.12,.58]);
  let current=await marks();expect(current.length===1&&current[0].type==='coverage'&&!current[0].shotId,'Unlinked coverage did not save');
  expect((await saved())._shots.length===initialShotCount,'Drawing created an unwanted shot');
  for(const [key,value] of Object.entries({number:'BETA1',description:'Lined camera setup',movement:'Push in',camera:'B',lens:'50',size:'Medium',equipment:'Dolly'})){
    $('#lined-'+key).value=value;$('#lined-'+key).dispatchEvent(new Event('input',{bubbles:true}));
  }
  expect((await marks())[0].draft.movement==='Push in','Unlinked camera details were not saved');
  {const real=window.fetch,click=HTMLAnchorElement.prototype.click;
   window.fetch=async(url,options)=>{if(String(url)==='/api/export')window.linedDraftExport=JSON.parse(options.body);return real(url,options);};
   HTMLAnchorElement.prototype.click=function(){if(!this.href.includes('/api/download/'))return click.call(this);};
   try{$('#lined-export').click();await wait(()=>$('#lined-status').textContent.includes('Lined PDF exported'));}
   finally{window.fetch=real;HTMLAnchorElement.prototype.click=click;}
   expect(atob(window.linedDraftExport.content).startsWith('%PDF-'),'Unlinked draft could not be exported');}

  $('#lined-new-shot').click();expect($('#lined-new-description').value==='Lined camera setup'&&$('#lined-new-movement').value==='Push in'&&$('#lined-new-camera').value==='B','Creating a shot lost coverage details');
  $('#lined-create-shot').click();current=await marks();
  expect(current[0].shotId&&(await saved())._shots.length===initialShotCount+1,'Create shot did not link the drawn line');
  expect(Math.abs(current[0].start[0]-.12)<.001&&Math.abs(current[0].end[1]-.58)<.001,'Coverage coordinates drifted');
  $('#lined-movement').value='Track left, then push in';$('#lined-movement').dispatchEvent(new Event('input',{bubbles:true}));
  $('#lined-note').value='Start on the door slam';$('#lined-note').dispatchEvent(new Event('input',{bubbles:true}));
  $('#lined-style').value='wavy';$('#lined-style').dispatchEvent(new Event('change',{bubbles:true}));
  let project=await saved();expect(project._shots.find(s=>s.id===current[0].shotId).movement==='Track left, then push in','Movement was not linked to the shot list');
  expect($('#lined-overlay').textContent.includes('Track left, then push in'),'Movement label did not update');
  $('[data-view="shots"]').click();$(`[data-shot-select="${current[0].shotId}"]`).click();
  for(const [key,value] of Object.entries({description:'Lined camera setup',movement:'Track left, then push in',camera:'B',lens:'50',size:'Medium',equipment:'Dolly'}))expect($(`[data-shot-field="${key}"]`).value===value,'Shot list lost coverage '+key);
  expect($('.shot-coverage').textContent.includes('p. 1')&&$('.shot-coverage').textContent.includes('Start on the door slam'),'Coverage references and timing notes are missing from the shot list');
  {const real=window.fetch;
   window.fetch=(url,options)=>{if(String(url)==='/api/export'){window.linedCSVExport=JSON.parse(options.body);return Promise.resolve(new Response('{"native":true}',{status:200,headers:{'Content-Type':'application/json'}}));}return real(url,options);};
   try{$('[data-shot-action="csv"]').click();await wait(()=>window.linedCSVExport);}
   finally{window.fetch=real;}
   expect(window.linedCSVExport.content.includes('Script coverage')&&window.linedCSVExport.content.includes('Start on the door slam')&&window.linedCSVExport.content.includes('lined-original.pdf'),'Shot-list CSV omitted linked coverage details');
   const nativePrint=window.print;window.print=()=>{};
   try{$('[data-shot-action="print"]').click();expect($('#print-area').textContent.includes('Start on the door slam'),'Printed shot list omitted coverage notes');}
   finally{window.print=nativePrint;}}

  $('[data-shot-field="notes"]').value='Keep manual shot notes';$('[data-shot-field="notes"]').dispatchEvent(new Event('input',{bubbles:true}));
  $('[data-view="lined"]').click();await wait(()=>$('#lined-status').textContent.includes('Marks save'));
  $('#lined-shot').value='';$('#lined-shot').dispatchEvent(new Event('change',{bubbles:true}));
  expect(!(await marks())[0].shotId,'A coverage line could not be unlinked');
  $('#lined-movement').value='Draft truck left';$('#lined-movement').dispatchEvent(new Event('input',{bubbles:true}));
  const existing=(await saved())._shots.find(s=>s.number==='BETA1');
  $('#lined-shot').value=existing.id;$('#lined-shot').dispatchEvent(new Event('change',{bubbles:true}));
  project=await saved();expect(project._shots.length===initialShotCount+1&&project._shots.find(s=>s.id===existing.id).movement==='Draft truck left','Linking an existing shot duplicated it or lost line details');
  expect(project._shots.find(s=>s.id===existing.id).notes==='Keep manual shot notes','Linking overwrote manual shot notes');
  $('#undo').click();expect(!(await marks())[0].shotId&&(await marks())[0].draft.movement==='Draft truck left','Undo lost unlinked line details');
  $('#redo').click();expect((await marks())[0].shotId===existing.id,'Redo did not restore the shot link');
  await wait(()=>$('#lined-status').textContent.includes('Marks save'));

  $('[data-lined-tool="select"]').click();
  {const el=$('#lined-overlay'),r=el.getBoundingClientRect(),label=el.querySelector('rect[data-lined-handle="label"]'),b=label.getBoundingClientRect();
   el.setPointerCapture=()=>{};
   label.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:7,clientX:b.left+5,clientY:b.top+5}));
   el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:7,clientX:r.left+r.width*.58,clientY:r.top+r.height*.08}));
   el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7}));}
  current=await marks();expect(current[0].labelAt?.[0]>.5&&current[0].start[0]<.13,'Moving the label changed coverage');
  for(const tool of ['pen','highlighter','arrow'])drag(tool,[.25,.5],[.45,.55]);
  $('[data-lined-tool="text"]').click();const rect=$('#lined-overlay').getBoundingClientRect();
  $('#lined-overlay').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:rect.left+rect.width*.48,clientY:rect.top+rect.height*.66}));
  $('#lined-text').value='Pan to Maya';$('#lined-text-save').click();
  expect((await marks()).length===5,'Drawing tools or text note failed');
  $('#lined-next').click();await wait(()=>$('#lined-pages').textContent==='Page 2 of 2');
  drag('coverage',[.15,.2],[.15,.75]);
  $('#lined-zoom').value='1.5';$('#lined-zoom').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>Math.abs($('.lined-page')?.getBoundingClientRect().width-1098)<2);
  drag('arrow',[.6,.3],[.8,.6]);
  current=await marks();expect(current.length===7&&current[6].page===1,'Rotated page or zoom annotation failed');
  expect(Math.abs(current[6].end[0]-.8)<.001,'Zoom changed stored coordinates');
  $('#undo').click();await wait(()=>$('#lined-overlay')!==null);expect((await marks()).length===6,'Annotation Undo failed');
  $('#redo').click();await wait(()=>$('#lined-overlay')!==null);expect((await marks()).length===7,'Annotation Redo failed');
  const {markPrimitives,clearCoverageScene}=await import('/lined-script.js');
  {const sample={_linedScript:{documents:[{marks:[{type:'coverage',shotId:null,draft:{sceneId:'removed',movement:'Pan'}}]}]}};clearCoverageScene(sample,'removed');expect(!sample._linedScript.documents[0].marks[0].draft.sceneId&&sample._linedScript.documents[0].marks[0].draft.movement==='Pan','Scene deletion damaged unlinked coverage details');}
  for(const text of ['Long camera direction '.repeat(100).slice(0,2000),'W'.repeat(2000),'Cut.\n'.repeat(400)]){
    const box=markPrimitives({type:'text',start:[.95,.95],text,color:'#E60026',width:2},612,792).find(p=>p.kind==='text');
    expect(box.x+box.boxWidth<=612&&box.y+box.boxHeight<=792,'Maximum-length note clips outside the page');
    const measure=document.createElement('canvas').getContext('2d');measure.font=`${box.fontSize}px Arial, sans-serif`;
    expect(box.lines.every(line=>measure.measureText(line).width+box.padding*2<=box.boxWidth+.01),'Long note overflows its box');
  }
  const realFetch=window.fetch,realClick=HTMLAnchorElement.prototype.click;
  window.fetch=async(url,options)=>{if(String(url)==='/api/export')window.linedTestExport=JSON.parse(options.body);return realFetch(url,options);};
  HTMLAnchorElement.prototype.click=function(){if(!this.href.includes('/api/download/'))return realClick.call(this);};
  try{$('#lined-export').click();await wait(()=>$('#lined-status').textContent.includes('Lined PDF exported')||$('#lined-status').classList.contains('lined-error'));expect($('#lined-status').textContent.includes('Lined PDF exported'),$('#lined-status').textContent);}
  finally{window.fetch=realFetch;HTMLAnchorElement.prototype.click=realClick;}
  expect(window.linedTestExport?.encoding==='base64'&&atob(window.linedTestExport.content).startsWith('%PDF-'),'Export did not produce a PDF');
  const before=(await saved())._linedScript;expect(before.documents[0].marks.length===7,'Export modified editable annotations');
  const response=await fetch('/api/backup',{method:'POST',headers:{'X-Slate-Local':'1'},body:JSON.stringify({workspace:await(await fetch('/api/workspace')).json(),filename:'lined-backup.json'})});
  expect(response.ok,'Full PDF backup failed');const backup=await(await fetch((await response.json()).url)).json();
  expect(backup._pdfDocuments[before.activePdf]===fixture,'Full backup lost original PDF bytes');
  // A revision has distinct marks even when it contains the same page artwork.
  {const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob(fixture),c=>c.charCodeAt(0)),'\n% Beta revision\n'],'lined-revision.pdf',{type:'application/pdf'}));
   $('#lined-file').files=transfer.files;$('#lined-file').dispatchEvent(new Event('change',{bubbles:true}));}
  await wait(()=>$('#lined-document')?.options.length===2&&$('#lined-document').value!==before.activePdf&&$('#lined-status').textContent.includes('Marks save'));
  const revision=$('#lined-document').value;drag('arrow',[.5,.4],[.65,.6]);
  project=await saved();expect(project._linedScript.documents.find(d=>d.sha256===revision).marks.length===1,'Revision marks were not saved separately');
  for(const digest of [before.activePdf,revision,before.activePdf]){
    $('#lined-document').value=digest;$('#lined-document').dispatchEvent(new Event('change',{bubbles:true}));
  }
  await wait(()=>$('#lined-status').textContent.includes('Marks save')&&$('#lined-pages').textContent==='Page 1 of 2');
  expect($('#lined-overlay').querySelectorAll('[data-lined-mark]').length===5,'Rapid revision switching displayed stale marks');
  const linkedId=before.documents[0].marks.find(m=>m.type==='coverage').shotId;
  $('[data-view="shots"]').click();$(`[data-shot-select="${linkedId}"]`).click();
  $('[data-shot-field="movement"]').value='Dolly right';$('[data-shot-field="movement"]').dispatchEvent(new Event('input',{bubbles:true}));
  $('[data-view="lined"]').click();await wait(()=>$('#lined-overlay')?.textContent.includes('Dolly right'));
  $('[data-view="shots"]').click();$(`[data-shot-select="${linkedId}"]`).click();$('[data-shot-action="delete"]').click();$('#modal-ok').click();
  project=await saved();expect(!project._shots.some(s=>s.id===linkedId)&&project._linedScript.documents.every(d=>d.marks.every(m=>m.shotId!==linkedId)),'Shot deletion left orphan coverage');
  $('#undo').click();project=await saved();expect(project._shots.some(s=>s.id===linkedId)&&project._linedScript.documents[0].marks.filter(m=>m.shotId===linkedId).length===2,'Undo did not restore shot coverage');
  $('[data-view="lined"]').click();await wait(()=>$('#lined-status').textContent.includes('Marks save'));
  document.documentElement.dataset.theme='dark';
  expect(getComputedStyle($('.lined-toolbar')).backgroundColor===getComputedStyle($('.lined-desk')).backgroundColor,'Lined toolbar did not follow dark appearance');
  expect(getComputedStyle($('.lined-page')).backgroundColor==='rgb(255, 255, 255)','Dark theme changed original PDF paper');
  document.documentElement.dataset.theme='light';
  return ['Unlinked coverage exports to PDF','Shot CSV and print reports include coverage details','Draw-first coverage saves without creating a shot','Coverage details create or update shot-list entries without duplicates','Shot-list coverage references preserve manual notes','Unlink/link and Undo/Redo retain draft details','Original two-page PDF renders offline','Shot-linked coverage, shared camera movements and timing notes','Pen, highlighter, arrow, typed notes and movable coverage labels','Rotated/cropped page and zoom retain coordinates','Annotation Undo/Redo and disk save','Lined PDF export preserves originals and editable marks','Full backup contains the byte-identical original PDF','Maximum-length notes and wide characters fit the PDF page','PDF revisions retain independent marks during rapid switching','Shot-list movements update coverage; deletion and Undo preserve links','Light/dark appearance keeps original PDF pages legible'];
};
