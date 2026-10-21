// Local, read-only original pages. PDF.js supplies both the bitmap and aligned
// text layer; screenplay layout is never inferred from extracted dialogue.
export function createScriptPDF(c) {
  let library, cached, state, zoom='fit';
  const positions=new Map();
  const document=()=>c.project()?._linedScript?.documents.find(d=>d.sha256===c.project()._linedScript.activePdf);
  const key=()=>[c.project().id,document()?.sha256,c.scene()?.id].join(':');
  const esc=c.esc;
  function stop() {
    if(!state)return;
    if(state.scroll.isConnected)positions.set(state.key,{top:state.scroll.scrollTop,left:state.scroll.scrollLeft,scale:state.scale});
    state.closed=true;state.observer?.disconnect();state.resize?.disconnect();cancelAnimationFrame(state.resizeFrame);
    for(const item of state.pages){item.task?.cancel();item.layer?.cancel();}
    state=undefined;
  }
  function render() {
    const d=document();
    return `<div class="script-pdf-toolbar"><span>Original PDF</span><button id="script-pdf-prev" aria-label="Previous PDF page">‹</button><label>Page <input id="script-pdf-page" type="number" min="1" value="1" aria-label="PDF page"></label><span id="script-pdf-count"></span><button id="script-pdf-next" aria-label="Next PDF page">›</button><label>Zoom <select id="script-pdf-zoom" aria-label="Script PDF zoom">${[['fit','Fit width'],['1','100%'],['1.25','125%'],['1.5','150%']].map(([value,label])=>`<option value="${value}" ${zoom===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="script-scroll script-pdf-scroll"><article id="script-text" class="script-pdf-pages" aria-label="Original screenplay PDF" data-pdf="${esc(d.sha256)}"></article></div><p id="script-pdf-status" class="script-pdf-status" role="status">Opening original PDF…</p>`;
  }
  async function load(digest) {
    library ||= import('./vendor/pdfjs/legacy/build/pdf.min.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/legacy/build/pdf.worker.min.mjs';return lib;});
    if(cached?.digest===digest)return cached.promise;
    const previous=cached;
    const promise=(async()=>{
      const lib=await library;let bytes;
      if(window.webkit?.messageHandlers?.scheduler){
        const encoded=await window.webkit.messageHandlers.scheduler.postMessage({operation:'readPDF',sha256:digest});
        bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      }else{
        const response=await fetch('/api/pdf/'+digest);
        if(!response.ok)throw Error('The original PDF is missing.');
        bytes=new Uint8Array(await response.arrayBuffer());
      }
      const pdf=await lib.getDocument({data:bytes,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/',isEvalSupported:false,useWasm:false}).promise;
      return {lib,pdf};
    })();
    cached={digest,promise};
    previous?.promise.then(({pdf})=>pdf.destroy()).catch(()=>{});
    try{return await promise;}catch(error){if(cached?.promise===promise)cached=undefined;throw error;}
  }
  const current=s=>!s.closed&&s.root.isConnected;
  function pageIndex(s) {
    let index=0;
    for(let i=0;i<s.pages.length;i++){if(s.pages[i].node.offsetTop>s.scroll.scrollTop+40)break;index=i;}
    return index;
  }
  function status(s) {
    if(!current(s)||!s.pages.length)return;
    const index=pageIndex(s),page=s.pages[index];
    s.pageInput.value=index+1;
    s.prev.disabled=index===0;s.next.disabled=index===s.pages.length-1;
    s.status.textContent=page.hasText===false
      ? `Page ${index+1} has no selectable text. Read the original image and type elements in the breakdown sheet, or use a searchable PDF. No OCR is performed.`
      : s.textReady ? 'Select original PDF text to tag the current scene. Scrolling pages keeps your chosen scene.' : 'Loading selectable text from the original PDF…';
  }
  async function paint(s,item) {
    if(!current(s)||!item.visible)return;
    const scale=s.scale*Math.min(devicePixelRatio||1,2);
    if(item.drawnScale===scale||item.painting)return;
    item.painting=true;
    const viewport=item.source.getViewport({scale});
    item.canvas.width=Math.ceil(viewport.width);item.canvas.height=Math.ceil(viewport.height);
    const task=item.source.render({canvasContext:item.canvas.getContext('2d'),viewport});item.task=task;
    try{await task.promise;item.drawnScale=scale;item.canvas.dataset.ready='true';}
    catch(error){if(current(s)&&error.name!=='RenderingCancelledException')s.status.textContent='This PDF page could not render. '+error.message;}
    finally{
      item.painting=false;if(item.task===task)item.task=undefined;
      if(!current(s)||!item.visible){item.canvas.width=item.canvas.height=1;item.drawnScale=undefined;}
      else if(scale!==s.scale*Math.min(devicePixelRatio||1,2))paint(s,item);
    }
  }
  function layout(s) {
    if(!current(s)||!s.pages.length||s.scroll.clientWidth<20)return;
    const width=Math.max(100,s.scroll.clientWidth-24),maxWidth=Math.max(...s.pages.map(p=>p.view.width));
    const scale=zoom==='fit'?Math.max(.15,Math.min(1.5,width/maxWidth)):Number(zoom);
    if(Math.abs(scale-s.scale)<.001)return;
    const ratio=s.scale?scale/s.scale:1,top=s.scroll.scrollTop*ratio,left=s.scroll.scrollLeft*ratio;
    s.scale=scale;
    for(const item of s.pages){
      item.node.style.width=item.view.width*scale+'px';item.node.style.height=item.view.height*scale+'px';
      item.text.style.setProperty('--total-scale-factor',scale);
      item.layer?.update({viewport:item.source.getViewport({scale})});
      item.task?.cancel();item.drawnScale=undefined;
      if(item.visible)paint(s,item);
    }
    s.scroll.scrollTop=top;s.scroll.scrollLeft=left;
  }
  function go(s,index) {
    if(!current(s)||!s.pages.length)return;
    index=Math.max(0,Math.min(s.pages.length-1,index));
    s.scroll.scrollTop=s.pages[index].node.offsetTop;status(s);
  }
  async function bind() {
    const root=window.document.querySelector('#script-text.script-pdf-pages');if(!root)return;
    const $=selector=>window.document.querySelector(selector);
    const s={root,scroll:root.parentElement,key:key(),pages:[],closed:false,scale:0,status:$('#script-pdf-status'),pageInput:$('#script-pdf-page'),prev:$('#script-pdf-prev'),next:$('#script-pdf-next')};state=s;
    s.prev.onclick=()=>go(s,pageIndex(s)-1);s.next.onclick=()=>go(s,pageIndex(s)+1);
    s.pageInput.onchange=()=>{const value=Number(s.pageInput.value);if(Number.isInteger(value))go(s,value-1);};
    $('#script-pdf-zoom').onchange=e=>{zoom=e.target.value;layout(s);};
    s.scroll.addEventListener('scroll',()=>{status(s);positions.set(s.key,{top:s.scroll.scrollTop,left:s.scroll.scrollLeft,scale:s.scale});},{passive:true});
    try {
      const {lib,pdf}=await load(document().sha256);if(!current(s))return;
      // Page dimensions are cheap; retain text DOM for cross-page selections,
      // but allocate bitmaps only near the viewport, including on long scripts.
      for(let i=1;i<=pdf.numPages;i++){
        const source=await pdf.getPage(i);if(!current(s))return;
        const view=source.getViewport({scale:1}),node=window.document.createElement('div');node.className='script-pdf-page';node.dataset.page=i;
        node.setAttribute('aria-label','Original PDF page '+i);
        const canvas=window.document.createElement('canvas');canvas.width=canvas.height=1;canvas.setAttribute('aria-hidden','true');
        const text=window.document.createElement('div');text.className='script-pdf-text';node.append(canvas,text);s.root.append(node);
        s.pages.push({source,view,node,canvas,text,visible:false});
      }
      $('#script-pdf-count').textContent='of '+pdf.numPages;s.pageInput.max=pdf.numPages;
      layout(s);
      s.observer=new IntersectionObserver(entries=>{for(const entry of entries){
        const item=s.pages[Number(entry.target.dataset.page)-1];item.visible=entry.isIntersecting;
        if(item.visible)paint(s,item);else if(!item.painting){item.canvas.width=item.canvas.height=1;item.drawnScale=undefined;}
      }},{root:s.scroll,rootMargin:'700px'});
      for(const item of s.pages)s.observer.observe(item.node);
      // Layout changes can resize this observer's target (e.g. scrollbars on
      // native Windows). Apply them next frame, outside observer delivery.
      s.resize=new ResizeObserver(()=>{
        cancelAnimationFrame(s.resizeFrame);
        s.resizeFrame=requestAnimationFrame(()=>layout(s));
      });s.resize.observe(s.scroll);
      const saved=positions.get(s.key),scenePage=Number.parseInt(c.scene()?.scriptPage,10);
      if(saved){s.scroll.scrollTop=saved.top*(saved.scale?s.scale/saved.scale:1);s.scroll.scrollLeft=saved.left;}
      else go(s,Number.isFinite(scenePage)?scenePage-1:0);
      const target=pageIndex(s);
      // Prioritize the selected scene, then fill the remaining text layers.
      const order=[target,...s.pages.map((_,i)=>i).filter(i=>i!==target)];
      for(const i of order){
        const item=s.pages[i];if(!current(s))return;
        // Safari supports stream readers but not ReadableStream async iteration.
        // TextLayer consumes the stream via getReader(), unlike getTextContent().
        item.layer=new lib.TextLayer({textContentSource:item.source.streamTextContent(),container:item.text,viewport:item.source.getViewport({scale:s.scale||1})});
        await item.layer.render();if(!current(s))return;
        item.hasText=item.layer.textContentItemsStr.some(text=>text.trim());
        item.node.dataset.textReady='true';status(s);
      }
      s.textReady=true;s.root.dataset.ready='true';status(s);
    } catch(error) {
      if(!current(s))return;
      s.root.dataset.error=error.message;
      s.observer?.disconnect();s.resize?.disconnect();
      const message=error.name==='PasswordException'?'This PDF requires a password. Use an unencrypted copy.':'The original PDF could not be opened.';
      s.status.textContent=message+' Showing extracted scene text instead; original page layout is unavailable. Attach the original in Lined Script to restore it.';
      s.root.innerHTML='<div class="script-page script-pdf-fallback">'+c.fallback()+'</div>';
      s.root.dataset.fallback='true';
    }
  }
  return {document,render,bind,stop};
}
