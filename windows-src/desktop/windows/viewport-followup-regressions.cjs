module.exports = async function runViewportFollowupChecks(){
  const $=s=>document.querySelector(s),checks=[],expect=(v,m)=>{if(!v)throw Error(m);};
  const wait=async fn=>{const deadline=Date.now()+20000;while(!fn()){if(Date.now()>deadline)throw Error('Viewport follow-up timed out: '+fn+'; '+$('#script-pdf-status')?.textContent);await new Promise(r=>setTimeout(r,25));}};
  const workspace=async()=>{expect(await window.slateDesktop.flush(),'Follow-up save failed');return(await fetch('/api/workspace')).json();};
  const saved=async()=>{const w=await workspace();return w.projects.find(p=>p.id===w.activeProject);};
  const encode=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
  const portable=await(await fetch('/demo/the-last-light.productiondesk')).json(),p=portable.workspace.projects[0];
  p.id=crypto.randomUUID();p.project='Viewport and portable gutter QA';portable.workspace.activeProject=p.id;
  p._sourceScript={filename:'Original story.fountain',text:'Title: Portable original\n\nINT. ROOM - DAY\nÉLI\nThe original source travels with the production.\n'};
  p._extension={retained:['café',null,true],sceneId:p.breakdowns[0].id,inlineAsset:'data:image/png;base64,aGVsbG8='};
  p._shots.push(...Array.from({length:600},(_,i)=>({...p._shots[0],id:crypto.randomUUID(),sceneId:p.breakdowns[0].id,number:'QA'+i,description:'Viewport synthetic shot '+i+' · '+'Variable setup '.repeat(i%4+1),status:i%2?'Ready':'Planned'})));
  delete p._breakdownSettings;
  const {PDFDocument,StandardFonts,degrees}=PDFLib,pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Courier);
  for(let i=0;i<4;i++){const page=pdf.addPage([612,792]);page.drawText('SCENE '+(i+1)+' ORIGINAL PAGE',{x:72,y:700,font,size:14});page.drawText('Portable prop '+(i+1),{x:72,y:650,font,size:12});if(i===1){page.setCropBox(36,48,540,700);page.setRotation(degrees(90));}}
  const bytes=await pdf.save(),upload=await(await fetch('/api/pdf',{method:'POST',headers:{'X-Slate-Local':'1','X-Filename':'Portable-original.pdf'},body:bytes})).json();expect(upload.document,'Fixture PDF was not stored');
  const hash=upload.document.sha256;portable.workspace._pdfDocuments[hash]=encode(bytes);
  const mark=(shot,page,labelAt,color='#E60026')=>({id:crypto.randomUUID(),type:'coverage',page,start:[.3,.15],end:[.3,.7],width:2,color,style:'solid',shotId:shot.id,labelAt,note:'Owning line · portable label'});
  const marks=[mark(p._shots[0],0,[-.3,.12]),mark(p._shots[1],0,[1.2,.22],'#0044BB'),mark(p._shots[2],1,[-.25,.3]),{...mark(p._shots[3],0,[1.2,.45]),space:'document',endPage:3,start:[.55,.15],end:[.55,.8]},mark(p._shots[350],2,[.35,.4])];
  marks[1].note='Readable gutter camera notes. '.repeat(65);
  p._linedScript.documents.push({...upload.document,marks});p._linedScript.activePdf=hash;p.breakdowns.filter(b=>b.type==='scene').forEach((b,i)=>b.scriptPage=String(Math.min(i+1,4)));
  await window.slateDesktop.importProjectFile(new File([JSON.stringify(portable)],'Viewport-QA.productiondesk'));
  $('[data-view="shots"]').click();
  const rows=()=>[...document.querySelectorAll('#shot-list [data-shot]')],selected=()=>$('#shot-list .selected')?.dataset.shot;
  const choose=i=>rows()[i].querySelector('[data-shot-select]').click();
  const position=i=>{const list=$('#shot-list');list.scrollTop+=rows()[i].getBoundingClientRect().top-list.getBoundingClientRect().top-80;};
  const remove=async()=>{$('[data-shot-action="delete"]').click();$('#modal-ok').click();await new Promise(r=>setTimeout(r,0));};
  position(350);choose(350);const list=$('#shot-list'),top=list.scrollTop,pageTop=document.scrollingElement.scrollTop,next=rows()[351].dataset.shot,deleted=selected();
  expect(top>15000,'Deletion fixture did not reach a deep list');await remove();
  expect($('#shot-list')===list&&list.scrollTop===top&&document.scrollingElement.scrollTop===pageTop,'Deleting a shot rebuilt/reset the deep viewport');expect(selected()===next,'Deletion did not choose the visible next shot');
  $('#undo').click();expect(selected()===deleted&&$('#shot-list').scrollTop===top,'Undo deletion lost selection or scroll');expect((await saved())._linedScript.documents.at(-1).marks.some(m=>m.shotId===deleted),'Undo lost linked coverage');
  $('#redo').click();expect(selected()===next&&$('#shot-list').scrollTop===top,'Redo deletion lost neighboring selection or scroll');$('#undo').click();
  $('#shot-list').scrollTop=$('#shot-list').scrollHeight;choose(rows().length-1);const previous=rows().at(-2).dataset.shot;await remove();expect(selected()===previous&&$('#shot-list').scrollTop>15000,'Deleting last row jumped to first shot');$('#undo').click();const tail=$('#shot-list .selected').getBoundingClientRect(),pane=$('#shot-list').getBoundingClientRect();expect(tail.top>=pane.top-1&&tail.bottom<=pane.bottom+1,'Undo left the restored last row outside the viewport');
  $('#shot-scene').value=p.breakdowns[0].id;$('#shot-scene').dispatchEvent(new Event('change',{bubbles:true}));$('#shot-status').value='Ready';$('#shot-status').dispatchEvent(new Event('change',{bubbles:true}));
  position(150);choose(150);const filteredTop=$('#shot-list').scrollTop,filteredNext=rows()[151].dataset.shot;await remove();expect(selected()===filteredNext&&$('#shot-list').scrollTop===filteredTop,'Filtered deletion reset viewport or chose a hidden shot');$('#undo').click();expect($('#shot-list').scrollTop===filteredTop&&$('#shot-status').value==='Ready','Undo cleared filters/scroll');
  const only=rows()[150].querySelector('.shot-description').textContent;$('#shot-search').value=only;$('#shot-search').dispatchEvent(new Event('input',{bubbles:true}));expect(rows().length===1,'Single-shot filter fixture failed');await remove();expect(!selected()&&!rows().length,'Deleting only filtered shot retained a hidden selection');$('#undo').click();expect(rows().length===1&&selected(),'Undo did not restore the only filtered shot');
  checks.push('Deep linked-shot deletion, last row, filtered/only rows and undo/redo keep pane/page position, neighboring selection and coverage integrity');
  $('[data-view="workspace"]').click();await wait(()=>$('#script-text')?.dataset.ready==='true');
  expect(!$('#breakdown-continuous').checked&&!Object.hasOwn(await saved(),'_breakdownSettings'),'Opening an old production silently rewrote viewing defaults');expect(document.querySelectorAll('.script-pdf-page:not([hidden])').length===1,'Default Breakdown is not scene/page based');
  const sceneSelect=$('#scene-picker');sceneSelect.value=p.breakdowns[1].id;sceneSelect.dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>$('#script-text')?.dataset.ready==='true');expect($('#script-pdf-page').value==='2'&&!$('[data-page="2"]').hidden,'Scene navigation did not show the referenced original page');
  const root=$('#script-text'),sheet=$('[data-page="2"]'),text=sheet.querySelector('.script-pdf-text'),walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(node.textContent.includes('Portable prop 2'))break;}expect(node,'Rotated original has no selectable text');
  const range=document.createRange(),at=node.textContent.indexOf('Portable prop 2');range.setStart(node,at);range.setEnd(node,at+15);getSelection().removeAllRanges();getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));$('#tag-category').value='104';const scroll=$('.script-pdf-scroll');scroll.scrollTop=50;const scrollTop=scroll.scrollTop;$('#tag-selection').click();
  expect($('#script-text')===root&&$('.script-pdf-scroll').scrollTop===scrollTop&&$('#scene-picker').value===p.breakdowns[1].id,'Tagging rebuilt/reset scene-mode PDF');
  $('#breakdown-continuous').click();await wait(()=>$('#script-text')?.dataset.ready==='true');expect(document.querySelectorAll('.script-pdf-page:not([hidden])').length===4&&(await saved())._breakdownSettings.continuousScroll===true,'Continuous Scroll did not show/persist every original page');
  expect($('#breakdown-continuous').compareDocumentPosition($('#script-pdf-page'))&Node.DOCUMENT_POSITION_FOLLOWING,'Continuous checkbox is not before the page selector');
  const continuousRoot=$('#script-text');$('.script-pdf-scroll').scrollTop=700;$('#tag-category').value='104';const currentTop=$('.script-pdf-scroll').scrollTop;$('#tag-selection').click();expect($('#script-text')===continuousRoot&&$('.script-pdf-scroll').scrollTop===currentTop,'Continuous mode tag action reset its viewport');
  checks.push('Older productions default to scene/page navigation without a save rewrite; Continuous Scroll is left of the page selector, persists per production and retains original selection/tagging stability');
  $('#app-settings-open').click();const button=$('#lined-key-binds').getBoundingClientRect(),label=$('label[for="lined-label-opacity"]').getBoundingClientRect(),slider=$('#lined-label-opacity').getBoundingClientRect();expect(button.bottom+10<=label.top&&label.bottom<=slider.top,'Key Binds overlaps opacity controls');$('#modal-close').click();
  checks.push('Settings gives Key Binds, opacity label and slider separate spaced rows');
  $('[data-view="lined"]').click();await wait(()=>!!$('#lined-overlay')?.onpointerdown);
  const exportPDF=async()=>{const originalFetch=window.fetch;let exported;
    window.fetch=(url,options)=>{if(url==='/api/export'){exported=JSON.parse(options.body);return Promise.resolve(new Response('{"native":true}',{status:200,headers:{'Content-Type':'application/json'}}));}return originalFetch(url,options);};
    try{$('#lined-export').click();await wait(()=>!!exported||$('#lined-status')?.classList.contains('lined-error'));expect(exported,'Gutter PDF export failed: '+$('#lined-status').textContent);return exported;}finally{window.fetch=originalFetch;}
  };
  const exported=await exportPDF(),outputBytes=Uint8Array.from(atob(exported.content),c=>c.charCodeAt(0)),sourceLib=await import('/vendor/pdfjs/legacy/build/pdf.min.mjs');sourceLib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/legacy/build/pdf.worker.min.mjs';
  const original=await sourceLib.getDocument({data:bytes.slice(),isEvalSupported:false,useWasm:false}).promise,output=await sourceLib.getDocument({data:outputBytes,isEvalSupported:false,useWasm:false}).promise;
  expect(output.numPages===4,'Gutters changed original page count');
  for(let i=1;i<=4;i++){
    const before=await original.getPage(i),after=await output.getPage(i),a=before.getViewport({scale:1}),b=after.getViewport({scale:1});expect(before.rotate===after.rotate,'Gutter export changed page rotation');
    if(i<=2)expect(b.width>a.width,'Off-page labels were clipped instead of expanding the export');if(i===1)expect(b.height>a.height,'Long gutter notes were shrunk/clipped rather than given readable export bounds');if(i===4)expect(b.width===a.width&&b.height===a.height,'Page without gutter content grew unnecessarily');
    const contents=async page=>{const reader=page.streamTextContent().getReader(),items=[];while(true){const value=await reader.read();if(value.done)break;items.push(...value.value.items);}return items.filter(item=>item.str).map(item=>({str:item.str,transform:item.transform}));};
    expect(JSON.stringify(await contents(before))===JSON.stringify(await contents(after)),'Gutter expansion changed original PDF text/coordinates');
  }
  // Render the exported PDF itself: colored label pixels must exist outside
  // both original paper edges, rather than merely increasing an empty CropBox.
  const first=await output.getPage(1),renderView=first.getViewport({scale:1}),canvas=document.createElement('canvas');canvas.width=Math.ceil(renderView.width);canvas.height=Math.ceil(renderView.height);
  await first.render({canvasContext:canvas.getContext('2d'),viewport:renderView}).promise;
  const originalFirst=await original.getPage(1),corners=[[originalFirst.view[0],originalFirst.view[1]],[originalFirst.view[2],originalFirst.view[3]]].map(point=>renderView.convertToViewportPoint(...point));
  const left=Math.min(...corners.map(point=>point[0])),right=Math.max(...corners.map(point=>point[0])),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let leftInk=0,rightInk=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(x<left-20&&r>120&&r>g*1.35&&r>b*1.2)leftInk++;if(x>right+20&&b>80&&b>r*1.3)rightInk++;}
  expect(leftInk>30&&rightInk>30,'Exported gutter boxes/association ink are missing outside the original paper');
  window.viewportFollowupRaster=canvas.toDataURL('image/png');
  const fetchOriginal=new Uint8Array(await(await fetch('/api/pdf/'+hash)).arrayBuffer());expect(encode(fetchOriginal)===encode(bytes),'Export modified the stored original PDF');
  window.viewportFollowupPDF=exported;window.viewportFollowupHash=hash;window.viewportFollowupLabel=marks[0].id;
  checks.push('Lined PDF expands only needed bounds, retains left/right labels and connectors, rotated/cropped originals, native script text coordinates and original bytes');
  let download;const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.href.includes('/api/download/')){download=this.href;return;}return click.call(this);};
  try{$('#save-as-open').click();await wait(()=>!!download);window.viewportFollowupPortable=await(await fetch(download)).json();}finally{HTMLAnchorElement.prototype.click=click;}
  expect(window.viewportFollowupPortable.workspace.projects[0]._breakdownSettings.continuousScroll===true,'Save As omitted viewing settings');
  window.viewportFollowupSource=await saved();window.viewportFollowupExport=exportPDF;
  return checks;
};
