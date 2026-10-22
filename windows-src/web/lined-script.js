import {normalizeShotNumber,shotIdentifier,shotNumberKey} from './shot-identifiers.js';
import {LINED_ACTIONS,DEFAULT_BINDS,eventBinding,isEditing} from './lined-shortcuts.js';
import {confirmLinkedDelete,createDeleteMenu} from './linked-actions.js';
// Original pages remain immutable. Editable marks use normalized page or document coordinates.
const GUTTER=240;
const NS='http://www.w3.org/2000/svg';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const copy=value=>structuredClone(value);
let textMeasure;
function textWidth(value){
  textMeasure||=document.createElement('canvas').getContext('2d');
  textMeasure.font='11px Arial, sans-serif';
  return textMeasure.measureText(value).width;
}
export function removeCoverage(project,shotIds){
  const removed=new Set(shotIds);
  for(const doc of project._linedScript?.documents||[])doc.marks=doc.marks.filter(m=>m.type!=='coverage'||!removed.has(m.shotId));
}
export function clearCoverageScene(project,sceneId){
  for(const document of project._linedScript?.documents||[])for(const mark of document.marks){
    if(mark.type==='coverage'&&!mark.shotId&&mark.draft?.sceneId===sceneId)delete mark.draft.sceneId;
  }
}
export function coverageSummary(project,shotId){
  return (project._linedScript?.documents||[]).flatMap(document=>document.marks
    .filter(m=>m.type==='coverage'&&m.shotId===shotId)
    .map(m=>`${document.filename} · ${m.endPage>m.page?'pp. '+(m.page+1)+'–'+(m.endPage+1):'p. '+(m.page+1)} · ${m.style==='wavy'?'Off camera':'On camera'}${m.note?' · '+m.note:''}`));
}
const shotFields=['description','movement','camera','lens','size','equipment'];
function wrap(text,columns){
  const output=[];
  for(const paragraph of String(text||'').split('\n')){
    let line='';
    for(const word of paragraph.split(/\s+/)){
      for(let i=0;i<word.length||i===0;i+=columns){
        const part=word.slice(i,i+columns);
        if((line+' '+part).trim().length>columns){output.push(line);line=part;}
        else line=(line+' '+part).trim();
      }
    }
    output.push(line);
  }
  return output;
}
export function markPrimitives(mark,width,height,shotLabel,movement,{gutters=0,opacity=.94}={}){
  const pos=p=>[p[0]*width,p[1]*height], result=[];
  const path=(points,alpha=1)=>result.push({kind:'path',points,color:mark.color,width:mark.width,alpha});
  const text=(content,anchor)=>{
    const margin=mark.type==='coverage'?gutters:0;
    const boxSpace=margin&&(anchor[0]<0||anchor[0]>=width)?Math.min(width,margin):width;
    const maxColumns=Math.max(1,Math.floor((boxSpace-22)/11));
    let columns=Math.min(36,maxColumns),lines=wrap(content,columns);
    // Widen long notes before scaling them, keeping every word on the page.
    while(lines.length*15+10>height-8&&columns<maxColumns){columns=Math.min(maxColumns,columns+8);lines=wrap(content,columns);}
    if(lines.length*15+10>height-8)lines=wrap(String(content||'').replace(/\s+/g,' '),maxColumns);
    const naturalWidth=Math.max(...lines.map(textWidth),1)+14,naturalHeight=lines.length*15+10;
    const scale=Math.max(.001,Math.min(1,(width-8)/naturalWidth,(height-8)/naturalHeight));
    const boxWidth=naturalWidth*scale,boxHeight=naturalHeight*scale;
    result.push({kind:'text',lines,x:clamp(anchor[0],4-margin,Math.max(4,width+margin-boxWidth-4)),y:clamp(anchor[1],4,Math.max(4,height-boxHeight-4)),boxWidth,boxHeight,opacity,color:mark.color,fontSize:11*scale,padding:7*scale,baseline:16*scale,lineHeight:15*scale});
  };
  if(mark.type==='coverage'){
    const a=pos(mark.start),b=pos(mark.end),top=Math.min(a[1],b[1]),bottom=Math.max(a[1],b[1]);
    if(mark.style==='wavy'){
      const points=[];for(let y=top;y<=bottom;y+=2)points.push([a[0]+Math.sin((y-top)*Math.PI/6)*3,y]);
      points.push([a[0],bottom]);path(points);
    }else path([[a[0],top],[a[0],bottom]]);
    path([[a[0]-4,top],[a[0]+4,top]]);path([[a[0]-4,bottom],[a[0]+4,bottom]]);
    text([shotLabel,movement,mark.note].filter(Boolean).join('\n'),mark.labelAt?pos(mark.labelAt):[a[0]+7,top]);
    const box=result[result.length-1];box.handle='label';
    // The leader travels with the box; the coverage endpoints stay on the script.
    const edge=[clamp(a[0],box.x,box.x+box.boxWidth),clamp(top,box.y,box.y+box.boxHeight)];
    result.splice(result.length-1,0,{kind:'path',points:[[a[0],top],edge],color:mark.color,width:1,alpha:.8,connector:true});
  }else if(mark.type==='pen'||mark.type==='highlighter')path(mark.points.map(pos),mark.type==='highlighter'?.28:1);
  else if(mark.type==='arrow'){
    const a=pos(mark.start),b=pos(mark.end),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
    path([a,b]);path([[b[0]-10*Math.cos(angle-.45),b[1]-10*Math.sin(angle-.45)],b,[b[0]-10*Math.cos(angle+.45),b[1]-10*Math.sin(angle+.45)]]);
  }else text(mark.text,pos(mark.start));
  return result;
}
// Continuous annotations use normalized coordinates across the stacked original pages.
// Page annotations keep their original coordinates and are translated only for display.
export async function documentLayout(file){
  const pages=[];let width=0,height=0;
  for(let i=0;i<file.numPages;i++){const source=await file.getPage(i+1),view=source.getViewport({scale:1});pages.push({source,view,top:height});width=Math.max(width,view.width);height+=view.height;}
  for(const item of pages)item.left=(width-item.view.width)/2;
  return {pages,width,height};
}
function translatePrimitives(items,dx,dy){return items.map(item=>item.kind==='path'?{...item,points:item.points.map(([x,y])=>[x+dx,y+dy])}:{...item,x:item.x+dx,y:item.y+dy});}
export function documentPrimitives(mark,layout,label,movement,options){
  if(mark.space==='document')return markPrimitives(mark,layout.width,layout.height,label,movement,options);
  const item=layout.pages[mark.page];if(!item)return [];
  return translatePrimitives(markPrimitives(mark,item.view.width,item.view.height,label,movement,options),item.left,item.top);
}
function paint(context,primitives){
  for(const item of primitives){
    context.save();
    if(item.kind==='path'){
      context.globalAlpha=item.alpha;context.strokeStyle=item.color;context.lineWidth=item.width;
      context.lineCap='round';context.lineJoin='round';context.beginPath();
      item.points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.stroke();
    }else{
      context.fillStyle=`rgba(255,255,255,${item.opacity??.94})`;context.fillRect(item.x,item.y,item.boxWidth,item.boxHeight);
      context.strokeStyle=item.color;context.lineWidth=.6;context.strokeRect(item.x,item.y,item.boxWidth,item.boxHeight);
      context.fillStyle=item.color;context.font=`${item.fontSize}px Arial, sans-serif`;
      item.lines.forEach((line,i)=>context.fillText(line,item.x+item.padding,item.y+item.baseline+i*item.lineHeight));
    }
    context.restore();
  }
}
export function createLinedDesk(c){
  const {esc,id,stamp}=c,$=s=>document.querySelector(s);
  let production,sha,page=0,zoom=1,tool='coverage',color='#E60026',width=2,style='solid',shotId='',selectedId,gesture,viewport,epoch=0,busy=false;
  let library,layout,continuous=false,pageObserver,pendingRestore;
  const preferences=()=>c.preferences?.()||{linedKeyBinds:DEFAULT_BINDS,linedLabelOpacity:.94};
  const deleteMenu=createDeleteMenu('coverage line');
  try{continuous=localStorage.getItem('productionDeskContinuousScript')==='true';}catch{}
  const loaded=new Map();
  const p=()=>c.project(),lining=()=>p()._linedScript,doc=()=>lining()?.documents.find(d=>d.sha256===lining().activePdf),mark=()=>doc()?.marks.find(m=>m.id===selectedId);
  const shot=(sid=shotId)=>p()._shots.find(s=>s.id===sid);
  const label=(s,project=p())=>{const scene=project.breakdowns.find(b=>b.id===s?.sceneId);return s?`${shotIdentifier(scene?.scene,s.number)}${s.camera?' · Camera '+s.camera:''}`:'Unlinked shot';};
  function sync(){
    if(production!==p().id){production=p().id;page=0;selectedId=undefined;shotId='';}
    if(sha!==doc()?.sha256){sha=doc()?.sha256;page=0;selectedId=undefined;gesture=null;}
    if(shotId&&!shot())shotId='';
    if(!mark())selectedId=undefined;
  }
  const numberLabel=s=>shotIdentifier(p().breakdowns.find(b=>b.id===s.sceneId)?.scene,s.number);
  const sortedShots=()=>p()._shots.filter(s=>p().breakdowns.some(b=>b.type==='scene'&&b.id===s.sceneId)).slice().sort((a,b)=>numberLabel(a).localeCompare(numberLabel(b),undefined,{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id));
  const options=value=>sortedShots().map(s=>`<option value="${esc(s.id)}" ${s.id===value?'selected':''}>${esc(label(s)+' · '+s.description)}</option>`).join('');
  const numberKey=(value,sceneId)=>shotNumberKey(value,p().breakdowns.find(b=>b.id===sceneId)?.scene);
  function nextNumber(sceneId){const used=new Set(p()._shots.filter(s=>s.sceneId===sceneId).map(s=>numberKey(s.number,sceneId)));let n=1;while(used.has('.'+n))n++;return '.'+n;}
  function makeShot(sceneId,number,seed={}){return {id:id(),created:stamp(),sceneId,number,description:seed.description||'Coverage',movement:seed.movement||'',size:seed.size||'Wide',camera:seed.camera||'A',lens:seed.lens||'',equipment:seed.equipment||'',notes:'',circleTake:'',priority:'Essential',status:'Planned',setupMinutes:10,shootMinutes:15,actualMinutes:null,takes:0};}
  function defaultScene(){return p().breakdowns.find(b=>b.type==='scene'&&b.id===c.selectedScene())||p().breakdowns.find(b=>b.type==='scene');}
  function render(){sync();return `<section class="panel lined-desk"><div class="lined-top"><div><h2>Lined script</h2><p>Original PDF pages · shot-linked coverage · local annotations</p></div><div class="lined-file-actions"><button id="lined-attach">${doc()?'Add PDF revision':'Attach original PDF'}</button><input id="lined-file" type="file" accept="application/pdf,.pdf" hidden><button id="lined-export" class="primary" ${doc()?'':'disabled'}>Export lined PDF</button></div></div>${doc()?`<div class="lined-document"><label>PDF revision<select id="lined-document">${lining().documents.map(d=>`<option value="${d.sha256}" ${d.sha256===sha?'selected':''}>${esc(d.filename)}</option>`).join('')}</select></label><div class="lined-pagination"><label class="lined-continuous-choice"><input id="lined-continuous" type="checkbox" ${continuous?'checked':''}>Continuous scroll</label><button id="lined-prev" aria-label="Previous PDF page">‹</button><span id="lined-pages">Loading PDF…</span><button id="lined-next" aria-label="Next PDF page">›</button><label>Zoom<select id="lined-zoom">${[.5,.75,1,1.25,1.5,2].map(z=>`<option value="${z}" ${z===zoom?'selected':''}>${Math.round(z*100)}%</option>`).join('')}</select></label></div></div><div class="lined-toolbar" role="toolbar" aria-label="Script annotation tools">${[['select','↖ Select'],['coverage','│ Coverage'],['pen','✎ Pen'],['highlighter','▰ Highlight'],['arrow','↗ Arrow'],['text','T Note']].map(([key,name])=>`<button data-lined-tool="${key}" aria-pressed="${key===tool}">${name}</button>`).join('')}<label>Color<input id="lined-color" type="color" value="${color}"></label><label>Width<select id="lined-width">${[1,2,3,5,10,14,24].map(w=>`<option ${width===w?'selected':''}>${w}</option>`).join('')}</select></label></div><div class="lined-workspace"><div class="lined-scroll" id="lined-scroll"><div id="lined-stage" aria-label="Original script PDF"><p class="lined-loading">Opening original PDF…</p></div></div><aside id="lined-inspector" class="lined-inspector"></aside></div>`:`<div class="lined-empty"><div class="lined-empty-icon">▧</div><h3>Line the original pages.</h3><p>Attach your screenplay PDF to draw coverage lines, link shots, and write camera directions.</p><p>New PDF script imports keep their original pages automatically. For an older production, attach its original PDF here.</p><button id="lined-empty-attach" class="primary">Choose original PDF</button>${p().breakdowns.some(b=>b._scriptText)?'<p>Or use the imported script text to create a scrollable copy.</p><button id="lined-from-text">Create from script text</button>':''}<p class="tiny">PDFs stay on this computer and travel with full Production Desk backups.</p></div>`}<p id="lined-status" class="lined-status" role="status"></p></section>`;}
  async function libraries(){
    if(!library){library=await import('./vendor/pdfjs/legacy/build/pdf.min.mjs');library.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/legacy/build/pdf.worker.min.mjs';}
    return library;
  }
  async function load(digest){
    if(loaded.has(digest))return loaded.get(digest);
    const task=(async()=>{
      const lib=await libraries(),response=await fetch('/api/pdf/'+digest);
      if(!response.ok)throw Error('Original PDF unavailable. Reattach the original file.');
      const bytes=new Uint8Array(await response.arrayBuffer());
      const pdf=await lib.getDocument({data:bytes.slice(),cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/',isEvalSupported:false,useWasm:false}).promise;
      return {pdf,bytes};
    })();
    loaded.set(digest,task);
    try{return await task;}catch(error){loaded.delete(digest);throw error;}
  }
  function setStatus(message,error=false){const node=$('#lined-status');if(node){node.textContent=message;node.classList.toggle('lined-error',error);}}
  function captureState(){return {production:p().id,sha:doc()?.sha256,selectedId,page,top:$('#lined-scroll')?.scrollTop||0,left:$('#lined-scroll')?.scrollLeft||0,inspectorTop:$('#lined-inspector')?.scrollTop||0};}
  function restoreScroll(state){const scroll=$('#lined-scroll');if(scroll){scroll.scrollTop=state.top;scroll.scrollLeft=state.left;}if($('#lined-inspector'))$('#lined-inspector').scrollTop=state.inspectorTop;}
  function refreshHistory(previous){
    const current=captureState(),same=production===p().id&&sha===doc()?.sha256&&$('#project-title')?.textContent===(p().project||p().name);
    gesture=null;
    if(previous?.production===p().id&&previous.sha===doc()?.sha256)selectedId=previous.selectedId;
    if(same&&viewport&&$('#lined-overlay')){sync();drawOverlay();renderInspector();restoreScroll(current);return true;}
    pendingRestore={...current,...(previous||{}),top:current.top,left:current.left,inspectorTop:current.inspectorTop};return false;
  }
  async function renderPage(restore){
    gesture=null;pageObserver?.disconnect();const generation=++epoch,current=doc(),stage=$('#lined-stage');if(!current||!stage)return;
    viewport=undefined;stage.innerHTML='<p class="lined-loading">Opening script pages…</p>';setStatus('Opening script pages…');
    try{
      const {pdf:file}=await load(current.sha256);if(generation!==epoch||!stage.isConnected)return;
      layout=await documentLayout(file);if(generation!==epoch||!stage.isConnected)return;
      page=clamp(page,0,file.numPages-1);const item=layout.pages[page];
      viewport=continuous?{width:layout.width,height:layout.height}:item.view;
      stage.innerHTML='<div class="lined-page'+(continuous?' lined-continuous':'')+'"><div id="lined-sheets"></div><svg id="lined-overlay" role="img" aria-label="Script annotations"></svg></div>';
      const container=$('.lined-page'),sheets=$('#lined-sheets'),overlay=$('#lined-overlay');
      container.style.width=viewport.width*zoom+'px';container.style.height=viewport.height*zoom+'px';
      overlay.setAttribute('viewBox',`${-GUTTER} 0 ${viewport.width+2*GUTTER} ${viewport.height}`);
      stage.style.cssText=`width:${viewport.width*zoom}px;padding:0 ${GUTTER*zoom}px;margin:auto;box-sizing:content-box`;
      overlay.style.cssText=`left:${-GUTTER*zoom}px;width:${(viewport.width+2*GUTTER)*zoom}px`;
      const renderSheet=async(canvas,index)=>{
        if(generation!==epoch||!canvas.isConnected||canvas.dataset.rendering==='true')return;
        canvas.dataset.rendering='true';
        const sheet=layout.pages[index],factor=(continuous?1:Math.min(window.devicePixelRatio||1,2))*zoom,view=sheet.source.getViewport({scale:factor});
        canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
        try{await sheet.source.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;}catch(error){if(generation===epoch)setStatus(error.message,true);}
        finally{canvas.dataset.rendering='false';if(continuous&&canvas.dataset.visible!=='true')canvas.width=canvas.height=1;}
      };
      if(continuous){
        // Render visible sheets only: a long screenplay does not allocate one enormous bitmap.
        pageObserver=new IntersectionObserver(entries=>{for(const entry of entries){const canvas=entry.target;canvas.dataset.visible=String(entry.isIntersecting);if(entry.isIntersecting&&canvas.width===1)renderSheet(canvas,Number(canvas.dataset.pdfPage));else if(!entry.isIntersecting&&canvas.dataset.rendering!=='true')canvas.width=canvas.height=1;}},{root:$('#lined-scroll'),rootMargin:'800px'});
        layout.pages.forEach((sheet,index)=>{const canvas=document.createElement('canvas');canvas.dataset.pdfPage=index;canvas.width=canvas.height=1;canvas.style.cssText=`position:absolute;left:${sheet.left*zoom}px;top:${sheet.top*zoom}px;width:${sheet.view.width*zoom}px;height:${sheet.view.height*zoom}px`;sheets.append(canvas);pageObserver.observe(canvas);});
      }else{
        const canvas=document.createElement('canvas');canvas.id='lined-canvas';sheets.append(canvas);await renderSheet(canvas,page);
      }
      if(generation!==epoch||!stage.isConnected)return;
      $('#lined-pages').textContent=continuous?`${file.numPages} pages`:`Page ${page+1} of ${file.numPages}`;
      $('#lined-prev').hidden=continuous;$('#lined-next').hidden=continuous;$('#lined-prev').disabled=page===0;$('#lined-next').disabled=page===file.numPages-1;
      drawOverlay();bindPointers(overlay);renderInspector();
      if(restore)restoreScroll(restore);
      setStatus(continuous?'Continuous scroll: draw lines and notes across pages. Marks save automatically.':'Marks save automatically. Full backups include every attached PDF revision.');
    }catch(error){if(generation===epoch){setStatus(error.name==='PasswordException'?'Use an unencrypted PDF for lining.':error.message,true);stage.innerHTML='<p class="lined-loading">The PDF could not be opened. Choose Attach original PDF to retry.</p>';}}
  }
  function coverageLabel(m,project=p()){
    const linked=project._shots.find(s=>s.id===m.shotId);
    if(linked)return label(linked,project);
    return [m.draft?.number?'Unlinked '+m.draft.number:'Unlinked coverage',m.draft?.camera?'Camera '+m.draft.camera:''].filter(Boolean).join(' · ');
  }
  function primitives(m){
    const s=shot(m.shotId||null),movement=m.type==='coverage'?(s?.movement||m.draft?.movement):'';
    const options={gutters:GUTTER,opacity:preferences().linedLabelOpacity};
    if(continuous)return documentPrimitives(m,layout,coverageLabel(m),movement,options);
    if(m.space==='document'){const item=layout.pages[page];return translatePrimitives(documentPrimitives(m,layout,coverageLabel(m),movement,options),-item.left,-item.top);}
    return markPrimitives(m,viewport.width,viewport.height,coverageLabel(m),movement,options);
  }
  function displayPoint(m,value){
    if(m.space==='document'){const xy=[value[0]*layout.width,value[1]*layout.height],item=layout.pages[page];return continuous?xy:[xy[0]-item.left,xy[1]-item.top];}
    const item=layout.pages[m.page];return continuous?[value[0]*item.view.width+item.left,value[1]*item.view.height+item.top]:[value[0]*viewport.width,value[1]*viewport.height];
  }
  function toDocument(m){
    if(m.space==='document')return copy(m);const value=copy(m),item=layout.pages[m.page];
    const convert=xy=>[(xy[0]*item.view.width+item.left)/layout.width,(xy[1]*item.view.height+item.top)/layout.height];
    value.start=convert(value.start);if(value.end)value.end=convert(value.end);if(value.labelAt)value.labelAt=convert(value.labelAt);if(value.points)value.points=value.points.map(convert);value.space='document';return value;
  }
  const pageAt=y=>{for(let i=layout.pages.length-1;i>=0;i--)if(layout.pages[i].top<=y*layout.height)return i;return 0;};
  function svgNode(tag,attrs={},text){const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;}
  function drawOverlay(preview){
    const overlay=$('#lined-overlay');if(!overlay||!viewport)return;overlay.replaceChildren();
    let marks=doc()?.marks.filter(m=>continuous||m.space==='document'||m.page===page)||[];
    if(preview)marks=marks.some(m=>m.id===preview.id)?marks.map(m=>m.id===preview.id?preview:m):[...marks,preview];
    for(const m of marks){
      const group=svgNode('g',{'data-lined-mark':m.id,class:m.id===selectedId?'lined-selected':'',tabindex:0,'aria-label':m.type==='coverage'?'Coverage line '+coverageLabel(m):'Script annotation','aria-selected':String(m.id===selectedId)});
      for(const item of primitives(m)){
        if(item.kind==='path'){
          const points=item.points.map(p=>p.join(',')).join(' ');
          group.append(svgNode('polyline',{points,fill:'none',stroke:'transparent','stroke-width':Math.max(12,item.width),class:'lined-hit'}));
          group.append(svgNode('polyline',{points,fill:'none',stroke:item.color,'stroke-width':item.width,opacity:item.alpha,...(item.connector?{class:'lined-connector','pointer-events':'none'}:{}),'stroke-linecap':'round','stroke-linejoin':'round'}));
        }else{
          group.append(svgNode('rect',{x:item.x,y:item.y,width:item.boxWidth,height:item.boxHeight,fill:'white','fill-opacity':item.opacity,stroke:item.color,'stroke-width':'.6',class:item.handle==='label'?'lined-info-box':'',rx:2,...(item.handle?{'data-lined-handle':item.handle}:{})}));
          item.lines.forEach((line,i)=>group.append(svgNode('text',{x:item.x+item.padding,y:item.y+item.baseline+i*item.lineHeight,fill:item.color,'font-size':item.fontSize,'font-family':'Arial, sans-serif',...(item.handle?{'data-lined-handle':item.handle}:{})},line)));
        }
      }
      if(m.id===selectedId&&['coverage','arrow'].includes(m.type))for(const key of ['start','end'])group.append(svgNode('circle',{cx:displayPoint(m,m[key])[0],cy:displayPoint(m,m[key])[1],r:5,fill:'white',stroke:m.color,'stroke-width':1.5,'data-lined-handle':key}));
      overlay.append(group);
    }
  }
  function renderInspector(){
    const target=$('#lined-inspector');if(!target)return;
    const selected=mark(),coverage=selected?.type==='coverage',linked=coverage?shot(selected.shotId||null):shot();
    const details=coverage?(linked||selected.draft||{}):linked;
    const field=(name,key,max,placeholder='')=>`<label class="field">${name}<input id="lined-${key}" value="${esc(details?.[key]||'')}" maxlength="${max}" ${details||coverage?'':'disabled'} placeholder="${esc(placeholder)}"></label>`;
    target.innerHTML=`<div class="eyebrow">${selected?'SELECTED ANNOTATION':'SHOT COVERAGE'}</div><h3>${selected?({coverage:'Coverage line',pen:'Pen drawing',highlighter:'Highlight',arrow:'Arrow',text:'Script note'})[selected.type]:'New line, new shot.'}</h3><label class="field">Find shot number<input id="lined-shot-search" type="search" placeholder="Type a shot number…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="lined-shot-results" aria-expanded="false"></label><div id="lined-shot-results" role="listbox" hidden></div><label class="field">Linked shot<select id="lined-shot"><option value="" ${linked?'':'selected'}>Unlinked · assign later</option>${options(linked?.id)}</select></label><button id="lined-new-shot">${coverage?'＋ Create shot from this line':'＋ New linked shot'}</button>${coverage&&linked?`<p class="lined-current-number">Shot ${esc(numberLabel(linked))}</p><button id="lined-renumber">Renumber shot…</button>`:''}${coverage&&!linked?`<p class="tiny">These details save with the line. Create a shot to add them to the shot list, or choose an existing shot above.</p><label class="field">Scene<select id="lined-draft-scene"><option value="">Choose when linking</option>${p().breakdowns.filter(b=>b.type==='scene').map(b=>`<option value="${esc(b.id)}" ${details.sceneId===b.id?'selected':''}>Scene ${esc(b.scene)}</option>`).join('')}</select></label>${field('Shot number / suffix','number',24,'e.g. A')}`:''}${coverage?field('Shot description','description',2000,'e.g. Wide master'):''}${field('Camera movement','movement',500,'e.g. Push in on the last line')}${coverage?field('Camera','camera',100,'e.g. A')+field('Lens (mm)','lens',100,'e.g. 35')+field('Shot size','size',100,'e.g. Wide')+field('Equipment','equipment',500,'e.g. Dolly'):''}${!selected||coverage?`<label class="field">Coverage style<select id="lined-style"><option value="solid" ${(selected?.style||style)==='solid'?'selected':''}>Straight · on camera</option><option value="wavy" ${(selected?.style||style)==='wavy'?'selected':''}>Wavy · off camera</option></select></label>`:''}${selected?`<label class="field">${selected.type==='text'?'Note text':'Timing / margin note'}<textarea id="lined-note" rows="4" maxlength="2000">${esc(selected.type==='text'?selected.text:selected.note||'')}</textarea></label><button id="lined-delete" class="danger">Delete annotation</button>`:''}<div class="lined-help"><strong>How to mark the page</strong><p>Each new coverage line creates its own shot in the selected scene. Select a line to edit it, renumber it, or deliberately link it to an existing shot. Linking copies any camera details entered on this line into the chosen shot; its scene and number stay unchanged.</p><p>Linked details update the shot list automatically. Page references and timing notes appear in the shot’s Script coverage section and exports.</p><p>Use Select to move marks or drag line endpoints and labels. Each PDF revision keeps its own annotations.</p></div>`;
    const search=$('#lined-shot-search'),results=$('#lined-shot-results');let matches=[],active=-1;
    function showMatches(){
      const query=search.value.trim().toLowerCase();matches=sortedShots().filter(s=>!query||numberLabel(s).toLowerCase().includes(query)||s.number.toLowerCase().includes(query)||s.description.toLowerCase().includes(query));active=-1;
      results.replaceChildren();results.hidden=false;search.setAttribute('aria-expanded','true');search.removeAttribute('aria-activedescendant');
      for(const [index,s] of matches.entries()){const button=document.createElement('button');button.id='lined-match-'+index;button.type='button';button.role='option';button.textContent=label(s)+' · '+s.description;button.onmousedown=e=>e.preventDefault();button.onclick=()=>choose(s);results.append(button);}
      if(!matches.length)results.textContent='No matching shots';
    }
    function choose(s){if(!p()._shots.some(value=>value.id===s.id))return;$('#lined-shot').value=s.id;$('#lined-shot').dispatchEvent(new Event('change'));}
    search.oninput=showMatches;search.onfocus=showMatches;
    search.onblur=()=>{results.hidden=true;search.setAttribute('aria-expanded','false');};
    search.onkeydown=event=>{
      if(event.key==='Escape'){event.preventDefault();results.hidden=true;search.setAttribute('aria-expanded','false');return;}
      if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(results.hidden)showMatches();if(!matches.length)return;active=(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;[...results.children].forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));search.setAttribute('aria-activedescendant','lined-match-'+active);results.children[active]?.scrollIntoView({block:'nearest'});}
      if(event.key==='Enter'){event.preventDefault();const exact=matches.filter(s=>numberLabel(s).toLowerCase()===search.value.trim().toLowerCase());if(active>=0)choose(matches[active]);else if(exact.length===1)choose(exact[0]);else if(matches.length===1)choose(matches[0]);}
    };
    if($('#lined-renumber'))$('#lined-renumber').onclick=renumber;
    $('#lined-shot').onchange=e=>{
      shotId=e.target.value;
      if(coverage)c.mutate(()=>{
        if(!shotId&&linked)selected.draft=Object.fromEntries(['sceneId','number',...shotFields].map(key=>[key,linked[key]]));
        const destination=shot(shotId);
        if(destination&&selected.draft)for(const key of shotFields)if(selected.draft[key]?.trim())destination[key]=selected.draft[key];
        selected.shotId=shotId||null;if(destination)delete selected.draft;
      },false);
      drawOverlay();renderInspector();
    };
    $('#lined-new-shot').onclick=newShot;
    for(const key of coverage?[...shotFields,...(!linked?['number']:[])]:['movement']){
      bindEdit($('#lined-'+key),value=>(linked||coverage)&&(linked||selected?.draft||{})[key]!==value,value=>{
        if(linked)linked[key]=value;else{selected.draft||={};selected.draft[key]=value;}
      });
    }
    if($('#lined-draft-scene'))$('#lined-draft-scene').onchange=e=>c.mutate(()=>{selected.draft||={};if(e.target.value)selected.draft.sceneId=e.target.value;else delete selected.draft.sceneId;},false);
    if($('#lined-style'))$('#lined-style').onchange=e=>{style=e.target.value;if(coverage)c.mutate(()=>selected.style=style,false);drawOverlay();};
    updateShortcutTitles();
    if(selected){bindEdit($('#lined-note'),value=>selected[selected.type==='text'?'text':'note']!==value,value=>selected[selected.type==='text'?'text':'note']=value);$('#lined-delete').onclick=()=>deleteMark();}
  }
  function bindEdit(input,changed,write){let editing=false;input.oninput=()=>{if(changed(input.value)){c.edit(()=>write(input.value),!editing);editing=true;drawOverlay();}};input.onblur=()=>editing=false;}
  function deleteMark(mid=selectedId){
    const project=p(),document=doc(),target=document?.marks.find(m=>m.id===mid);if(!target)return;
    const linked=target.type==='coverage'&&shot(target.shotId||null);
    const remove=()=>{
      if(p()!==project||doc()!==document||!document.marks.includes(target))return;
      c.mutate(()=>{if(linked){removeCoverage(project,[linked.id]);project._shots=project._shots.filter(s=>s.id!==linked.id);if(shotId===linked.id)shotId='';}else document.marks=document.marks.filter(m=>m.id!==target.id);selectedId=undefined;},false);
      drawOverlay();renderInspector();
    };
    if(linked)confirmLinkedDelete(c,'lined','Delete linked coverage line?', 'This coverage line is linked to Shot list. Deleting it removes the shot and all of its linked coverage lines, including lines in other PDF revisions.',remove);
    else remove();
  }
  function newShot(){
    const scenes=p().breakdowns.filter(b=>b.type==='scene');if(!scenes.length){c.toast('Add or import a scene before creating a linked shot.');return;}
    const target=mark()?.type==='coverage'?mark():null,project=p(),document=doc();
    const seed=target?(shot(target.shotId||null)||target.draft||{}):{};
    const sceneId=seed.sceneId||shot()?.sceneId||scenes.find(b=>b.id===c.selectedScene())?.id||scenes[0].id;
    const input=(name,key,max,placeholder='')=>`<label class="field">${name}<input id="lined-new-${key}" maxlength="${max}" value="${esc(seed[key]||'')}" placeholder="${esc(placeholder)}"></label>`;
    c.modal(target?'Create shot from coverage':'New linked shot',`<label class="field">Scene<select id="lined-new-scene">${scenes.map(b=>`<option value="${esc(b.id)}" ${b.id===sceneId?'selected':''}>Scene ${esc(b.scene)}</option>`).join('')}</select></label>${input('Shot number / suffix','number',24,'e.g. A')}${input('Description','description',2000,'e.g. Wide master')}${input('Camera movement','movement',500,'e.g. Slow push in')}${input('Camera','camera',100,'A')}${input('Lens (mm)','lens',100,'35')}${input('Shot size','size',100,'Wide')}${input('Equipment','equipment',500,'Tripod')}`,'<button id="modal-cancel">Cancel</button><button id="lined-create-shot" class="primary">Create linked shot</button>');
    const next=()=>$('#lined-new-number').value=nextNumber($('#lined-new-scene').value);
    if(!seed.number||project._shots.some(s=>s.sceneId===sceneId&&numberKey(s.number,sceneId)===numberKey(seed.number,sceneId)))next();
    $('#lined-new-scene').onchange=next;
    if(!$('#lined-new-description').value&&target)$('#lined-new-description').value=`Coverage · ${document.filename} · p. ${target.page+1}`;
    $('#lined-create-shot').onclick=()=>{
      const sceneId=$('#lined-new-scene').value,number=normalizeShotNumber($('#lined-new-number').value,project.breakdowns.find(b=>b.id===sceneId)?.scene),description=$('#lined-new-description').value.trim();
      if(!number||number==='.'||number.length>24||!description){$('#modal-error').textContent='Enter a shot number and description.';return;}
      if(project._shots.some(s=>s.sceneId===sceneId&&numberKey(s.number,sceneId)===numberKey(number,sceneId))){$('#modal-error').textContent='This scene already has that shot number.';return;}
      if(project!==p()||document!==doc()||(target&&!document.marks.includes(target))){$('#modal-error').textContent='The selected coverage changed. Close this dialog and try again.';return;}
      const value={id:id(),created:stamp(),sceneId,number,description,movement:$('#lined-new-movement').value,size:$('#lined-new-size').value||'Wide',camera:$('#lined-new-camera').value||'A',lens:$('#lined-new-lens').value,equipment:$('#lined-new-equipment').value,notes:'',circleTake:'',priority:'Essential',status:'Planned',setupMinutes:10,shootMinutes:15,actualMinutes:null,takes:0};
      c.mutate(()=>{project._shots.push(value);shotId=value.id;if(target){target.shotId=value.id;delete target.draft;}},false);
      $('#modal').close();renderInspector();drawOverlay();
    };
  }
  function renumber(){
    const target=mark()?.type==='coverage'?shot(mark().shotId):null;if(!target){c.toast('Select a linked coverage line to renumber its shot.');return;}
    const project=p(),scene=project.breakdowns.find(b=>b.id===target.sceneId);
    c.modal('Renumber shot '+numberLabel(target),`<label class="field">New shot number<input id="lined-renumber-value" maxlength="24" value="${esc(target.number)}"></label><p>Enter a suffix or full shot number. All coverage lines keep their links.</p><label><input id="lined-renumber-swap" type="checkbox"> If occupied, swap numbers with that shot</label>`,'<button id="modal-cancel">Cancel</button><button id="lined-renumber-save" class="primary">Renumber</button>');
    $('#lined-renumber-save').onclick=()=>{
      const number=normalizeShotNumber($('#lined-renumber-value').value,scene?.scene);
      if(!number||number==='.'||number.length>24){$('#modal-error').textContent='Enter a shot number of 1–24 characters.';return;}
      if(project!==p()||!project._shots.includes(target)){$('#modal-error').textContent='The shot changed. Close this dialog and try again.';return;}
      const collision=project._shots.find(s=>s.id!==target.id&&s.sceneId===target.sceneId&&numberKey(s.number,s.sceneId)===numberKey(number,target.sceneId));
      if(collision&&!$('#lined-renumber-swap').checked){$('#modal-error').textContent='That number belongs to '+numberLabel(collision)+'. Choose another number or enable swapping.';return;}
      c.mutate(()=>{if(collision)collision.number=target.number;target.number=number;},false);$('#modal').close();drawOverlay();renderInspector();
    };
    $('#lined-renumber-value').select();
  }
  function point(event,overlay,space,allowGutter=false){
    const rect=overlay.getBoundingClientRect(),scroll=$('#lined-scroll').getBoundingClientRect();
    const value=[clamp(((event.clientX-rect.left)/rect.width*(viewport.width+2*GUTTER)-GUTTER)/viewport.width,allowGutter?-GUTTER/viewport.width:0,allowGutter?1+GUTTER/viewport.width:1),clamp(((continuous?clamp(event.clientY,scroll.top,scroll.bottom):event.clientY)-rect.top)/rect.height)];
    if(!continuous&&space==='document'){const item=layout.pages[page];return [(value[0]*item.view.width+item.left)/layout.width,(value[1]*item.view.height+item.top)/layout.height];}
    return value;
  }
  function bindPointers(overlay){
    overlay.dataset.tool=tool;
    overlay.oncontextmenu=event=>{const mid=event.target.closest('[data-lined-mark]')?.dataset.linedMark;if(!mid)return;deleteMenu.open(event,()=>deleteMark(mid));};
    overlay.onkeydown=event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){const hit=event.target.closest('[data-lined-mark]');if(hit){const rect=hit.getBoundingClientRect();deleteMenu.open({preventDefault:()=>event.preventDefault(),target:hit,clientX:rect.left+20,clientY:Math.max(rect.top,overlay.getBoundingClientRect().top)+20},()=>deleteMark(hit.dataset.linedMark));}}};
    let lastPointer;
    const autoScroll=()=>{
      if(!gesture||!continuous||!overlay.isConnected)return;
      const scroll=$('#lined-scroll'),rect=scroll.getBoundingClientRect(),y=lastPointer.clientY;
      const speed=y>rect.bottom-40?Math.min(18,(y-rect.bottom+40)/2):y<rect.top+40?-Math.min(18,(rect.top+40-y)/2):0;
      if(speed){const before=scroll.scrollTop;scroll.scrollTop+=speed;if(scroll.scrollTop!==before)overlay.onpointermove(lastPointer);}
      requestAnimationFrame(autoScroll);
    };
    overlay.onpointerdown=event=>{
      if(event.button!==0||busy)return;event.preventDefault();let start=point(event,overlay);const hit=event.target.closest('[data-lined-mark]');
      const paper=$('.lined-page').getBoundingClientRect();
      if(!hit&&tool!=='select'&&(event.clientX<paper.left||event.clientX>paper.right))return;
      if(tool==='select'||hit){
        selectedId=hit?.dataset.linedMark;const selected=mark();if(!selected){drawOverlay();renderInspector();return;}
        if(selected.type==='coverage')shotId=selected.shotId||'';const original=continuous?toDocument(selected):copy(selected);start=point(event,overlay,original.space,event.target.dataset.linedHandle==='label');gesture={kind:'move',original,start,moved:false,handle:event.target.dataset.linedHandle};
      }else if(tool==='text'){
        c.modal('Script note','<label class="field">Camera direction or note<textarea id="lined-text" rows="4" maxlength="2000" placeholder="e.g. Pan to Maya on the door slam"></textarea></label>','<button id="modal-cancel">Cancel</button><button id="lined-text-save" class="primary">Place note</button>');
        $('#lined-text-save').onclick=()=>{const text=$('#lined-text').value.trim();if(!text)return;const value={id:id(),type:'text',page:continuous?pageAt(start[1]):page,...(continuous?{space:'document'}:{}),start,color,width,text};c.mutate(()=>doc().marks.push(value),false);selectedId=value.id;$('#modal').close();drawOverlay();renderInspector();};return;
      }else{
        const value={id:id(),type:tool,page:continuous?pageAt(start[1]):page,...(continuous?{space:'document'}:{}),start,color,width};
        if(tool==='coverage')Object.assign(value,{end:[...start],shotId:null,style,note:''});
        if(tool==='arrow')value.end=[...start];
        if(tool==='pen'||tool==='highlighter')value.points=[[...start]];
        gesture={kind:'create',original:value,start};selectedId=value.id;
      }
      gesture.project=p().id;gesture.pdf=doc().sha256;gesture.preview=copy(gesture.original);
      overlay.setPointerCapture(event.pointerId);lastPointer={clientX:event.clientX,clientY:event.clientY};requestAnimationFrame(autoScroll);drawOverlay(gesture.preview);renderInspector();
    };
    overlay.onpointermove=event=>{
      lastPointer={clientX:event.clientX,clientY:event.clientY};if(!gesture)return;const next=point(event,overlay,gesture.original.space,gesture.handle==='label'),value=copy(gesture.original),dimensions=value.space==='document'?layout:viewport;
      if(gesture.kind==='move'){
        if(Math.hypot((next[0]-gesture.start[0])*dimensions.width,(next[1]-gesture.start[1])*dimensions.height)>1)gesture.moved=true;
        if(gesture.handle==='label'){
          const anchor=(value.space==='document'?documentPrimitives(gesture.original,layout,coverageLabel(value),shot(value.shotId)?.movement,{gutters:GUTTER}):primitives(gesture.original)).find(item=>item.kind==='text');
          value.labelAt=[clamp(anchor.x/dimensions.width+next[0]-gesture.start[0],-Math.min(.5,GUTTER/dimensions.width),1+Math.min(.5,GUTTER/dimensions.width)),clamp(anchor.y/dimensions.height+next[1]-gesture.start[1])];
        }else if(gesture.handle){value[gesture.handle]=next;if(value.type==='coverage'){value.start[0]=value.end[0]=next[0];}}
        else{
          const all=[value.start,...(value.end?[value.end]:[]),...(value.points||[])];
          const dx=clamp(next[0]-gesture.start[0],-Math.min(...all.map(a=>a[0])),1-Math.max(...all.map(a=>a[0]))),dy=clamp(next[1]-gesture.start[1],-Math.min(...all.map(a=>a[1])),1-Math.max(...all.map(a=>a[1])));
          const move=a=>[a[0]+dx,a[1]+dy];value.start=move(value.start);if(value.end)value.end=move(value.end);if(value.points)value.points=value.points.map(move);if(value.labelAt)value.labelAt=[clamp(value.labelAt[0]+dx,-Math.min(.5,GUTTER/dimensions.width),1+Math.min(.5,GUTTER/dimensions.width)),clamp(value.labelAt[1]+dy)];
        }
      }else if(value.type==='coverage')value.end=[value.start[0],next[1]];
      else if(value.type==='arrow')value.end=next;
      else{let points=gesture.preview.points||[];if(points.length>=5000)points=points.filter((_,i)=>i%2===0);value.points=[...points,next];}
      gesture.preview=value;drawOverlay(value);
    };
    overlay.onpointerup=event=>{
      if(!gesture)return;const current=gesture;gesture=null;
      if(current.project!==p().id||current.pdf!==doc()?.sha256)return;
      const value=current.preview;
      if(current.kind==='move'&&!current.moved){drawOverlay();renderInspector();return;}
      const dimensions=value.space==='document'?layout:viewport;
      if(value.space==='document'){const ys=[value.start[1],...(value.end?[value.end[1]]:[]),...(value.points||[]).map(xy=>xy[1])];value.page=pageAt(Math.min(...ys));value.endPage=pageAt(Math.max(...ys));}
      if(current.kind==='create'&&((value.points&&value.points.length<2)||(value.end&&Math.hypot((value.end[0]-value.start[0])*dimensions.width,(value.end[1]-value.start[1])*dimensions.height)<2))){selectedId=undefined;drawOverlay();return;}
      if(JSON.stringify(value)!==JSON.stringify(current.original)||current.kind==='create')c.mutate(()=>{if(current.kind==='create'){
        if(value.type==='coverage'){
          const scene=defaultScene();
          if(scene){const created=makeShot(scene.id,nextNumber(scene.id),{description:`Coverage · ${doc().filename} · p. ${value.page+1}`});p()._shots.push(created);value.shotId=created.id;shotId=created.id;}
          else value.draft={};
        }
        doc().marks.push(value);
      }else doc().marks=doc().marks.map(m=>m.id===value.id?value:m);},false);
      selectedId=value.id;drawOverlay();renderInspector();
    };
      overlay.onpointercancel=()=>{gesture=null;drawOverlay();renderInspector();};
  }
  async function fromScriptText(){
    if(busy)return;busy=true;const project=p();setStatus('Creating a scrollable copy of the imported script…');
    try{
      const {PDFDocument,StandardFonts}=window.PDFLib,pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Courier);
      const text=project.breakdowns.filter(b=>b.type==='scene').map(b=>b._scriptText||'').filter(Boolean).join('\n\n');
      if(!text.trim())throw Error('Import a script or enter scene text first.');
      await document.fonts.load('12px "SP Script"');
      const canvas=document.createElement('canvas');canvas.width=936;canvas.height=32;
      const context=canvas.getContext('2d');context.scale(2,2);context.font='12px "SP Script", "Courier New", monospace';
      const rows=[];
      for(const paragraph of text.split('\n')){
        let row='',length=0;
        for(const ch of Array.from(paragraph.replace(/\t/g,'    '))){
          let advance;try{advance=font.widthOfTextAtSize(ch,12);}catch{advance=context.measureText(ch).width;}
          if(length+advance>468&&row){rows.push(row);row='';length=0;}row+=ch;length+=advance;
        }
        rows.push(row);
      }
      let sheet,y;
      for(const row of rows){
        if(!sheet||y<60){sheet=pdf.addPage([612,792]);y=732;}
        try{font.encodeText(row);sheet.drawText(row,{x:72,y,font,size:12});}
        catch{
          // Preserve characters outside the built-in PDF font using the system's glyphs.
          context.clearRect(0,0,468,16);context.fillText(row,0,12);
          const image=await pdf.embedPng(canvas.toDataURL('image/png'));sheet.drawImage(image,{x:72,y:y-4,width:468,height:16});
        }
        y-=14;
      }
      const raw=await pdf.save(),filename=(project._scriptFilename||'script').replace(/\.[^.]+$/,'')+'-text.pdf';
      if(p()!==project){c.toast('Return to the original production to create its script copy.');return;}
      continuous=true;try{localStorage.setItem('productionDeskContinuousScript','true');}catch{}
      busy=false;await attach(new File([raw],filename,{type:'application/pdf'}));
    }catch(error){setStatus(error.message,true);}finally{busy=false;}
  }
  async function attach(file){
    if(!file)return;if(file.size>40*1024*1024){c.toast('Choose a PDF smaller than 40 MB.');return;}
    const project=p();busy=true;setStatus('Checking and attaching original PDF…');
    try{
      const lib=await libraries(),raw=new Uint8Array(await file.arrayBuffer()),check=lib.getDocument({data:raw.slice(),isEvalSupported:false,useWasm:false});
      try{await check.promise;}finally{await check.destroy();}
      const response=await c.api('/api/pdf',file,{'X-Filename':encodeURIComponent(file.name)});
      if(project.id!==p().id){c.toast('PDF uploaded. Return to the original production to attach it.');return;}
      c.mutate(()=>{project._linedScript||={activePdf:null,documents:[]};if(!project._linedScript.documents.some(d=>d.sha256===response.document.sha256))project._linedScript.documents.push(response.document);project._linedScript.activePdf=response.document.sha256;});
    }catch(error){setStatus(error.name==='PasswordException'?'Use an unencrypted PDF for lining.':error.message,true);}finally{busy=false;}
  }
  async function exportPDF(){
    if(busy||!doc())return;busy=true;const current=copy(doc()),project=copy(p());setStatus('Creating lined PDF…');
    try{
      const {pdf:file,bytes}=await load(current.sha256),{PDFDocument,degrees}=window.PDFLib;
      const output=await PDFDocument.load(bytes.slice(),{updateMetadata:false});
      const exportLayout=await documentLayout(file);
      for(let index=0;index<file.numPages;index++){
        const marks=current.marks.filter(m=>m.space==='document'||m.page===index);if(!marks.length)continue;
        const source=await file.getPage(index+1),view=source.getViewport({scale:1});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width*2);canvas.height=Math.ceil(view.height*2);
        const context=canvas.getContext('2d');context.scale(2,2);
        for(const m of marks){const s=project._shots.find(s=>s.id===m.shotId);const item=exportLayout.pages[index];paint(context,translatePrimitives(documentPrimitives(m,exportLayout,coverageLabel(m,project),m.type==='coverage'?(s?.movement||m.draft?.movement):'',{opacity:preferences().linedLabelOpacity}),-item.left,-item.top));}
        const image=await output.embedPng(canvas.toDataURL('image/png'));
        const bottomLeft=view.convertToPdfPoint(0,view.height),bottomRight=view.convertToPdfPoint(view.width,view.height),topLeft=view.convertToPdfPoint(0,0);
        output.getPage(index).drawImage(image,{x:bottomLeft[0],y:bottomLeft[1],width:Math.hypot(bottomRight[0]-bottomLeft[0],bottomRight[1]-bottomLeft[1]),height:Math.hypot(topLeft[0]-bottomLeft[0],topLeft[1]-bottomLeft[1]),rotate:degrees(source.rotate)});
      }
      if(current.marks.some(m=>m.page>=file.numPages||m.endPage>=file.numPages))throw Error('An annotation refers to a page outside this PDF.');
      const raw=await output.save();let binary='';for(let i=0;i<raw.length;i+=8192)binary+=String.fromCharCode(...raw.subarray(i,i+8192));
      const filename=((project.project||project.name).replace(/[^\w -]/g,'').trim()||'production').slice(0,120)+'-lined-script.pdf';
      if(await c.download(filename,btoa(binary),'application/pdf','base64')===false)throw Error('The export could not be written. Please retry.');
      setStatus('Lined PDF exported. The original PDF and editable annotations are preserved.');
    }catch(error){setStatus('PDF export failed: '+error.message,true);}finally{busy=false;}
  }
  function bind(){
    gesture=null;$('#lined-attach').onclick=()=>$('#lined-file').click();$('#lined-empty-attach')?.addEventListener('click',()=>$('#lined-file').click());$('#lined-file').onchange=e=>attach(e.target.files[0]);$('#lined-export').onclick=exportPDF;
    if(!doc()){$('#lined-from-text')?.addEventListener('click',fromScriptText);updateShortcutTitles();return;}
    $('#lined-document').onchange=e=>{c.mutate(()=>lining().activePdf=e.target.value);};
    $('#lined-continuous').onchange=e=>{continuous=e.target.checked;try{localStorage.setItem('productionDeskContinuousScript',String(continuous));}catch{}selectedId=undefined;renderPage();};
    $('#lined-prev').onclick=()=>{page--;selectedId=undefined;renderPage();};$('#lined-next').onclick=()=>{page++;selectedId=undefined;renderPage();};$('#lined-zoom').onchange=e=>{const state=captureState(),old=zoom;zoom=Number(e.target.value);state.top*=zoom/old;state.left*=zoom/old;renderPage(state);};
    document.querySelectorAll('[data-lined-tool]').forEach(button=>button.onclick=()=>{tool=button.dataset.linedTool;document.querySelectorAll('[data-lined-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(tool==='highlighter'){color='#FFD54F';width=14;}else if(width===14)width=2;$('#lined-color').value=color;$('#lined-width').value=width;if($('#lined-overlay'))$('#lined-overlay').dataset.tool=tool;});
    $('#lined-color').onchange=e=>{color=e.target.value;if(mark())c.mutate(()=>mark().color=color,false);drawOverlay();};$('#lined-width').onchange=e=>{width=Number(e.target.value);if(mark())c.mutate(()=>mark().width=width,false);drawOverlay();};
    if(pendingRestore){const state=pendingRestore;pendingRestore=undefined;page=state.page;selectedId=state.selectedId;sync();renderInspector();renderPage(state);}else{renderInspector();renderPage();}
    updateShortcutTitles();
  }
  function runAction(action){
    const clicks={previous:'#lined-prev',next:'#lined-next',continuous:'#lined-continuous',newShot:'#lined-new-shot',linkShot:'#lined-shot-search',renumber:'#lined-renumber',delete:'#lined-delete',attach:'#lined-attach',export:'#lined-export'};
    if(['select','coverage','pen','highlighter','arrow','text'].includes(action))$(`[data-lined-tool="${action}"]`)?.click();
    else if(action==='style'){const select=$('#lined-style');if(select){select.value=select.value==='solid'?'wavy':'solid';select.dispatchEvent(new Event('change'));}}
    else if(action==='zoomIn'||action==='zoomOut'){const select=$('#lined-zoom');if(select){select.selectedIndex=clamp(select.selectedIndex+(action==='zoomIn'?1:-1),0,select.options.length-1);select.dispatchEvent(new Event('change'));}}
    else {const node=$(clicks[action]||'__none__');if(node&&!node.disabled&&!node.hidden){if(action==='linkShot')node.focus({preventScroll:true});else node.click();}}
  }
  function updateShortcutTitles(){
    const selectors={previous:'#lined-prev',next:'#lined-next',continuous:'#lined-continuous',newShot:'#lined-new-shot',renumber:'#lined-renumber',delete:'#lined-delete',attach:'#lined-attach',export:'#lined-export',linkShot:'#lined-shot-search'};
    for(const [action,name] of Object.entries(LINED_ACTIONS)){const node=$(`[data-lined-tool="${action}"]`)||$(selectors[action]||'__none__');if(node){const binding=preferences().linedKeyBinds[action];node.title=name+(binding?' ('+binding+')':'');}}
  }
  document.addEventListener('productiondesk:preferences',()=>{if(c.isActive()){drawOverlay();updateShortcutTitles();}});
  document.addEventListener('keydown',event=>{
    if(!c.isActive()||busy||gesture||event.defaultPrevented||event.repeat||event.isComposing||document.querySelector('dialog[open]')||isEditing(document.activeElement)||isEditing(event.target))return;
    const binding=eventBinding(event),action=Object.keys(LINED_ACTIONS).find(key=>preferences().linedKeyBinds[key]===binding);
    if(action){event.preventDefault();runAction(action);}
  });
  return {render,bind,exportPDF,newShot,captureState,refreshHistory};
}
