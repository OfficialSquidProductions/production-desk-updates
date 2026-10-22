const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url='data:text/javascript,'+encodeURIComponent(fs.readFileSync(path.join(__dirname,'../web/lined-export.js'),'utf8'));
const layout={pages:[{left:0,top:0,view:{width:600,height:800}},{left:50,top:800,view:{width:500,height:700}}]};
test('continuous paths are split at paper edges while a gutter box stays whole on its owning page',async()=>{
 const {primitivesForPage,annotationBounds}=await import(url);
 const values=[{kind:'path',points:[[300,200],[700,1200]],width:2,sourcePage:null},{kind:'text',x:650,y:780,boxWidth:160,boxHeight:70,sourcePage:null}];
 const first=primitivesForPage(values,layout,0),second=primitivesForPage(values,layout,1);
 assert.equal(first.filter(v=>v.kind==='text').length,1);assert.equal(second.filter(v=>v.kind==='text').length,0);assert.equal(first[0].points.at(-1)[1],800);assert.equal(second[0].points[0][1],0);
 const bounds=annotationBounds(first,600,800);assert.equal(bounds.right,814);assert.equal(bounds.bottom,854);
});
test('normal pages keep original bounds; left/right gutters and stroke width are included',async()=>{
 const {annotationBounds}=await import(url);
 assert.deepEqual(annotationBounds([{kind:'text',x:10,y:10,boxWidth:100,boxHeight:40}],600,800),{left:0,top:0,right:600,bottom:800,width:600,height:800});
 const bounds=annotationBounds([{kind:'text',x:-180,y:30,boxWidth:160,boxHeight:60},{kind:'text',x:640,y:50,boxWidth:170,boxHeight:60},{kind:'path',points:[[-190,20],[300,100]],width:4}],600,800);
 assert.equal(bounds.left,-193);assert.equal(bounds.right,814);assert.equal(bounds.width,1007);
});
test('page-local marks never leak to another page and narrow page offsets stay aligned',async()=>{
 const {primitivesForPage}=await import(url);
 const values=[{kind:'text',x:-40,y:850,boxWidth:80,boxHeight:30,sourcePage:1},{kind:'path',points:[[100,810],[100,900]],width:2,sourcePage:1}];
 assert.deepEqual(primitivesForPage(values,layout,0),[]);const second=primitivesForPage(values,layout,1);assert.equal(second[0].x,-90);assert.equal(second[0].y,50);assert.deepEqual(second[1].points,[[50,10],[50,100]]);
});
test('rotated/cropped PDF pages expand in PDF coordinates and original streams stay clipped',async()=>{
 const {expandPageBounds}=await import(url);let normalized=0,wrapped=0,media,crop;const streams=[];
 const page={getCropBox:()=>({x:36,y:48,width:540,height:700}),getMediaBox:()=>({x:0,y:0,width:612,height:792}),node:{normalize:()=>normalized++,wrapContentStreams:()=>wrapped++},setMediaBox:(...v)=>media=v,setCropBox:(...v)=>crop=v};
 const context={flateStream:s=>{streams.push(s);return s;},register:s=>s},view={width:700,height:540,convertToPdfPoint:(x,y)=>[y+36,x+48]};
 assert.equal(expandPageBounds(page,context,view,{left:0,top:0,right:700,bottom:540}),false);assert.equal(normalized,0);
 assert.equal(expandPageBounds(page,context,view,{left:-175,top:0,right:700,bottom:540}),true);assert.equal(normalized,1);assert.equal(wrapped,1);assert.deepEqual(media,[0,-127,612,919]);assert.deepEqual(crop,[36,-127,540,875]);assert.ok(streams[0].includes('36 48 540 700 re W n'));
});
