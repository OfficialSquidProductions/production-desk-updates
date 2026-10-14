const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function harness(failStorage = false) {
  const handlers = {}, calls = [];
  const window = {location:{href:'http://127.0.0.1:8765/'}, addEventListener:(name, fn)=>handlers[name]=fn};
  const context = vm.createContext({window, URL, ErrorEvent:class {}, document:{querySelector:()=>({textContent:'PRODUCTION DESK / 1.5.1'}),addEventListener:()=>{}},
    fetch:async (url, options)=>{calls.push({url,body:JSON.parse(options.body)});if(failStorage)throw Error('offline');return {ok:true,json:async()=>({report:JSON.parse(options.body).report})};}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/support.js'),'utf8'), context);
  return {handlers, calls, context};
}
const settle = () => new Promise(resolve=>setImmediate(resolve));
test('uncaught script errors persist a bounded diagnostic without URL queries or production state', async()=>{
  const h=harness();
  h.context.trigger=h.handlers.error;
  vm.runInContext('const event=new ErrorEvent();event.message="x".repeat(900);event.filename="http://127.0.0.1:8765/app.js?private=value";event.lineno=24;trigger(event);',h.context);
  await settle();
  const report=h.calls[0].body.report;
  assert.equal(report.kind,'script');assert.equal(report.message.length,500);assert.equal(report.location,'app.js:24');
  assert.equal(report.version,'1.5.1');assert.equal(h.calls[0].url,'/api/support');
  assert.equal(JSON.stringify(report).includes('private=value'),false);
});
test('unhandled rejected errors are retained and storage failures do not create a rejection loop',async()=>{
  const h=harness(true);h.context.trigger=h.handlers.unhandledrejection;
  vm.runInContext('trigger({reason:new Error("Synthetic rejection")})',h.context);
  await settle();
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].body.report.kind,'promise');assert.equal(h.calls[0].body.report.message,'Synthetic rejection');
  vm.runInContext('trigger({reason:{production:"private"}})',h.context);
  await settle();assert.equal(h.calls.length,2);assert.equal(h.calls[1].body.report.message,'An asynchronous operation failed unexpectedly.');
});
test('long Unicode crash messages do not end in a broken surrogate', async()=>{
  const h=harness();h.context.trigger=h.handlers.error;
  vm.runInContext('const e=new ErrorEvent();e.message="x"+"😀".repeat(400);trigger(e);',h.context);
  await settle();
  const message=h.calls[0].body.report.message;
  assert.ok(!/[\uD800-\uDBFF]$/.test(message),'Truncation left a lone high surrogate');
  assert.ok(Array.from(message).length<=500);
});
