// Plan a single reversible move without touching scenes, shots, or other scenarios.
export function planStripMove(scenario,bid,{zone,index=0,position}={}){
  if(!scenario?.boards?.length||scenario.boards.flatMap(b=>b.breakdownIds.flat()).filter(id=>id===bid).length!==1)return null;
  const boards=scenario.boards.map(b=>structuredClone(b.breakdownIds));let target;
  if(zone==='day')target=boards[0][index];
  else if(zone==='board'&&index>0&&boards[index]){boards[index]=boards[index].flat();target=boards[index];}
  else if(zone==='main')target=boards[0];
  if(!Array.isArray(target))return null;
  let at=position===undefined?target.length:position;if(!Number.isInteger(at)||at<0||at>target.length)return null;
  const old=target.indexOf(bid);if(old>=0&&old<at)at--;
  // Resolve target first: removing a standalone banner can shift a day's outer index.
  for(const groups of boards)for(let i=groups.length-1;i>=0;i--){const group=groups[i];if(Array.isArray(group)){for(let n=group.length-1;n>=0;n--)if(group[n]===bid)group.splice(n,1);}else if(group===bid)groups.splice(i,1);}
  target.splice(at,0,bid);
  return JSON.stringify(boards)===JSON.stringify(scenario.boards.map(b=>b.breakdownIds))?null:boards;
}

