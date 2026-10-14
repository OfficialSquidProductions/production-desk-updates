// Original pages remain immutable. Editable marks use normalized page coordinates.
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
export function markPrimitives(mark,width,height,shotLabel,movement){
  const pos=p=>[p[0]*width,p[1]*height], result=[];
  const path=(points,alpha=1)=>result.push({kind:'path',points,color:mark.color,width:mark.width,alpha});
  const text=(content,anchor)=>{
    const maxColumns=Math.max(1,Math.floor((width-22)/11));
    let columns=Math.min(36,maxColumns),lines=wrap(content,columns);
    // Widen long notes before scaling them, keeping every word on the page.
    while(lines.length*15+10>height-8&&columns<maxColumns){columns=Math.min(maxColumns,columns+8);lines=wrap(content,columns);}
    if(lines.length*15+10>height-8)lines=wrap(String(content||'').replace(/\s+/g,' '),maxColumns);
    const naturalWidth=Math.max(...lines.map(textWidth),1)+14,naturalHeight=lines.length*15+10;
    const scale=Math.max(.001,Math.min(1,(width-8)/naturalWidth,(height-8)/naturalHeight));
    const boxWidth=naturalWidth*scale,boxHeight=naturalHeight*scale;
    result.push({kind:'text',lines,x:clamp(anchor[0],4,Math.max(4,width-boxWidth-4)),y:clamp(anchor[1],4,Math.max(4,height-boxHeight-4)),boxWidth,boxHeight,color:mark.color,fontSize:11*scale,padding:7*scale,baseline:16*scale,lineHeight:15*scale});
  };
  if(mark.type==='coverage'){
    const a=pos(mark.start),b=pos(mark.end),top=Math.min(a[1],b[1]),bottom=Math.max(a[1],b[1]);
    if(mark.style==='wavy'){
      const points=[];for(let y=top;y<=bottom;y+=2)points.push([a[0]+Math.sin((y-top)*Math.PI/6)*3,y]);
      points.push([a[0],bottom]);path(points);
    }else path([[a[0],top],[a[0],bottom]]);
    path([[a[0]-4,top],[a[0]+4,top]]);path([[a[0]-4,bottom],[a[0]+4,bottom]]);
    text([shotLabel,movement,mark.note].filter(Boolean).join('\n'),mark.labelAt?pos(mark.labelAt):[a[0]+7,top]);
    result[result.length-1].handle='label';
  }else if(mark.type==='pen'||mark.type==='highlighter')path(mark.points.map(pos),mark.type==='highlighter'?.28:1);
  else if(mark.type==='arrow'){
    const a=pos(mark.start),b=pos(mark.end),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
    path([a,b]);path([[b[0]-10*Math.cos(angle-.45),b[1]-10*Math.sin(angle-.45)],b,[b[0]-10*Math.cos(angle+.45),b[1]-10*Math.sin(angle+.45)]]);
  }else text(mark.text,pos(mark.start));
  return result;
}
function paint(context,primitives){
  for(const item of primitives){
    context.save();
    if(item.kind==='path'){
      context.globalAlpha=item.alpha;context.strokeStyle=item.color;context.lineWidth=item.width;
      context.lineCap='round';context.lineJoin='round';context.beginPath();
      item.points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.stroke();
    }else{
      context.fillStyle='rgba(255,255,255,.94)';context.fillRect(item.x,item.y,item.boxWidth,item.boxHeight);
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
  let library;
  const loaded=new Map();
  const p=()=>c.project(),lining=()=>p()._linedScript,doc=()=>lining()?.documents.find(d=>d.sha256===lining().activePdf),mark=()=>doc()?.marks.find(m=>m.id===selectedId);
  const shot=(sid=shotId)=>p()._shots.find(s=>s.id===sid);
  const label=(s,project=p())=>{const scene=project.breakdowns.find(b=>b.id===s?.sceneId);return s?`${scene?.scene||'?'}${s.number}${s.camera?' · Camera '+s.camera:''}`:'Unlinked shot';};
  function sync(){
    if(production!==p().id){production=p().id;page=0;selectedId=undefined;shotId='';}
    if(sha!==doc()?.sha256){sha=doc()?.sha256;page=0;selectedId=undefined;gesture=null;}
    if(!shot())shotId=p()._shots.find(s=>s.sceneId===c.selectedScene())?.id||p()._shots[0]?.id||'';
    if(!mark())selectedId=undefined;
  }
  const options=(value)=>p()._shots.map(s=>`<option value="${esc(s.id)}" ${s.id===value?'selected':''}>${esc(label(s)+' · '+s.description)}</option>`).join('');
  function render(){sync();return `<section class="panel lined-desk"><div class="lined-top"><div><h2>Lined script <span class="lined-beta">BETA</span></h2><p>Original PDF pages · shot-linked coverage · local annotations</p></div><div class="lined-file-actions"><button id="lined-attach">${doc()?'Add PDF revision':'Attach original PDF'}</button><input id="lined-file" type="file" accept="application/pdf,.pdf" hidden><button id="lined-export" class="primary" ${doc()?'':'disabled'}>Export lined PDF</button></div></div>${doc()?`<div class="lined-document"><label>PDF revision<select id="lined-document">${lining().documents.map(d=>`<option value="${d.sha256}" ${d.sha256===sha?'selected':''}>${esc(d.filename)}</option>`).join('')}</select></label><div class="lined-pagination"><button id="lined-prev" aria-label="Previous PDF page">‹</button><span id="lined-pages">Loading PDF…</span><button id="lined-next" aria-label="Next PDF page">›</button><label>Zoom<select id="lined-zoom">${[.5,.75,1,1.25,1.5,2].map(z=>`<option value="${z}" ${z===zoom?'selected':''}>${Math.round(z*100)}%</option>`).join('')}</select></label></div></div><div class="lined-toolbar" role="toolbar" aria-label="Script annotation tools">${[['select','↖ Select'],['coverage','│ Coverage'],['pen','✎ Pen'],['highlighter','▰ Highlight'],['arrow','↗ Arrow'],['text','T Note']].map(([key,name])=>`<button data-lined-tool="${key}" aria-pressed="${key===tool}">${name}</button>`).join('')}<label>Color<input id="lined-color" type="color" value="${color}"></label><label>Width<select id="lined-width">${[1,2,3,5,10,14,24].map(w=>`<option ${width===w?'selected':''}>${w}</option>`).join('')}</select></label></div><div class="lined-workspace"><div class="lined-scroll" id="lined-scroll"><div id="lined-stage" aria-label="Original script PDF"><p class="lined-loading">Opening original PDF…</p></div></div><aside id="lined-inspector" class="lined-inspector"></aside></div>`:`<div class="lined-empty"><div class="lined-empty-icon">▧</div><h3>Line the original pages.</h3><p>Attach your screenplay PDF to draw coverage lines, link shots, and write camera directions.</p><p>New PDF script imports keep their original pages automatically. For an older production, attach its original PDF here.</p><button id="lined-empty-attach" class="primary">Choose original PDF</button><p class="tiny">PDFs stay on this computer and travel with full Production Desk backups.</p></div>`}<p id="lined-status" class="lined-status" role="status"></p></section>`;}
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
  async function renderPage(){
    gesture=null;const generation=++epoch,current=doc(),stage=$('#lined-stage');if(!current||!stage)return;
    try{
      const {pdf:file}=await load(current.sha256);if(generation!==epoch||!stage.isConnected)return;
      page=clamp(page,0,file.numPages-1);const original=await file.getPage(page+1);
      if(generation!==epoch||!stage.isConnected)return;
      viewport=original.getViewport({scale:1});
      stage.innerHTML='<div class="lined-page"><canvas id="lined-canvas"></canvas><svg id="lined-overlay" role="img" aria-label="Script annotations"></svg></div>';
      const canvas=$('#lined-canvas'),overlay=$('#lined-overlay'),factor=Math.min(window.devicePixelRatio||1,2)*zoom,view=original.getViewport({scale:factor});
      canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
      const container=$('.lined-page');container.style.width=viewport.width*zoom+'px';container.style.height=viewport.height*zoom+'px';
      overlay.setAttribute('viewBox',`0 0 ${viewport.width} ${viewport.height}`);
      $('#lined-pages').textContent=`Page ${page+1} of ${file.numPages}`;$('#lined-prev').disabled=page===0;$('#lined-next').disabled=page===file.numPages-1;
      drawOverlay();bindPointers(overlay);renderInspector();
      await original.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
      if(generation===epoch)setStatus('Marks save automatically. Full backups include every attached PDF revision.');
    }catch(error){if(generation===epoch){setStatus(error.name==='PasswordException'?'Use an unencrypted PDF for lining.':error.message,true);stage.innerHTML='<p class="lined-loading">The PDF could not be opened. Choose Attach original PDF to retry.</p>';}}
  }
  function primitives(m){const s=shot(m.shotId);return markPrimitives(m,viewport.width,viewport.height,label(s),m.type==='coverage'?s?.movement:'');}
  function svgNode(tag,attrs={},text){const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;}
  function drawOverlay(preview){
    const overlay=$('#lined-overlay');if(!overlay||!viewport)return;overlay.replaceChildren();
    let marks=doc()?.marks.filter(m=>m.page===page)||[];
    if(preview)marks=marks.some(m=>m.id===preview.id)?marks.map(m=>m.id===preview.id?preview:m):[...marks,preview];
    for(const m of marks){
      const group=svgNode('g',{'data-lined-mark':m.id,class:m.id===selectedId?'lined-selected':''});
      for(const item of primitives(m)){
        if(item.kind==='path'){
          const points=item.points.map(p=>p.join(',')).join(' ');
          group.append(svgNode('polyline',{points,fill:'none',stroke:'transparent','stroke-width':Math.max(12,item.width),class:'lined-hit'}));
          group.append(svgNode('polyline',{points,fill:'none',stroke:item.color,'stroke-width':item.width,opacity:item.alpha,'stroke-linecap':'round','stroke-linejoin':'round'}));
        }else{
          group.append(svgNode('rect',{x:item.x,y:item.y,width:item.boxWidth,height:item.boxHeight,fill:'white','fill-opacity':'.94',stroke:item.color,'stroke-width':'.6',rx:2,...(item.handle?{'data-lined-handle':item.handle}:{})}));
          item.lines.forEach((line,i)=>group.append(svgNode('text',{x:item.x+item.padding,y:item.y+item.baseline+i*item.lineHeight,fill:item.color,'font-size':item.fontSize,'font-family':'Arial, sans-serif',...(item.handle?{'data-lined-handle':item.handle}:{})},line)));
        }
      }
      if(m.id===selectedId&&['coverage','arrow'].includes(m.type))for(const key of ['start','end'])group.append(svgNode('circle',{cx:m[key][0]*viewport.width,cy:m[key][1]*viewport.height,r:5,fill:'white',stroke:m.color,'stroke-width':1.5,'data-lined-handle':key}));
      overlay.append(group);
    }
  }
  function renderInspector(){
    const target=$('#lined-inspector');if(!target)return;
    const selected=mark(),linked=selected?.type==='coverage'?shot(selected.shotId):shot();
    target.innerHTML=`<div class="eyebrow">${selected?'SELECTED ANNOTATION':'SHOT COVERAGE'}</div><h3>${selected?({coverage:'Coverage line',pen:'Pen drawing',highlighter:'Highlight',arrow:'Arrow',text:'Script note'})[selected.type]:'Link a camera setup'}</h3><label class="field">Linked shot<select id="lined-shot"><option value="">Choose a shot</option>${options(linked?.id)}</select></label><button id="lined-new-shot">＋ New linked shot</button><label class="field">Camera movement<input id="lined-movement" value="${esc(linked?.movement||'')}" maxlength="500" ${linked?'':'disabled'} placeholder="e.g. Push in on the last line"></label>${!selected||selected.type==='coverage'?`<label class="field">Coverage style<select id="lined-style"><option value="solid" ${(selected?.style||style)==='solid'?'selected':''}>Straight · on camera</option><option value="wavy" ${(selected?.style||style)==='wavy'?'selected':''}>Wavy · off camera</option></select></label>`:''}${selected?`<label class="field">${selected.type==='text'?'Note text':'Timing / margin note'}<textarea id="lined-note" rows="4" maxlength="2000">${esc(selected.type==='text'?selected.text:selected.note||'')}</textarea></label><button id="lined-delete" class="danger">Delete annotation</button>`:''}<div class="lined-help"><strong>How to mark the page</strong><p>Choose a shot, then drag a coverage line over the passage it covers. Add another line for the same shot on the next page.</p><p>Use Select to move marks or drag a line’s end handles. Drag its label into a margin to keep the script clear. Notes and camera movements print with the lines. Pen, highlight, arrow, and text tools work anywhere on the page.</p><p>Each attached PDF revision keeps its own annotations. Revision transfer is manual in this beta.</p></div>`;
    $('#lined-shot').onchange=e=>{shotId=e.target.value;if(selected?.type==='coverage'&&shotId)c.mutate(()=>selected.shotId=shotId,false);drawOverlay();renderInspector();};
    $('#lined-new-shot').onclick=newShot;
    bindEdit($('#lined-movement'),value=>linked&&linked.movement!==value, value=>{linked.movement=value;});
    if($('#lined-style'))$('#lined-style').onchange=e=>{style=e.target.value;if(selected?.type==='coverage')c.mutate(()=>selected.style=style,false);drawOverlay();};
    if(selected){bindEdit($('#lined-note'),value=>selected[selected.type==='text'?'text':'note']!==value,value=>selected[selected.type==='text'?'text':'note']=value);$('#lined-delete').onclick=deleteMark;}
  }
  function bindEdit(input,changed,write){let editing=false;input.oninput=()=>{if(changed(input.value)){c.edit(()=>write(input.value),!editing);editing=true;drawOverlay();}};input.onblur=()=>editing=false;}
  function deleteMark(){if(!mark())return;c.mutate(()=>{doc().marks=doc().marks.filter(m=>m.id!==selectedId);selectedId=undefined;},false);drawOverlay();renderInspector();}
  function newShot(){
    const scenes=p().breakdowns.filter(b=>b.type==='scene');if(!scenes.length){c.toast('Add or import a scene before creating a linked shot.');return;}
    const sceneId=shot()?.sceneId||scenes.find(b=>b.id===c.selectedScene())?.id||scenes[0].id;
    c.modal('New linked shot',`<label class="field">Scene<select id="lined-new-scene">${scenes.map(b=>`<option value="${esc(b.id)}" ${b.id===sceneId?'selected':''}>Scene ${esc(b.scene)}</option>`).join('')}</select></label><label class="field">Shot number / suffix<input id="lined-new-number" maxlength="24" required placeholder="e.g. A"></label><label class="field">Description<input id="lined-new-description" required placeholder="e.g. Wide master"></label><label class="field">Camera movement<input id="lined-new-movement" maxlength="500" placeholder="e.g. Slow push in"></label>`,'<button id="modal-cancel">Cancel</button><button id="lined-create-shot" class="primary">Create linked shot</button>');
    const next=()=>{const used=new Set(p()._shots.filter(s=>s.sceneId===$('#lined-new-scene').value).map(s=>s.number.trim().toUpperCase()));let i=1;while(used.has('L'+i))i++;$('#lined-new-number').value='L'+i;};next();$('#lined-new-scene').onchange=next;
    $('#lined-create-shot').onclick=()=>{
      const sceneId=$('#lined-new-scene').value,number=$('#lined-new-number').value.trim(),description=$('#lined-new-description').value.trim(),movement=$('#lined-new-movement').value;
      if(!number||!description){$('#modal-error').textContent='Enter a shot number and description.';return;}
      if(p()._shots.some(s=>s.sceneId===sceneId&&s.number.trim().toUpperCase()===number.toUpperCase())){$('#modal-error').textContent='This scene already has that shot number.';return;}
      const value={id:id(),created:stamp(),sceneId,number,description,movement,size:'Wide',camera:'A',lens:'',equipment:'',notes:'',circleTake:'',priority:'Essential',status:'Planned',setupMinutes:10,shootMinutes:15,actualMinutes:null,takes:0};
      c.mutate(()=>{p()._shots.push(value);shotId=value.id;},false);$('#modal').close();renderInspector();drawOverlay();
    };
  }
  function point(event,overlay){const rect=overlay.getBoundingClientRect();return [clamp((event.clientX-rect.left)/rect.width),clamp((event.clientY-rect.top)/rect.height)];}
  function bindPointers(overlay){
    overlay.dataset.tool=tool;
    overlay.onpointerdown=event=>{
      if(event.button!==0||busy)return;event.preventDefault();const start=point(event,overlay),hit=event.target.closest('[data-lined-mark]');
      if(tool==='select'){
        selectedId=hit?.dataset.linedMark;const selected=mark();if(!selected){drawOverlay();renderInspector();return;}
        shotId=selected.shotId||shotId;gesture={kind:'move',original:copy(selected),start,handle:event.target.dataset.linedHandle};
      }else if(tool==='text'){
        c.modal('Script note','<label class="field">Camera direction or note<textarea id="lined-text" rows="4" maxlength="2000" placeholder="e.g. Pan to Maya on the door slam"></textarea></label>','<button id="modal-cancel">Cancel</button><button id="lined-text-save" class="primary">Place note</button>');
        $('#lined-text-save').onclick=()=>{const text=$('#lined-text').value.trim();if(!text)return;const value={id:id(),type:'text',page,start,color,width,text};c.mutate(()=>doc().marks.push(value),false);selectedId=value.id;$('#modal').close();drawOverlay();renderInspector();};return;
      }else{
        if(tool==='coverage'&&!shot()){c.toast('Choose or create a linked shot first.');return;}
        const value={id:id(),type:tool,page,start,color,width};
        if(tool==='coverage')Object.assign(value,{end:[...start],shotId,style,note:''});
        if(tool==='arrow')value.end=[...start];
        if(tool==='pen'||tool==='highlighter')value.points=[[...start]];
        gesture={kind:'create',original:value,start};selectedId=value.id;
      }
      gesture.project=p().id;gesture.pdf=doc().sha256;gesture.preview=copy(gesture.original);
      overlay.setPointerCapture(event.pointerId);drawOverlay(gesture.preview);renderInspector();
    };
    overlay.onpointermove=event=>{
      if(!gesture)return;const next=point(event,overlay),value=copy(gesture.original);
      if(gesture.kind==='move'){
        if(gesture.handle==='label'){
          const anchor=primitives(gesture.original).find(item=>item.kind==='text');
          value.labelAt=[clamp(anchor.x/viewport.width+next[0]-gesture.start[0]),clamp(anchor.y/viewport.height+next[1]-gesture.start[1])];
        }else if(gesture.handle){value[gesture.handle]=next;if(value.type==='coverage'){value.start[0]=value.end[0]=next[0];}}
        else{
          const all=[value.start,...(value.end?[value.end]:[]),...(value.points||[]),...(value.labelAt?[value.labelAt]:[])];
          const dx=clamp(next[0]-gesture.start[0],-Math.min(...all.map(a=>a[0])),1-Math.max(...all.map(a=>a[0]))),dy=clamp(next[1]-gesture.start[1],-Math.min(...all.map(a=>a[1])),1-Math.max(...all.map(a=>a[1])));
          const move=a=>[a[0]+dx,a[1]+dy];value.start=move(value.start);if(value.end)value.end=move(value.end);if(value.points)value.points=value.points.map(move);if(value.labelAt)value.labelAt=move(value.labelAt);
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
      if(current.kind==='create'&&((value.points&&value.points.length<2)||(value.end&&Math.hypot(value.end[0]-value.start[0],value.end[1]-value.start[1])<.003))){selectedId=undefined;drawOverlay();return;}
      if(JSON.stringify(value)!==JSON.stringify(current.original)||current.kind==='create')c.mutate(()=>{if(current.kind==='create')doc().marks.push(value);else doc().marks=doc().marks.map(m=>m.id===value.id?value:m);},false);
      selectedId=value.id;drawOverlay();renderInspector();
    };
      overlay.onpointercancel=()=>{gesture=null;drawOverlay();renderInspector();};
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
      for(let index=0;index<file.numPages;index++){
        const marks=current.marks.filter(m=>m.page===index);if(!marks.length)continue;
        const source=await file.getPage(index+1),view=source.getViewport({scale:1});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width*2);canvas.height=Math.ceil(view.height*2);
        const context=canvas.getContext('2d');context.scale(2,2);
        for(const m of marks){const s=project._shots.find(s=>s.id===m.shotId);paint(context,markPrimitives(m,view.width,view.height,label(s,project),m.type==='coverage'?s?.movement:''));}
        const image=await output.embedPng(canvas.toDataURL('image/png'));
        const bottomLeft=view.convertToPdfPoint(0,view.height),bottomRight=view.convertToPdfPoint(view.width,view.height),topLeft=view.convertToPdfPoint(0,0);
        output.getPage(index).drawImage(image,{x:bottomLeft[0],y:bottomLeft[1],width:Math.hypot(bottomRight[0]-bottomLeft[0],bottomRight[1]-bottomLeft[1]),height:Math.hypot(topLeft[0]-bottomLeft[0],topLeft[1]-bottomLeft[1]),rotate:degrees(source.rotate)});
      }
      if(current.marks.some(m=>m.page>=file.numPages))throw Error('An annotation refers to a page outside this PDF.');
      const raw=await output.save();let binary='';for(let i=0;i<raw.length;i+=8192)binary+=String.fromCharCode(...raw.subarray(i,i+8192));
      const filename=((project.project||project.name).replace(/[^\w -]/g,'').trim()||'production').slice(0,120)+'-lined-script.pdf';
      if(await c.download(filename,btoa(binary),'application/pdf','base64')===false)throw Error('The export could not be written. Please retry.');
      setStatus('Lined PDF exported. The original PDF and editable annotations are preserved.');
    }catch(error){setStatus('PDF export failed: '+error.message,true);}finally{busy=false;}
  }
  function bind(){
    gesture=null;$('#lined-attach').onclick=()=>$('#lined-file').click();$('#lined-empty-attach')?.addEventListener('click',()=>$('#lined-file').click());$('#lined-file').onchange=e=>attach(e.target.files[0]);$('#lined-export').onclick=exportPDF;
    if(!doc())return;
    $('#lined-document').onchange=e=>{c.mutate(()=>lining().activePdf=e.target.value);};
    $('#lined-prev').onclick=()=>{page--;selectedId=undefined;renderPage();};$('#lined-next').onclick=()=>{page++;selectedId=undefined;renderPage();};$('#lined-zoom').onchange=e=>{zoom=Number(e.target.value);renderPage();};
    document.querySelectorAll('[data-lined-tool]').forEach(button=>button.onclick=()=>{tool=button.dataset.linedTool;document.querySelectorAll('[data-lined-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(tool==='highlighter'){color='#FFD54F';width=14;}else if(width===14)width=2;$('#lined-color').value=color;$('#lined-width').value=width;if($('#lined-overlay'))$('#lined-overlay').dataset.tool=tool;});
    $('#lined-color').onchange=e=>{color=e.target.value;if(mark())c.mutate(()=>mark().color=color,false);drawOverlay();};$('#lined-width').onchange=e=>{width=Number(e.target.value);if(mark())c.mutate(()=>mark().width=width,false);drawOverlay();};
    renderInspector();renderPage();
  }
  document.addEventListener('keydown',event=>{if(c.isActive()&&!$('#modal').open&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)&&['Delete','Backspace'].includes(event.key)&&mark()){event.preventDefault();deleteMark();}});
  return {render,bind,exportPDF,newShot};
}
