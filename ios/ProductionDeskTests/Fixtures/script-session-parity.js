// Native bridge adaptation of desktop/windows/script-session-regressions.cjs.
// Actual editor controls and export pipeline, with fictional production data only.
async function(){
 const stable=value=>JSON.stringify((function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;})(value));
 const $=s=>document.querySelector(s),checks=[],expect=(v,m)=>{if(!v)throw Error(m);};
 const wait=async f=>{const deadline=Date.now()+15000;while(!f()){if(Date.now()>deadline)throw Error('Timed out waiting for script fixes UI');await new Promise(r=>setTimeout(r,30));}};
 const {nativeAPI}=await import('/native-platform.js');const workspace=async()=>{expect(await window.slateDesktop.flush(),'Workspace save failed');return await nativeAPI('/api/workspace');};
 const current=async()=>{const w=await workspace();return w.projects.find(p=>p.id===w.activeProject);};
 const edit=(selector,value)=>{const e=$(selector);expect(e,'Missing '+selector);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.blur();};
 const {emptyProject}=await import('/film-native.js');const seed=emptyProject('Script fixes disposable QA');
 await window.slateDesktop.importProjectFile(new File([stable({version:1,activeProject:seed.id,projects:[seed]})],'Fixture.json'));
 $('#app-settings-open').click();
 for(const selector of ['#lined-show-movement','#lined-show-description'])if($(selector).checked){$(selector).click();await wait(()=>!$(selector).disabled);}
 $('#modal-close').click();
 const before=await workspace(),others=before.projects.filter(p=>p.id!==seed.id),script='4 INT. ROOM - DAY\n\nA fictional clock ticks.\n\nMAYA\nA safe test.';
 for(let i=0;i<2;i++){
   await window.slateDesktop.importProjectFile(new File([script],'Script.fountain'));
   const w=await workspace(),p=await current();expect(w.projects.length===before.projects.length&&p.id===seed.id&&p.project===seed.project,'Script made a separate production or renamed the current one');expect(p.breakdowns.length===1,'Repeated script duplicated scenes');
 }
 // Paste uses the same current-session path; native picker cancellation is covered by UIKit UI tests.
 window.slateDesktop.importScript();// Mobile cancellation uses UIDocumentPicker; touch cancellation is tested separately.
 $('#paste-script').value=script.replace('clock ticks','revised clock ticks');$('#import-submit').click();await wait(()=>!$('#modal').open);
 let p=await current();const sceneID=p.breakdowns[0].id;expect(p.breakdowns[0]._scriptText.includes('revised'),'Pasted revision was not loaded');
 const fdx='<FinalDraft><Content><Paragraph Type="Scene Heading" Number="4"><Text>INT. ROOM - DAY</Text></Paragraph><Paragraph Type="Action"><Text>Final Draft revision of the fictional clock.</Text></Paragraph></Content></FinalDraft>';
 await window.slateDesktop.importProjectFile(new File([fdx],'Script.fdx'));
 p=await current();expect(p.id===seed.id&&p.breakdowns.length===1&&p.breakdowns[0].id===sceneID&&p.breakdowns[0]._scriptText.includes('Final Draft revision'),'Final Draft import failed to update the current scene');
 const pdf=await PDFLib.PDFDocument.create();const sheet=pdf.addPage([612,792]);sheet.drawText('4 INT. ROOM - DAY',{x:72,y:720,size:12});sheet.drawText('A fictional clock ticks.',{x:72,y:695,size:12});
 const raw=await pdf.save();
 await window.slateDesktop.importProjectFile(new File([raw],'Script.pdf',{type:'application/pdf'}));
 p=await current();expect(p.breakdowns[0].id===sceneID&&p._linedScript.documents.length===1,'PDF import lost scene identity or original PDF');
 $('[data-view="lined"]').click();await wait(()=>!!$('#lined-overlay')?.onpointerdown);
 function draw(x){
   $('[data-lined-tool="coverage"]').click();const overlay=$('#lined-overlay'),r=overlay.parentElement.getBoundingClientRect();overlay.setPointerCapture=()=>{};
   for(const [type,y] of [['pointerdown',.2],['pointermove',.55],['pointerup',.55]])overlay.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:8,clientX:r.left+r.width*x,clientY:r.top+r.height*y}));
 }
 const renumber=number=>{$('#lined-renumber').click();edit('#lined-renumber-value',number);$('#lined-renumber-save').click();expect(!$('#modal').open,'Renumber failed: '+$('#modal-error')?.textContent);};
 draw(.2);renumber('4.3');renumber('7.1');draw(.35);draw(.5);
 p=await current();expect(p._shots.map(s=>s.number).join(',')==='7.1,7.2,7.3','7.1 baseline did not produce 7.2 then 7.3');
 renumber('3.2');draw(.65);draw(.75);p=await current();expect(p._shots.slice(-3).map(s=>s.number).join(',')==='3.2,3.3,3.4','Repeated renumber did not produce 3.3 then 3.4');
 const marks=structuredClone(p._linedScript.documents[0].marks),shots=structuredClone(p._shots);
 // Reimport the same original PDF: no extra production/revision and all links survive.
 await window.slateDesktop.importProjectFile(new File([raw],'Script.pdf',{type:'application/pdf'}));
 const w=await workspace();p=await current();expect(w.projects.length===before.projects.length,'PDF revision made another production');expect(stable(w.projects.filter(p=>p.id!==seed.id))===stable(others),'Script import changed another production');expect(stable(p._shots)===stable(shots)&&stable(p._linedScript.documents[0].marks)===stable(marks)&&p._linedScript.documents.length===1,'Reimport lost shots, annotations or duplicated the PDF');
 await window.slateDesktop.importProjectFile(new File([script.replace('clock ticks','text revision is visible')],'After-PDF.txt'));
 expect(!$('#script-text').classList.contains('script-pdf-pages')&&$('#script-text').textContent.includes('text revision is visible'),'Text reimport displayed an older PDF instead of the new script');
 p=await current();expect(p._linedScript.documents[0].marks.length===marks.length,'Text reimport discarded older PDF annotations');
 await window.slateDesktop.importProjectFile(new File([raw],'Script.pdf',{type:'application/pdf'}));
 checks.push('Text, Fountain, Final Draft, paste and repeated PDF imports retain current production identity, scene IDs, shot links and annotations; other productions unchanged');
 $('[data-view="lined"]').click();await wait(()=>!!$('#lined-overlay')?.onpointerdown);
 $('#lined-overlay').setPointerCapture=()=>{};$('[data-lined-tool="select"]').click();$('#lined-overlay [data-lined-mark="'+marks.at(-1).id+'"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:9,clientX:0,clientY:0}));$('#lined-overlay').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:9}));
 edit('#lined-size','Medium close-up');edit('#lined-movement','Slow dolly toward the door');
 const description='Maya reads the note, watches the door, and hides the key. '.repeat(18).trim()+' DESCRIPTION END';edit('#lined-description',description);
 expect($('#lined-overlay').textContent.includes('Medium close-up')&&!$('#lined-overlay').textContent.includes('Shot Size:'),'Default box omitted Shot Size');expect(!$('#lined-overlay').textContent.includes('Slow dolly'),'Movement should default off');expect(!$('#lined-overlay').textContent.includes('DESCRIPTION END'),'Description should default off');
 window.scriptFixExports=[];const handler=window.webkit.messageHandlers.scheduler,originalPost=handler.postMessage.bind(handler);
 handler.postMessage=async body=>{if(body.operation==='export'&&body.mime==='application/pdf'){window.scriptFixExports.push(body);return true;}return originalPost(body);};
 const exportPDF=async()=>{const count=window.scriptFixExports.length;$('#lined-export').click();await wait(()=>window.scriptFixExports.length>count);await wait(()=>$('#lined-status').textContent.includes('Lined PDF exported'));const value=window.scriptFixExports.at(-1);expect(value.mime==='application/pdf'&&value.encoding==='base64','No actual PDF exported');const bytes=Uint8Array.from(atob(value.content),c=>c.charCodeAt(0));expect((await PDFLib.PDFDocument.load(bytes)).getPageCount()===1,'Invalid exported PDF');};
 try{
   await exportPDF();
   for(const [movement,desc] of [[true,false],[false,true],[true,true]]){
     $('#app-settings-open').click();
     for(const [selector,value] of [['#lined-show-movement',movement],['#lined-show-description',desc]])if($(selector).checked!==value){$(selector).click();await wait(()=>!$(selector).disabled);}
     $('#modal-close').click();expect($('#lined-overlay').textContent.includes('Slow dolly')===movement,'Movement toggle mismatch');expect($('#lined-overlay').textContent.includes('DESCRIPTION END')===desc,'Description toggle mismatch');
     await exportPDF();
   }
 }finally{handler.postMessage=originalPost;}
 const {coverageDetails,documentPrimitives,documentLayout}=await import('/lined-script.js'),{primitivesForPage,annotationBounds}=await import('/lined-export.js');
 const lib=await import('/vendor/pdfjs/legacy/build/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/legacy/build/pdf.worker.min.mjs';const task=lib.getDocument({data:raw.slice(),isEvalSupported:false,useWasm:false});const file=await task.promise,layout=await documentLayout(file);p=await current();
 const all=p._linedScript.documents[0].marks.flatMap(m=>documentPrimitives(m,layout,'Shot '+p._shots.find(s=>s.id===m.shotId)?.number,coverageDetails(p._shots.find(s=>s.id===m.shotId),{linedShowMovement:true,linedShowDescription:true}),{gutters:240,fitHeight:false}).map(v=>({...v,sourcePage:0})));
 const values=primitivesForPage(all,layout,0),bounds=annotationBounds(values,612,792);for(const item of values.filter(v=>v.kind==='text')){expect(item.x>=bounds.left&&item.y>=bounds.top&&item.x+item.boxWidth<=bounds.right&&item.y+item.boxHeight<=bounds.bottom,'Export clips an annotation box');for(const line of item.lines){const ctx=document.createElement('canvas').getContext('2d');ctx.font=item.fontSize+'px Arial';expect(ctx.measureText(line).width+item.padding*2<=item.boxWidth+1,'Text overflows annotation box');}}
 expect(values.some(v=>v.lines?.join(' ').includes('DESCRIPTION END')),'Long description omitted its final words');await task.destroy();
 window.scriptFixEvidence={projectID:p.id,projectCount:w.projects.length,baseline:p._linedScript.numbering,numbers:p._shots.map(s=>s.number),exports:window.scriptFixExports.length,bounds};
 checks.push('Shot Size default and all four movement/description combinations use actual PDF exports; long description ends inside measured annotation boxes');
 checks.push('Renumber 4.3 → 7.1 continues 7.2/7.3, then 3.2 continues 3.3/3.4; baseline and all data saved through backend');
 return {checks,evidence:window.scriptFixEvidence,pdfs:window.scriptFixExports.map(v=>v.content)};
};
