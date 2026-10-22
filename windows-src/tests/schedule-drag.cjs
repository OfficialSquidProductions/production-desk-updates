const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const moduleURL='data:text/javascript,'+encodeURIComponent(fs.readFileSync(path.join(__dirname,'../web/strip-drag.js'),'utf8'));
const fixture=()=>({id:'scenario',boards:[{id:'main',breakdownIds:['banner',['a','b','c'],['d'],[]]},{id:'unscheduled',breakdownIds:['e','f']},{id:'holding',breakdownIds:[['g']]}]});
test('whole-row before/after positions move adjacent and distant strips without mutating the original',async()=>{
  const {planStripMove}=await import(moduleURL),s=fixture(),before=structuredClone(s);
  assert.deepEqual(planStripMove(s,'a',{zone:'day',index:1,position:2})[0][1],['b','a','c']);
  assert.deepEqual(planStripMove(s,'c',{zone:'day',index:1,position:0})[0][1],['c','a','b']);
  assert.deepEqual(planStripMove(s,'a',{zone:'day',index:1})[0][1],['b','c','a']);assert.deepEqual(s,before);
});
test('standalone banners can move into a day whose index shifts when the source is removed',async()=>{
  const {planStripMove}=await import(moduleURL);assert.deepEqual(planStripMove(fixture(),'banner',{zone:'day',index:1,position:1})[0],[['a','banner','b','c'],['d'],[]]);
});
test('day, unscheduled, holding and empty-day transfers preserve every strip exactly once',async()=>{
  const {planStripMove}=await import(moduleURL);let s=fixture();const expected=s.boards.flatMap(b=>b.breakdownIds.flat()).sort();
  for(const [bid,destination] of [['b',{zone:'day',index:3}],['e',{zone:'day',index:2,position:0}],['c',{zone:'board',index:2}],['banner',{zone:'board',index:1,position:0}],['g',{zone:'main',position:1}]]){
    const plan=planStripMove(s,bid,destination);assert.ok(plan);assert.deepEqual(plan.flat(2).sort(),expected);s={...s,boards:s.boards.map((b,i)=>({...b,breakdownIds:plan[i]}))};
  }
});
test('self and adjacent-boundary drops are no-ops rather than undoable mutations',async()=>{
  const {planStripMove}=await import(moduleURL),s=fixture();for(const position of [0,1])assert.equal(planStripMove(s,'a',{zone:'day',index:1,position}),null);assert.equal(planStripMove(s,'f',{zone:'board',index:1}),null);
});
test('invalid destinations, duplicate sources and unknown/external IDs cannot remove a strip',async()=>{
  const {planStripMove}=await import(moduleURL),s=fixture(),before=structuredClone(s);
  for(const d of [{zone:'day',index:99},{zone:'day',index:0},{zone:'board',index:0},{zone:'board',index:99},{zone:'other'},{zone:'day',index:1,position:-1},{zone:'day',index:1,position:99},{zone:'day',index:1,position:NaN}])assert.equal(planStripMove(s,'a',d),null);
  assert.equal(planStripMove(s,'unknown',{zone:'day',index:1}),null);s.boards[1].breakdownIds.push('a');assert.equal(planStripMove(s,'a',{zone:'day',index:1}),null);s.boards[1].breakdownIds.pop();assert.deepEqual(s,before);
});
