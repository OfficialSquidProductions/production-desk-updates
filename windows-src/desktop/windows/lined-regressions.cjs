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
  $('#lined-new-shot').click();$('#lined-new-number').value='BETA1';$('#lined-new-description').value='Lined camera setup';$('#lined-new-movement').value='Push in';$('#lined-create-shot').click();
  drag('coverage',[.12,.18],[.12,.58]);
  let current=await marks();expect(current.length===1&&current[0].type==='coverage','Coverage did not save');
  expect(Math.abs(current[0].start[0]-.12)<.001&&Math.abs(current[0].end[1]-.58)<.001,'Coverage coordinates drifted');
  $('#lined-movement').value='Track left, then push in';$('#lined-movement').dispatchEvent(new Event('input',{bubbles:true}));
  $('#lined-note').value='Start on the door slam';$('#lined-note').dispatchEvent(new Event('input',{bubbles:true}));
  $('#lined-style').value='wavy';$('#lined-style').dispatchEvent(new Event('change',{bubbles:true}));
  let project=await saved();expect(project._shots.find(s=>s.id===current[0].shotId).movement==='Track left, then push in','Movement was not linked to the shot list');
  expect($('#lined-overlay').textContent.includes('Track left, then push in'),'Movement label did not update');
  $('[data-lined-tool="select"]').click();
  {const el=$('#lined-overlay'),r=el.getBoundingClientRect(),label=el.querySelector('rect[data-lined-handle="label"]'),b=label.getBoundingClientRect();
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
  await wait(()=>Math.abs($('.lined-page').getBoundingClientRect().width-1098)<2);
  drag('arrow',[.6,.3],[.8,.6]);
  current=await marks();expect(current.length===7&&current[6].page===1,'Rotated page or zoom annotation failed');
  expect(Math.abs(current[6].end[0]-.8)<.001,'Zoom changed stored coordinates');
  $('#undo').click();await wait(()=>$('#lined-overlay')!==null);expect((await marks()).length===6,'Annotation Undo failed');
  $('#redo').click();await wait(()=>$('#lined-overlay')!==null);expect((await marks()).length===7,'Annotation Redo failed');
  const {markPrimitives}=await import('/lined-script.js');
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
  return ['Original two-page PDF renders offline','Shot-linked coverage, shared camera movements and timing notes','Pen, highlighter, arrow, typed notes and movable coverage labels','Rotated/cropped page and zoom retain coordinates','Annotation Undo/Redo and disk save','Lined PDF export preserves originals and editable marks','Full backup contains the byte-identical original PDF','Maximum-length notes and wide characters fit the PDF page','PDF revisions retain independent marks during rapid switching','Shot-list movements update coverage; deletion and Undo preserve links','Light/dark appearance keeps original PDF pages legible'];
};
