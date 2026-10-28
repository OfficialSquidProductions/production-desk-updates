const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=()=>import('../web/navigation-order.js');
const expected=['workspace','lined','shots','schedule','reports','elements'];
test('all six tabs have the requested default and corrupt preferences cannot hide or duplicate tabs',async()=>{
  const {navigationOrder,DEFAULT_NAVIGATION_ORDER}=await load();
  assert.deepEqual(DEFAULT_NAVIGATION_ORDER,expected);
  for(const value of [undefined,null,{},[],expected.slice(1),[...expected,'lined'],Array(6).fill('lined'),['toString',...expected.slice(1)],expected.map(id=>[id]),[true,...expected.slice(1)]])assert.deepEqual(navigationOrder(value),expected);
  const custom=[...expected].reverse(),normalized=navigationOrder(custom);assert.deepEqual(normalized,custom);normalized.reverse();assert.deepEqual(custom,[...expected].reverse());
});
test('repeated moves preserve each tab once, do not mutate saved input and stop at either boundary',async()=>{
  const {moveNavigationTab}=await load(),original=Object.freeze([...expected]);
  let order=moveNavigationTab(original,'elements',-1);
  assert.deepEqual(order,['workspace','lined','shots','schedule','elements','reports']);
  for(let i=0;i<12;i++)order=moveNavigationTab(order,'elements',-1);
  assert.equal(order[0],'elements');assert.deepEqual([...order].sort(),[...expected].sort());assert.deepEqual(original,expected);
  for(let i=0;i<12;i++)order=moveNavigationTab(order,'elements',1);
  assert.equal(order.at(-1),'elements');assert.deepEqual([...order].sort(),[...expected].sort());
  assert.deepEqual(moveNavigationTab(order,'unknown',1),order);assert.deepEqual(moveNavigationTab(order,'lined',-2),order);
});
test('Mac and mobile ship the same navigation/preferences implementation and initial default HTML order',async()=>{
  const root=path.resolve(__dirname,'..'),mobile=path.resolve(root,'../ios/ProductionDesk/Web');
  for(const name of ['navigation-order.js','settings.js'])assert.equal(fs.readFileSync(path.join(root,'web',name),'utf8'),fs.readFileSync(path.join(mobile,name),'utf8'));
  for(const folder of [path.join(root,'web'),mobile]){
    const html=fs.readFileSync(path.join(folder,'index.html'),'utf8').match(/<nav id="navigation"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.deepEqual([...html.matchAll(/data-view="([^"]+)"/g)].map(match=>match[1]),expected);
  }
});