export function createStripDrag(c){
  let session,root,lastPoint,frame,suppressed;
  const marker=document.createElement('div');marker.className='strip-drop-marker';marker.hidden=true;marker.innerHTML='<span></span>';document.body.append(marker);
  const status=document.createElement('div');status.id='strip-drag-status';status.className='strip-drag-status';status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');document.body.append(status);
  const layout=()=>JSON.stringify(c.scenario().boards.map(b=>b.breakdownIds));
  const valid=()=>session&&c.project()===session.project&&c.scenario()===session.scenario&&layout()===session.layout;
  const clearTarget=()=>{root?.querySelectorAll('.strip-drop-target').forEach(node=>node.classList.remove('strip-drop-target'));marker.hidden=true;};
  function stop(){
    if(session){suppressed={id:session.bid,until:performance.now()+400};session.source.classList.remove('strip-dragging');}
    session=null;lastPoint=null;cancelAnimationFrame(frame);frame=undefined;clearTarget();status.hidden=true;document.body.classList.remove('strip-drag-active');
  }
  function consumeClick(bid,event){return event.detail!==0&&suppressed?.id===bid&&performance.now()<suppressed.until;}
  function destination(target,y){
    if(!target?.closest||!root?.contains(target))return null;
    const strip=target.closest('[data-strip]');
    if(strip){const bounds=strip.getBoundingClientRect(),after=y>=bounds.top+bounds.height/2;return {zone:strip.dataset.origin,index:Number(strip.dataset.index),position:Number(strip.dataset.position??strip.dataset.index)+(after?1:0),anchor:strip,after,container:strip.closest('[data-zone]')};}
    const heading=target.closest('[data-holding-index]');
    if(heading){const container=heading.nextElementSibling;return {zone:'board',index:Number(heading.dataset.holdingIndex),position:0,anchor:container,after:false,container};}
    const edge=target.closest('.day-header,.day-total');
    if(edge){const container=edge.closest('.day-block').querySelector('[data-zone="day"]'),end=edge.classList.contains('day-total');return {zone:'day',index:Number(container.dataset.index),position:end?container.querySelectorAll(':scope > [data-strip]').length:0,anchor:container,after:end,container};}
    const container=target.closest('[data-zone]');if(!container)return null;
    const children=[...container.children].filter(node=>node.matches('[data-strip],.day-block'));
    const next=children.find(node=>y<node.getBoundingClientRect().top+node.getBoundingClientRect().height/2);
    const anchor=next||children.at(-1)||container;
    return {zone:container.dataset.zone,index:Number(container.dataset.index),position:next?children.indexOf(next):children.length,anchor,after:!next,container};
  }
  function describe(d){
    const scenario=c.scenario(),groups=d.zone==='day'?scenario.boards[0].breakdownIds[d.index]:d.zone==='board'?scenario.boards[d.index].breakdownIds.flat():scenario.boards[0].breakdownIds;
    const place=d.zone==='day'?'Day '+scenario.boards[0].breakdownIds.slice(0,d.index+1).filter(Array.isArray).length:d.zone==='board'?(d.index===1?'Unscheduled':scenario.boards[d.index].name):'Between shooting days';
    const next=groups[d.position];
    const where=Array.isArray(next)?'before day '+scenario.boards[0].breakdownIds.slice(0,d.position+1).filter(Array.isArray).length:next?'before '+c.label(next):'at the end';
    return place+' · '+where;
  }
  function feedback(target,x,y){
    clearTarget();if(!valid()){stop();return;}
    const d=destination(target,y);session.destination=d;
    if(!d){status.textContent='Moving '+c.label(session.bid)+' · Move over a board or day · Esc cancels';return;}
    const plan=planStripMove(session.scenario,session.bid,d);session.plan=plan;
    if(!plan){status.textContent='Moving '+c.label(session.bid)+' · Current position · Esc cancels';return;}
    const rect=d.anchor.getBoundingClientRect(),clip=d.anchor.closest('.board-scroll')?.getBoundingClientRect();
    const top=Math.max(rect.top,clip?.top??0,4),bottom=Math.min(rect.bottom,clip?.bottom??innerHeight,innerHeight-4);
    const line=d.after?bottom:top;
    if(line>=0&&line<=innerHeight&&bottom>=top){marker.style.left=Math.max(4,rect.left)+'px';marker.style.top=line+'px';marker.style.width=Math.max(0,Math.min(rect.right,innerWidth-4)-Math.max(4,rect.left))+'px';marker.firstElementChild.textContent=describe(d);marker.hidden=false;}
    d.container?.classList.add('strip-drop-target');
    status.textContent='Moving '+c.label(session.bid)+' → '+describe(d)+' · Drop to place · Esc cancels';
  }
  function autoScroll(){
    if(!session||!lastPoint)return;
    if(!valid()){stop();return;}
    const {x,y}=lastPoint,target=document.elementFromPoint(x,y),pane=target?.closest('.board-scroll');
    if(pane&&root.contains(pane)){
      const r=pane.getBoundingClientRect(),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom),speed=y<top+48?-Math.min(22,(top+48-y)/2):y>bottom-48?Math.min(22,(y-bottom+48)/2):0;
      if(speed){const before=pane.scrollTop;pane.scrollTop+=speed;if(before!==pane.scrollTop)feedback(document.elementFromPoint(x,y),x,y);}
    }
    frame=requestAnimationFrame(autoScroll);
  }
  function bind(node){
    root=node;
    root.ondragstart=event=>{
      const strip=event.target.closest('[data-strip]');if(!strip)return;
      if(document.querySelector('dialog[open]')||!event.dataTransfer||event.target.closest('input,textarea,select,a,[data-color-strip]')||event.target.closest('button:not([data-move-strip])')){event.preventDefault();return;}
      const bid=strip.dataset.strip;if(!c.project().breakdowns.some(b=>b.id===bid)){event.preventDefault();return;}
      stop();session={bid,source:strip,project:c.project(),scenario:c.scenario(),layout:layout()};
      event.dataTransfer.setData('text/plain',bid);event.dataTransfer.effectAllowed='move';
      try{const r=strip.getBoundingClientRect();event.dataTransfer.setDragImage(strip,Math.max(0,event.clientX-r.left),Math.max(0,event.clientY-r.top));}catch{}
      strip.classList.add('strip-dragging');document.body.classList.add('strip-drag-active');status.hidden=false;status.textContent='Moving '+c.label(bid)+' · Choose a placement · Esc cancels';
      lastPoint={x:event.clientX,y:event.clientY};frame=requestAnimationFrame(autoScroll);
    };
    const over=event=>{if(!session)return;if(!valid()){stop();return;}event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='move';lastPoint={x:event.clientX,y:event.clientY};feedback(event.target,event.clientX,event.clientY);};
    root.ondragenter=over;root.ondragover=over;
    root.ondrop=event=>{
      if(!session)return;event.preventDefault();event.stopPropagation();
      if(!valid()){stop();return;}
      const d=destination(event.target,event.clientY),plan=d&&planStripMove(session.scenario,session.bid,d),bid=session.bid;
      stop();if(plan)c.commit(bid,plan);
    };
    root.ondragleave=event=>{if(!session)return;const r=root.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>Math.min(r.bottom,innerHeight)){clearTarget();session.destination=null;session.plan=null;}};
    root.ondragend=stop;
  }
  document.addEventListener('dragend',stop);
  document.addEventListener('drop',()=>{if(session)stop();});
  document.addEventListener('keydown',event=>{if(session&&event.key==='Escape'){event.preventDefault();stop();}},true);
  return {bind,stop,consumeClick};
}
