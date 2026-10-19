const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const moduleSource = fs.readFileSync(path.join(__dirname,'../web/mac-store-exports.js'),'utf8');
const load = () => import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
test('other platforms and non-download replies retain their existing path',async()=>{
  const {resolveMacStoreExport: resolve}=await load();
  const reply={url:'/api/download/'+'a'.repeat(32)};
  assert.equal(await resolve(reply,{}),reply);
  const workspace={projects:[]};assert.equal(await resolve(workspace,{productionDeskMacStore:true}),workspace);
  const native={native:true};assert.equal(await resolve(native,{productionDeskMacStore:true}),native);
});
test('Store exports wait for native save/cancel and propagate failures',async()=>{
  const {resolveMacStoreExport:resolve}=await load();let seen;
  const reply={url:'/api/download/'+'a'.repeat(32)};
  const win={productionDeskMacStore:true,webkit:{messageHandlers:{storeExport:{postMessage:async p=>{seen=p;return {native:true,cancelled:false};}}}}};
  assert.deepEqual(await resolve(reply,win),{native:true,cancelled:false});assert.equal(seen,reply.url);
  win.webkit.messageHandlers.storeExport.postMessage=async()=>({native:true,cancelled:true});
  assert.equal((await resolve(reply,win)).cancelled,true);
  win.webkit.messageHandlers.storeExport.postMessage=async()=>{throw Error('Disk full');};
  await assert.rejects(resolve(reply,win),/Disk full/);
  win.webkit.messageHandlers.storeExport.postMessage=async()=>({});
  await assert.rejects(resolve(reply,win),/invalid result/);
  await assert.rejects(resolve(reply,{productionDeskMacStore:true}),/unavailable/);
});
test('real API/export helper suppresses anchor and success toast on native cancel, and reports write errors',async()=>{
  const {resolveMacStoreExport}=await load();
  const source=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
  const api=source.slice(source.indexOf('async function api('),source.indexOf('\nfunction toast('));
  const download=source.slice(source.indexOf('async function download('),source.indexOf('\nfunction exportModal('));
  assert.ok(download.includes('async function download') && download.length<2000);
  const messages=[],created=[];let result={native:true,cancelled:true};
  const window={productionDeskMacStore:true,webkit:{messageHandlers:{storeExport:{postMessage:async()=>{if(result instanceof Error)throw result;return result;}}}}};
  const context=vm.createContext({window,isIPadApp:false,resolveMacStoreExport:(r)=>resolveMacStoreExport(r,window),
    fetch:async()=>({ok:true,json:async()=>({url:'/api/download/'+'a'.repeat(32)})}),File:class {},
    document:{createElement:()=>{created.push(true);return {};},body:{}},toast:m=>messages.push(m)});
  vm.runInContext(api+'\n'+download,context);
  assert.equal(await vm.runInContext("download('demo.csv','x')",context),null);assert.equal(messages.length,0);assert.equal(created.length,0);
  result={native:true,cancelled:false};assert.equal(await vm.runInContext("download('demo.csv','x')",context),true);
  assert.equal(messages.pop(),'Export saved.');assert.equal(created.length,0);
  result=Error('Disk full');assert.equal(await vm.runInContext("download('demo.csv','x')",context),false);
  assert.match(messages.pop(),/Disk full/);
});
