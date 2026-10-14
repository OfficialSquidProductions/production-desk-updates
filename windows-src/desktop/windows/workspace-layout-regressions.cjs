module.exports = async function runWorkspaceLayoutChecks() {
  const $=s=>document.querySelector(s),checks=[];
  const expect=(value,message)=>{if(!value)throw Error(message);};
  const wait=async fn=>{const deadline=Date.now()+20000;while(!fn()){if(Date.now()>deadline)throw Error('Workspace UI timed out: '+fn+'; '+$('#lined-status')?.textContent);await new Promise(r=>setTimeout(r,30));}};
  const saved=async()=>{expect(await window.slateDesktop.flush(),'Workspace save failed: '+$('#toast').textContent);const w=await(await fetch('/api/workspace')).json();return w.projects.find(p=>p.id===w.activeProject);};
  const active=p=>p._linedScript.documents.find(d=>d.sha256===p._linedScript.activePdf);
  const ready=()=>$('#lined-overlay')&&$('#lined-status').textContent.includes('Marks save');
  const change=(selector,value)=>{const input=$(selector);input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));};
  const drag=(tool,a,b)=>{
    $(`[data-lined-tool="${tool}"]`).click();const overlay=$('#lined-overlay'),r=overlay.getBoundingClientRect();overlay.setPointerCapture=()=>{};
    for(const [type,point] of [['pointerdown',a],['pointermove',b],['pointerup',b]])overlay.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:7,clientX:r.left+point[0]*r.width,clientY:r.top+point[1]*r.height}));
  };
  const context=target=>{target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:500,clientY:450}));const menu=[...document.querySelectorAll('.linked-context-menu')].find(n=>!n.hidden);expect(menu,'Delete context menu missing');menu.querySelector('button').click();};
  const coverageContext=id=>context($(`[data-lined-mark="${id}"]`).firstElementChild);
  const undo=async()=>{$('#undo').click();await wait(ready);return saved();};
  expect($('.sidebar-save').previousElementSibling.classList.contains('software-credit'),'Save notice is not below software credit');
  expect($('#new-open').parentElement.nextElementSibling.id==='project-picker','Plus is not above production picker');
  expect($('.sidebar-bottom').contains($('#settings-open')),'Production settings is not at bottom');
  expect(!$('.sidebar').textContent.includes('Your stories stay yours'),'Removed sidebar slogan remains');
  $('#settings-open').click();expect(!$('#report-bug'),'Reports remain in Production settings');$('#modal-close').click();
  $('#app-settings-open').click();expect($('#report-bug')&&$('#report-crash'),'Settings reports missing');$('#reset-delete-warnings').click();$('#report-bug').click();expect($('#support-report').open,'Bug report cannot open from Settings');$('#support-close').click();$('#modal-close').click();
  checks.push('Sidebar plus, save notice, bottom production settings and Settings reports match requested layout');
  $('[data-view="lined"]').click();await wait(ready);
  if(!$('#lined-continuous').checked)$('#lined-continuous').click();await wait(()=>ready()&&$('.lined-continuous'));
  change('#lined-zoom','0.5');await wait(()=>ready()&&$('#lined-overlay').getBoundingClientRect().width<400);
  const {documentLayout}=await import('/lined-script.js'),pdfjs=await import('/vendor/pdfjs/legacy/build/pdf.min.mjs');
  const project=await saved(),bytes=await(await fetch('/api/pdf/'+project._linedScript.activePdf)).arrayBuffer();
  $('[data-lined-tool="select"]').click();
  const legacy=active(project).marks.find(m=>m.type==='coverage'&&!m.space);
  if(legacy){const hit=$(`[data-lined-mark="${legacy.id}"]`).firstElementChild,rect=hit.getBoundingClientRect(),overlay=$('#lined-overlay');overlay.setPointerCapture=()=>{};hit.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:7,clientX:rect.left+1,clientY:rect.top+1}));overlay.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:7}));expect(JSON.stringify(active(await saved()).marks.find(m=>m.id===legacy.id))===JSON.stringify(legacy),'Selecting legacy coverage changed its stored coordinates');}

  const task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWasm:false}),layout=await documentLayout(await task.promise),boundary=layout.pages[1].top/layout.height;
  $('#lined-scroll').scrollTop=boundary*layout.height*.5-250;
  change('#lined-shot','');
  drag('coverage',[.15,boundary-.08],[.15,boundary+.08]);
  let p=await saved(),line=active(p).marks.at(-1);
  expect(line.type==='coverage'&&line.space==='document'&&line.page===0&&line.endPage===1,'Coverage did not cross the page boundary');
  $('#lined-new-shot').click();$('#lined-new-number').value='CROSS';$('#lined-new-description').value='Cross-page master';$('#lined-create-shot').click();
  p=await saved();line=active(p).marks.find(m=>m.id===line.id);const sid=line.shotId;expect(sid,'Cross-page line did not link');
  // The linked deletion must also remove coverage from another PDF revision.
  const firstDigest=active(p).sha256,other=p._linedScript.documents.find(d=>d.sha256!==firstDigest);
  if(other){change('#lined-document',other.sha256);await wait(ready);change('#lined-shot',sid);drag('coverage',[.2,.1],[.2,.2]);await saved();change('#lined-document',firstDigest);await wait(ready);}
  $('#lined-scroll').scrollTop=boundary*layout.height*.5-250;
  drag('pen',[.75,boundary-.04],[.8,boundary+.04]);
  p=await saved();expect(active(p).marks.at(-1).endPage===1,'Freehand note did not cross the page boundary');
  $('[data-lined-tool="text"]').click();const overlay=$('#lined-overlay'),rect=overlay.getBoundingClientRect();overlay.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:rect.left+rect.width*.45,clientY:rect.top+rect.height*(boundary-.006)}));
  $('#lined-text').value='Start before the cut\nContinue the move\nFinish on the next page';$('#lined-text-save').click();
  p=await saved();expect(active(p).marks.at(-1).space==='document','Typed note is not continuous');
  {const real=window.fetch,click=HTMLAnchorElement.prototype.click;window.fetch=async(url,options)=>{if(String(url)==='/api/export')window.workspaceLayoutExport=JSON.parse(options.body);return real(url,options);};HTMLAnchorElement.prototype.click=function(){if(!this.href.includes('/api/download/'))return click.call(this);};try{$('#lined-export').click();await wait(()=>$('#lined-status').textContent.includes('Lined PDF exported'));}finally{window.fetch=real;HTMLAnchorElement.prototype.click=click;}}
  expect(window.workspaceLayoutExport?.content,'Continuous PDF export missing');
  checks.push('Coverage, freehand and typed notes span mixed-size rotated pages and export to the original PDF');
  $('#lined-continuous').click();await wait(()=>ready()&&!$('.lined-continuous'));expect($(`[data-lined-mark="${line.id}"]`),'Cross-page mark missing on page 1');$('#lined-next').click();await wait(()=>ready()&&$('#lined-pages').textContent==='Page 2 of 2');expect($(`[data-lined-mark="${line.id}"]`),'Cross-page mark missing on page 2');
  $('#lined-continuous').click();await wait(()=>ready()&&$('.lined-continuous'));
  coverageContext(line.id);expect($('#modal').open&&$('#linked-delete-skip'),'Linked coverage did not warn');$('#modal-cancel').click();expect((await saved())._shots.some(s=>s.id===sid),'Cancel removed shot');
  coverageContext(line.id);$('#linked-delete-skip').checked=true;$('#modal-ok').click();p=await saved();expect(!p._shots.some(s=>s.id===sid)&&p._linedScript.documents.every(d=>d.marks.every(m=>m.shotId!==sid)),'Coverage deletion left linked shot or other lines');
  await undo();coverageContext(line.id);expect(!$('#modal').open,'Lined skip preference ignored');p=await saved();expect(!p._shots.some(s=>s.id===sid),'Skipped lined deletion failed');await undo();
  $('[data-view="shots"]').click();context($(`[data-shot="${sid}"]`));expect($('#modal').open&&$('#linked-delete-skip'),'Shot warning was incorrectly skipped by Lined preference');$('#modal-cancel').click();expect((await saved())._shots.some(s=>s.id===sid),'Shot Cancel removed linked data');
  context($(`[data-shot="${sid}"]`));$('#linked-delete-skip').checked=true;$('#modal-ok').click();p=await saved();expect(!p._shots.some(s=>s.id===sid)&&p._linedScript.documents.every(d=>d.marks.every(m=>m.shotId!==sid)),'Shot deletion left coverage');
  $('#undo').click();context($(`[data-shot="${sid}"]`));expect(!$('#modal').open,'Shot skip preference ignored');expect(!(await saved())._shots.some(s=>s.id===sid),'Skipped shot deletion failed');$('#undo').click();await saved();
  $('#app-settings-open').click();$('#reset-delete-warnings').click();$('#modal-close').click();context($(`[data-shot="${sid}"]`));expect($('#linked-delete-skip'),'Reset did not restore confirmation');$('#modal-cancel').click();
  checks.push('Right-click linked deletion, Cancel, separate persistent skip preferences, warning reset and Undo work in both tabs and across revisions');
  $('[data-view="lined"]').click();await wait(ready);change('#lined-shot','');drag('coverage',[.85,.1],[.85,.2]);p=await saved();const unlinked=active(p).marks.at(-1);coverageContext(unlinked.id);expect(!$('#modal').open,'Unlinked coverage unexpectedly warned');expect(!active(await saved()).marks.some(m=>m.id===unlinked.id),'Unlinked coverage was not deleted');
  const {PDFDocument,StandardFonts}=window.PDFLib,longPDF=await PDFDocument.create(),font=await longPDF.embedFont(StandardFonts.Courier);
  for(let i=0;i<80;i++)longPDF.addPage([612,792]).drawText('Long script page '+(i+1),{x:72,y:720,font,size:12});
  const transfer=new DataTransfer();transfer.items.add(new File([await longPDF.save()],'long-script-test.pdf',{type:'application/pdf'}));$('#lined-file').files=transfer.files;$('#lined-file').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>ready()&&$('#lined-pages').textContent==='80 pages');$('#lined-scroll').scrollTop=0;change('#lined-shot','');
  drag('coverage',[.7,50/(80*792)],[.7,70/(80*792)]);
  const longSaved=await saved();expect(active(longSaved).marks.length===1,'Short coverage stroke was discarded in a long script');
  const canvases=[...document.querySelectorAll('#lined-sheets canvas')];await wait(()=>canvases[0].width>1);
  $('#lined-scroll').scrollTop=1e9;await wait(()=>canvases.at(-1).width>1&&canvases[0].width===1);
  expect(canvases.filter(canvas=>canvas.width>1).length<8,'Long script retained too many offscreen page images');
  $('#lined-scroll').scrollTop=0;await wait(()=>canvases[0].width>1&&canvases.at(-1).width===1);
  change('#lined-document',firstDigest);await wait(ready);await saved();
  checks.push('Short strokes save in an 80-page script, selecting old marks preserves them, and offscreen page images release and reload');
  await task.destroy();
  return checks;
};
