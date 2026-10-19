const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const roots=["../web", "../../ios/ProductionDesk/Web"];
function run(source,{hint,platform='MacIntel',agent='Desktop browser',width=1440,metadata}={}){
  const nodes=[{},{}],root={dataset:{}},versionLabel={};
  const window={SquidPlatform:hint,SquidBuild:metadata,innerWidth:width};
  const document={readyState:'complete',documentElement:root,querySelector:()=>versionLabel,querySelectorAll:selector=>{assert.equal(selector,'[data-platform-label]');return nodes;}};
  vm.runInNewContext(source,{window,document,navigator:{platform,userAgent:agent},Set});
  return {nodes,root,versionLabel};
}
for(const relative of roots){
 const root=path.resolve(__dirname,relative),source=fs.readFileSync(path.join(root,'platform-branding.js'),'utf8');
 test(relative+': native device labels survive narrow and wide layouts',()=>{
  for(const hint of ['iOS','iPad','MacBook','Desktop'])for(const width of [320,1024,1920]){
   const {nodes,root}=run(source,{hint,width});assert.equal(root.dataset.brandPlatform,hint);assert.ok(nodes.every(n=>n.textContent===hint));
  }
 });
 test(relative+': browser fallback uses OS identity, never viewport size',()=>{
  for(const width of [320,1920]){
   assert.equal(run(source,{platform:'Win32',width}).nodes[0].textContent,'Desktop');
   assert.equal(run(source,{platform:'MacIntel',width}).nodes[0].textContent,'MacBook');
   assert.equal(run(source,{platform:'iPhone',agent:'iPhone',width}).nodes[0].textContent,'iOS');
   assert.equal(run(source,{platform:'iPad',agent:'iPad',width}).nodes[0].textContent,'iPad');
  }
 });
 test(relative+': packaged HTML includes branding assets and preserves app name',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes('platform-branding.js')&&html.includes('platform-branding.css')&&html.includes('data-platform-label'));
  assert.match(html,/PRODUCTION(?:<br>|\s)+DESK/);
  if(html.includes('SCENIC'))assert.ok(html.includes('platform-brand-compact'),'Phone needs an always visible app/platform brand');
 });
}
test('iPhone/iPad host identity is supplied from UIKit, not layout width',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,"../../ios/ProductionDesk/DeskViewController.swift"),'utf8');
 assert.ok(source.includes('UIDevice.current.userInterfaceIdiom == .pad'));
 assert.ok(source.includes('window.SquidPlatform='));assert.ok(source.includes('"iPad"')&&source.includes('"iOS"'));
});

test('displayed version comes from host build metadata',()=>{for(const relative of roots){const source=fs.readFileSync(path.resolve(__dirname,relative,'platform-branding.js'),'utf8');assert.equal(run(source,{metadata:{version:'1.5.5',build:'25'}}).versionLabel.textContent,'PRODUCTION DESK / 1.5.5 (25)');assert.equal(run(source,{metadata:{version:'1.5.5'}}).versionLabel.textContent,'PRODUCTION DESK / 1.5.5');}});

test('Windows preload exposes native platform and application version without new renderer privileges',()=>{
 const exposed={};const source=fs.readFileSync(path.resolve(__dirname,'../desktop/windows/preload.cjs'),'utf8');
 vm.runInNewContext(source,{process:{platform:'win32',argv:['--squid-version=1.5.5']},require:()=>({contextBridge:{exposeInMainWorld:(name,value)=>exposed[name]=value},ipcRenderer:{invoke:()=>{}}})});
 assert.equal(exposed.SquidPlatform,'Desktop');assert.equal(exposed.SquidBuild.version,'1.5.5');
});
