// Export-only geometry. Original PDF bytes and editable mark coordinates remain
// untouched; only output pages containing off-page ink acquire larger bounds.
function verticalSegments(points,low,high){
  const output=[];let chain;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dy=b[1]-a[1];let from=0,to=1;
    if(dy===0){if(a[1]<low||a[1]>high){chain=undefined;continue;}}
    else{const first=(low-a[1])/dy,last=(high-a[1])/dy;from=Math.max(0,Math.min(first,last));to=Math.min(1,Math.max(first,last));if(from>to){chain=undefined;continue;}}
    const point=t=>[a[0]+(b[0]-a[0])*t,a[1]+dy*t],start=point(from),end=point(to);
    if(chain&&Math.abs(chain.at(-1)[0]-start[0])<1e-6&&Math.abs(chain.at(-1)[1]-start[1])<1e-6)chain.push(end);
    else{chain=[start,end];output.push(chain);}
    if(to<1)chain=undefined;
  }
  return output;
}
export function primitivesForPage(primitives,layout,index){
  const sheet=layout.pages[index],height=sheet.view.height,output=[];
  for(const item of primitives){
    if(item.sourcePage!=null&&item.sourcePage!==index)continue;
    if(item.kind==='text'){
      if(item.sourcePage==null&&!(item.y>=sheet.top&&(item.y<sheet.top+height||index===layout.pages.length-1&&item.y===sheet.top+height)))continue;
      output.push({...item,x:item.x-sheet.left,y:item.y-sheet.top});
    }else{
      const local=item.points.map(([x,y])=>[x-sheet.left,y-sheet.top]);
      for(const points of verticalSegments(local,0,height))output.push({...item,points});
    }
  }
  return output;
}
export function annotationBounds(primitives,width,height){
  let left=0,top=0,right=width,bottom=height;
  for(const item of primitives){
    if(item.kind==='text'){left=Math.min(left,item.x-4);top=Math.min(top,item.y-4);right=Math.max(right,item.x+item.boxWidth+4);bottom=Math.max(bottom,item.y+item.boxHeight+4);}
    else{const pad=item.width/2+1;for(const [x,y] of item.points){left=Math.min(left,x-pad);right=Math.max(right,x+pad);/* Page-spanning strokes stop at paper edges. */}}
  }
  return {left,top,right,bottom,width:right-left,height:bottom-top};
}
export function expandPageBounds(page,context,view,bounds){
  if(bounds.left===0&&bounds.top===0&&bounds.right===view.width&&bounds.bottom===view.height)return false;
  const points=[[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.left,bounds.bottom],[bounds.right,bounds.bottom]].map(p=>view.convertToPdfPoint(...p));
  const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1])),right=Math.max(...points.map(p=>p[0])),top=Math.max(...points.map(p=>p[1]));
  const crop=page.getCropBox(),media=page.getMediaBox();
  // Keep originally cropped script content cropped when revealing new margins.
  // Existing content/annotations/resources stay in their original PDF objects.
  page.node.normalize();
  const begin=context.register(context.flateStream(`q\n${crop.x} ${crop.y} ${crop.width} ${crop.height} re W n\n`)),end=context.register(context.flateStream('Q\n'));
  page.node.wrapContentStreams(begin,end);
  const union=box=>{const left=Math.min(box.x,x),bottom=Math.min(box.y,y);return [left,bottom,Math.max(box.x+box.width,right)-left,Math.max(box.y+box.height,top)-bottom];};
  page.setMediaBox(...union(media));page.setCropBox(...union(crop));return true;
}
