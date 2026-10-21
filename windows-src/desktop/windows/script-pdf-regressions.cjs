// Fictional PDF-only fixture with dialogue followed directly by action: PDF
// extraction loses paragraph gaps, but the original page geometry must survive.
module.exports = async function runScriptPDFChecks() {
  const $=s=>document.querySelector(s),checks=[];
  const expect=(v,m)=>{if(!v)throw Error(m);};
  const wait=async check=>{const until=Date.now()+25000;while(!check()){if(Date.now()>until)throw Error('PDF reader timed out: '+check+'; '+$('#script-pdf-status')?.textContent+'; error: '+$('#script-text')?.dataset.error);await new Promise(r=>setTimeout(r,30));}};
  const saved=async()=>{expect(await window.slateDesktop.flush(),'PDF workflow save failed');const w=window.webkit?.messageHandlers?.scheduler?await window.webkit.messageHandlers.scheduler.postMessage({operation:'load'}):await(await fetch('/api/workspace')).json();return w.projects.find(p=>p.id===w.activeProject);};
  const {PDFDocument,StandardFonts,degrees,rgb}=PDFLib;
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Courier);
  const line=(page,text,x,y)=>page.drawText(text,{x,y,font,size:12});
  let page=pdf.addPage([612,792]);
  line(page,'1 INT. TEST ROOM - DAY',72,720);line(page,'MAYA',240,680);line(page,'We have one more take.',180,660);
  line(page,'The lantern returns to the table.',72,630);line(page,'Copper',72,45);
  page=pdf.addPage([612,792]);line(page,'2 EXT. TEST ROAD - NIGHT',72,720);line(page,'A brass key catches the light.',72,690);line(page,'JON',240,650);line(page,'The scene continues.',180,630);
  page=pdf.addPage([612,792]);page.drawRectangle({x:72,y:200,width:400,height:400,color:rgb(.1,.2,.35)});
  page=pdf.addPage([612,792]);page.setRotation(degrees(90));line(page,'3 INT. ROTATED TEST ROOM - DAY',72,720);line(page,'Rotated original text.',72,690);
  const bytes=await pdf.save();
  $('[data-view="workspace"]').click();window.slateDesktop.importScript();
  const transfer=new DataTransfer();transfer.items.add(new File([bytes],'Original-screenplay-regression.pdf',{type:'application/pdf'}));$('#import-file').files=transfer.files;$('#import-submit').click();
  await wait(()=>!$('#modal').open);expect($('#script-text').classList.contains('script-pdf-pages'),'Original PDF not displayed; inferred dialogue: '+[...document.querySelectorAll('#script-text .dialogue')].map(e=>e.textContent).join(' | '));await wait(()=>$('#script-text')?.dataset.ready==='true');
  const root=$('#script-text'),scroll=$('.script-pdf-scroll'),first=$('[data-page="1"]'),second=$('[data-page="2"]');
  await wait(()=>first.querySelector('canvas').dataset.ready==='true');
  const rangeFor=(page,value)=>{
    const container=page.querySelector('.script-pdf-text'),text=container.textContent,index=text.indexOf(value);
    expect(index>=0,'Missing PDF text: '+value+'; '+text);
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT),range=document.createRange();let node,offset=0,started=false;
    while(node=walker.nextNode()){
      if(!started&&index<offset+node.length){range.setStart(node,index-offset);started=true;}
      if(started&&index+value.length<=offset+node.length){range.setEnd(node,index+value.length-offset);return range;}
      offset+=node.length;
    }
    throw Error('PDF text range not found');
  };
  const action=rangeFor(first,'The lantern returns to the table.'),dialogue=rangeFor(first,'We have one more take.');
  const scale=first.clientWidth/612,origin=first.getBoundingClientRect();
  expect(Math.abs(action.getBoundingClientRect().left-origin.left-72*scale)<2,'Action lost original PDF indentation');
  expect(Math.abs(dialogue.getBoundingClientRect().left-origin.left-180*scale)<2,'Dialogue lost original PDF indentation');
  expect(!root.querySelector('.dialogue'),'PDF was reflowed through dialogue heuristics');
  if(window.productionDeskCapturePDF)await window.productionDeskCapturePDF();
  checks.push('Real imported PDF keeps original action/dialogue margins with an aligned selectable text layer');
  const select=range=>{getSelection().removeAllRanges();getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));return getSelection().toString().trim();};
  const scene=$('#scene-picker').value;$('#tag-category').value='104';
  const range=rangeFor(first,'Copper'),end=rangeFor(second,'2 EXT. TEST ROAD - NIGHT');range.setEnd(end.endContainer,end.endOffset);
  const selected=select(range);
  scroll.scrollTop=first.offsetHeight-100;const top=scroll.scrollTop;
  $('#tag-selection').click();$('#tag-selection').click();
  expect($('#script-text')===root&&getSelection().toString().trim()===selected,'Cross-page tag lost PDF text range');
  expect(scroll.scrollTop===top&&$('#scene-picker').value===scene&&$('#tag-category').value==='104','Tag reset PDF scroll, scene or category');
  let p=await saved(),b=p.breakdowns.find(b=>b.id===scene),element=p.elements.find(e=>e.name===selected);
  expect(element&&b.elements.filter(id=>id===element.id).length===1,'Repeated cross-page tag lost or duplicated assignment');
  checks.push('Cross-page selection and repeated tags retain the same PDF nodes, selection, scroll, scene and category');
  $('#scene-picker').value=$('#scene-picker').options[1].value;$('#scene-picker').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>$('#script-text')?.dataset.ready==='true');
  expect($('#script-pdf-page').value==='2','Scene navigation did not use original script page');
  const nextRoot=$('#script-text'),nextScroll=$('.script-pdf-scroll'),input=$('[data-add-category="100"] input');
  select(rangeFor($('[data-page="2"]'),'brass key'));
  $('#tag-category').value='104';$('#tag-selection').click();
  for(const name of ['PDF Actor One','PDF Actor Two']){
    input.focus({preventScroll:true});input.value=name;nextScroll.scrollTop=900;const before=nextScroll.scrollTop;input.form.requestSubmit();
    expect(document.activeElement===input&&input.isConnected&&nextRoot===$('#script-text'),'Actor add interrupted PDF or input focus');
    expect(nextScroll.scrollTop===before,'Actor add changed PDF position');
  }
  expect($('#tag-category').value==='104','Actor add reset tag category');
  p=await saved();b=p.breakdowns.find(b=>b.id===$('#scene-picker').value);
  expect(p.elements.filter(e=>b.elements.includes(e.id)&&e.name.startsWith('PDF Actor')).length===2,'Actors did not save to selected scene');
  // Zoom updates text geometry in place, keeping the original text DOM.
  const zoomSpan=rangeFor($('[data-page="2"]'),'brass key').startContainer;$('#script-pdf-zoom').value='1';$('#script-pdf-zoom').dispatchEvent(new Event('change',{bubbles:true}));
  expect(zoomSpan===rangeFor($('[data-page="2"]'),'brass key').startContainer,'Zoom replaced PDF text DOM');
  expect($('[data-page="2"]').clientWidth===612,'100% zoom is not the original page width');
  // Rotation is handled by PDF.js canvas and text-layer transforms together.
  const rotated=$('[data-page="4"]'),rotatedSpan=rangeFor(rotated,'Rotated original text.');
  expect(rotated.clientWidth===792&&rotatedSpan&&rotated.querySelector('.script-pdf-text').dataset.mainRotation==='90','Rotated original page is not aligned');
  checks.push('Scene page navigation, repeated actors, persisted assignments and in-place zoom retain editing context; rotated pages render');
  // Byte fidelity, scheduling and portable exports use existing local paths.
  const digest=p._linedScript.activePdf,original=new Uint8Array(await(await fetch('/api/pdf/'+digest)).arrayBuffer());
  expect(original.length===bytes.length&&original.every((value,i)=>value===bytes[i]),'Original PDF bytes were rewritten');
  $('[data-view="schedule"]').click();$('[data-action="add-day"]').click();
  p=await saved();expect(p.stripboards[0].boards[0].breakdownIds.length===1,'PDF view disrupted scheduling');
  $('[data-view="workspace"]').click();await wait(()=>$('#script-text')?.dataset.ready==='true');
  expect(!p._shots.length,'Reader unexpectedly changed shot data');
  // View the image-only page honestly; typed breakdown entry remains available.
  $('#script-pdf-page').value='3';$('#script-pdf-page').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>$('#script-pdf-status').textContent.includes('no selectable text'));
  expect($('[data-page="3"] .script-pdf-text').textContent==='','Image-only page invented selectable text');
  checks.push('Original bytes remain unchanged; schedules still work and image-only pages explain the manual-entry/searchable-PDF fallback');
  // Attach a separate scan to exercise missing-original recovery without modifying
  // any production data, then retry the same original once it is available.
  const scan=await PDFDocument.create();scan.addPage([612,792]).drawRectangle({x:60,y:60,width:490,height:650,color:rgb(.2,.3,.4)});const scanBytes=await scan.save();
  $('[data-view="lined"]').click();const scanTransfer=new DataTransfer();scanTransfer.items.add(new File([scanBytes],'Image-only-test.pdf',{type:'application/pdf'}));$('#lined-file').files=scanTransfer.files;$('#lined-file').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>$('#lined-status')?.textContent.includes('Marks save'));
  const realFetch=window.fetch;window.fetch=async(url,options)=>String(url).startsWith('/api/pdf/')?new Response('',{status:404}):realFetch(url,options);
  try{$('[data-view="workspace"]').click();await wait(()=>$('#script-text')?.dataset.fallback==='true');expect($('.script-transcript')&&!$('#script-text .dialogue'),'Missing PDF fell back to erroneous dialogue layout');}
  finally{window.fetch=realFetch;}
  $('[data-view="schedule"]').click();$('[data-view="workspace"]').click();await wait(()=>$('#script-text')?.dataset.ready==='true');
  expect($('#script-pdf-status').textContent.includes('no selectable text'),'Image-only document claims selectable text');
  const entry=$('[data-add-category="104"] input');entry.value='Manually entered scan prop';entry.form.requestSubmit();
  expect((await saved()).elements.some(e=>e.name==='Manually entered scan prop'),'Image-only manual entry failed');
  checks.push('Missing-original failure uses an unformatted transcript, retries cleanly, and image-only originals allow honest typed breakdowns');
  // Keep all selection text available without keeping every page bitmap alive.
  const longPDF=await PDFDocument.create(),longFont=await longPDF.embedFont(StandardFonts.Courier);
  for(let i=0;i<60;i++)longPDF.addPage([612,792]).drawText('Original long script page '+(i+1),{x:72,y:720,font:longFont,size:12});
  $('[data-view="lined"]').click();const longTransfer=new DataTransfer();longTransfer.items.add(new File([await longPDF.save()],'Long-original-test.pdf',{type:'application/pdf'}));$('#lined-file').files=longTransfer.files;$('#lined-file').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>$('#lined-status')?.textContent.includes('Marks save'));$('[data-view="workspace"]').click();await wait(()=>$('#script-text')?.dataset.ready==='true');
  const sheets=[...document.querySelectorAll('.script-pdf-page')];expect(sheets.length===60,'Long original lost pages');
  $('.script-pdf-scroll').scrollTop=1e9;await wait(()=>sheets.at(-1).querySelector('canvas').dataset.ready==='true'&&sheets[0].querySelector('canvas').width===1);
  expect(sheets.filter(p=>p.querySelector('canvas').width>1).length<8,'Long original retains too many bitmaps');
  expect(sheets[0].querySelector('.script-pdf-text').textContent.includes('page 1'),'Releasing offscreen bitmaps removed selection text');
  checks.push('Long originals retain cross-page text while offscreen page bitmaps release and reload');
  // Return to the original fixture for the browser's real mouse/keyboard checks.
  $('[data-view="lined"]').click();$('#lined-document').value=$('#lined-document').options[0].value;$('#lined-document').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>$('#lined-status')?.textContent.includes('Marks save'));$('[data-view="workspace"]').click();await wait(()=>$('#script-text')?.dataset.ready==='true');
  return checks;
};
