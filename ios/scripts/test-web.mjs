// Dependency-free data/bridge regression suite. Browser DOMParser/FDX and UIKit
// presentation are deliberately exercised by the simulator suite, not emulated.
import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import { emptyProject, parseHeading, parseScript, importScript, importBackup, validateUSS, validateWorkspace } from '../ProductionDesk/Web/film-native.js';
import { nativeAPI, nativePrint } from '../ProductionDesk/Web/native-platform.js';
import { createShotDesk, formatShotDuration } from '../ProductionDesk/Web/shots.js';
import { validStripColor, stripTextColor } from '../ProductionDesk/Web/strip-colors.js';

const script = 'Title: Test Production\n\nINT. KITCHEN - DAY #12A#\n\nMAYA (V.O.)\nThe kettle whistles.\n\nEXT. STREET - NIGHT #13#\n\nMAYA\nWe are late.\n\nJON\nTake the car.';
const project = () => importScript(script, 'Test_Production.fountain');
const workspace = p => ({version:1,activeProject:p.id,projects:[p]});
const backup = p => JSON.stringify(workspace(p));
const shot = (p, overrides={}) => ({id:crypto.randomUUID(),created:p.created,sceneId:p.breakdowns[0].id,number:'A',description:'Wide master',size:'Wide',movement:'Static',camera:'A',lens:'35',equipment:'Tripod',setupMinutes:10,shootMinutes:15,actualMinutes:null,takes:0,circleTake:'',priority:'Essential',notes:'',status:'Planned',...overrides});
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function bridge(handler) {
  const calls=[];
  globalThis.window={webkit:{messageHandlers:{scheduler:{postMessage:async message=>{calls.push(message);return handler?.(message);}}}}};
  return calls;
}
function desk(p) {
  p._shots ??= []; p._shotSettings ??= {startTime:'07:00'};
  let current=p, downloaded, printed=0;
  const nodes=new Map();
  for(const selector of ['#shot-day','#shot-scene','#shot-status','#shot-search','#shot-start','#shot-metrics','#shot-list','#shot-count','#shot-detail-label','#shot-editor','#print-area'])nodes.set(selector,{});
  globalThis.document={querySelector:selector=>nodes.get(selector)??null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},append(){},contains(){return false;},focus(){},getBoundingClientRect(){return {width:100,height:40};}}),body:{append(){}},addEventListener(){},dispatchEvent(){}};
  globalThis.window={print:()=>printed++,addEventListener(){}};
  const controller=createShotDesk({esc,id:()=>crypto.randomUUID(),stamp:()=>new Date().toISOString(),project:()=>current,selectedScene:()=>current.breakdowns[0]?.id,slug:b=>b?.scene ? `Scene ${b.scene}` : '',groups:()=>current.stripboards[0].boards[0].breakdownIds,dates:count=>Array.from({length:count},(_,i)=>`2026-10-${12+i}`),dateLabel:d=>d,scenarioSelect:()=>'',scenarioName:()=>current.stripboards[0].name,download:(filename,content,mime)=>downloaded={filename,content,mime},mutate:fn=>fn(),edit:fn=>fn(),render:()=>controller.render()});
  return {controller,nodes,setProject:value=>current=value,downloaded:()=>downloaded,printed:()=>printed};
}

test('new productions have independent IDs, original brand provenance and valid USS structure', () => {
  const a=emptyProject('The Story'),b=emptyProject('The Story');
  assert.equal(validateUSS(a),a);
  assert.notEqual(a.id,b.id);
  assert.equal(a.source,'Production Desk — Local Film Scheduler');
  assert.equal(a.ussVersion,'1.0.0');
  assert.deepEqual(a.calendars[0].daysOff,[0,6]);
  assert.deepEqual(a.stripboards[0].boards.map(b=>b.breakdownIds),[[],[]]);
});
test('scene headings preserve explicit Fountain numbers, mixed interiors and set numbers', () => {
  assert.deepEqual(parseHeading('INT. KITCHEN - DAY #12A#'),['12A','INT','KITCHEN','Day']);
  assert.deepEqual(parseHeading('23 EXT./INT. CAR – NIGHT 23'),['23','I/E','CAR','Night']);
  assert.deepEqual(parseHeading('EXT. STAGE 5'),[undefined,'EXT','STAGE 5','Day']);
  assert.equal(parseHeading('The kettle whistles.'),null);
});
test('script import preserves source text, scene numbering and character deduplication', () => {
  const p=project();validateUSS(p);
  assert.equal(p.project,'Test Production');
  assert.equal(p._scriptFilename,'Test_Production.fountain');
  assert.deepEqual(p.breakdowns.map(b=>b.scene),['12A','13']);
  assert.match(p.breakdowns[0]._scriptText,/MAYA \(V\.O\.\)/);
  const cast=p.elements.filter(e=>e.category===p.categories.find(c=>c.ucid===100).id);
  assert.deepEqual(cast.map(e=>e.name),['MAYA','JON']);
  assert.equal(p.breakdowns[0].elements.filter(id=>id===cast[0].id).length,1);
  assert.deepEqual(p.stripboards[0].boards[1].breakdownIds,p.breakdowns.map(b=>b.id));
  assert.ok(p.breakdowns.every(b=>b._needsReview&&b.pages>=0.125&&Number.isInteger(b.pages*8)));
});
test('plain text parsing skips page furniture and records form-feed script pages', () => {
  const scenes=parseScript('INT. ROOM - DAY\n1.\nCONTINUED:\nMAYA\nHi\n\fEXT. ROAD - NIGHT\nJON\nBye');
  assert.deepEqual(scenes.map(s=>s.startPage),['1','2']);
  assert.deepEqual(scenes[0].cast,['MAYA']);
  assert.ok(!scenes[0].lines.includes('CONTINUED:'));
});
test('script import explains missing headings and rejects XML entity declarations before DOM parsing', () => {
  assert.throws(()=>importScript('No scene heading','notes.txt'),/No scene headings/);
  assert.throws(()=>parseScript('<!DOCTYPE script [<!ENTITY x SYSTEM "file:///private/data">]>',true),/XML entities/);
});
test('full workspace round trips scene text, shots, strip colors, schedules and custom provenance', () => {
  const p=project();p.source='Original studio';p._shots=[shot(p)];p._shotSettings={startTime:'23:45'};
  p.breakdowns[0]._stripColor='#7953AD';p.breakdowns[0].comments='Keep the original note';
  p.stripboards[0].boards[0].breakdownIds=[[p.breakdowns[0].id]];
  p.stripboards[0].boards[1].breakdownIds=[p.breakdowns[1].id];
  const alternate=structuredClone(p.stripboards[0]);alternate.id=crypto.randomUUID();alternate.name='Alternate';alternate.boards.forEach(b=>b.id=crypto.randomUUID());p.stripboards.push(alternate);
  const result=importBackup(backup(p));
  assert.deepEqual(result.workspace,workspace(p));
  assert.equal(result.workspace.projects[0].source,'Original studio');
});
test('minimal USS interchange gains a local schedule while preserving original IDs and source', () => {
  const p=project();delete p.stripboards;delete p.calendars;p.source='Upstream USS exporter';
  const result=importBackup(JSON.stringify({universalScheduleStandard:p})).project;
  assert.equal(result.id,p.id);assert.equal(result.source,'Upstream USS exporter');
  assert.deepEqual(result.stripboards[0].boards[1].breakdownIds,p.breakdowns.map(b=>b.id));
  validateUSS(result);
});
test('workspace rejects empty, duplicate and incorrectly active project collections', () => {
  const p=project();
  assert.throws(()=>validateWorkspace({projects:[]}),/Invalid workspace/);
  assert.throws(()=>validateWorkspace({version:1,projects:[p,p],activeProject:p.id}),/duplicate project IDs/);
  assert.throws(()=>validateWorkspace({version:1,projects:[p],activeProject:'missing'}),/active project/);
});
test('USS rejects unsupported versions, duplicate IDs and broken cross references', () => {
  const cases=[
    [p=>p.ussVersion='9.0',/supports USS/],
    [p=>p.categories[0].id=p.id,/Duplicate USS id/],
    [p=>p.elements[0].category='missing',/invalid category/],
    [p=>p.breakdowns[0].elements.push('missing'),/unknown element/],
    [p=>p.stripboards[0].calendar='missing',/unknown calendar/],
    [p=>p.stripboards[0].boards[1].breakdownIds.push('missing'),/unknown breakdown/],
    [p=>p.stripboards[0].boards[1].breakdownIds.push(p.breakdowns[0].id),/every breakdown exactly once/],
    [p=>p.stripboards[0].boards[1].breakdownIds.pop(),/every breakdown exactly once/],
    [p=>p.breakdowns[0].pages=-1,/nonnegative/],
    [p=>p.breakdowns[0].duration=Infinity,/nonnegative/],
    [p=>p.breakdowns[0]._stripColor='red;position:fixed',/six-digit hex/]
  ];
  for(const [mutate,error] of cases){const p=project();mutate(p);assert.throws(()=>validateUSS(p),error);}
});
test('calendar validation rejects impossible dates, duplicates and invalid weekday values', () => {
  const cases=[
    [p=>p.calendars[0].events[0].date='2026-02-30',/Invalid event date/],
    [p=>p.calendars[0].events[0].type='unknown',/Unknown calendar event/],
    [p=>p.calendars[0].daysOff=[6,6],/distinct weekdays/],
    [p=>p.calendars[0].daysOff=[7],/distinct weekdays/],
    [p=>p.calendars[0].events.push({...p.calendars[0].events[0]}),/Duplicate USS id/]
  ];
  for(const [mutate,error] of cases){const p=project();mutate(p);assert.throws(()=>validateUSS(p),error);}
});
test('USS preserves compatibility with optional calendar fields and a single shooting board', () => {
  const p=project();delete p.calendars[0].events;delete p.calendars[0].daysOff;
  p.stripboards[0].boards=[{...p.stripboards[0].boards[0],breakdownIds:[p.breakdowns.map(b=>b.id)]}];
  const imported=importBackup(JSON.stringify({universalScheduleStandard:p})).project;
  assert.equal(imported.calendars[0].events,undefined);
  assert.deepEqual(imported.stripboards[0].boards[0].breakdownIds,[p.breakdowns.map(b=>b.id)]);
  assert.equal(validateUSS(imported),imported);
  // app.normalize supplies optional calendar arrays and a holding board before
  // rendering. That DOM path is covered by RuntimeWorkflowTests in WebKit.
});
test('malformed linked-element collections are rejected before partial element deletion', () => {
  for(const malformed of [{},'not-an-array',[1],[null]]) {
    const p=project();p.elements[0].linkedElements=malformed;
    assert.throws(()=>importBackup(backup(p)),/linkedElements|linked elements/i);
  }
  const p=project();p.elements[0].linkedElements=[p.elements[1].id];
  assert.deepEqual(importBackup(backup(p)).workspace.projects[0].elements[0].linkedElements,[p.elements[1].id]);
});
test('shot validation prevents orphan references, duplicate numbers, invalid states and out-of-range timing', () => {
  const cases=[
    [p=>p._shots[0].sceneId='missing',/unknown scene/],
    [p=>p._shots.push(shot(p,{number:' a '})),/Duplicate shot number/],
    [p=>p._shots[0].number='',/Shot number/],
    [p=>p._shots[0].status='Unknown',/Unknown shot status/],
    [p=>p._shots[0].priority='Critical',/Unknown shot priority/],
    [p=>p._shots[0].setupMinutes=1.5,/whole number/],
    [p=>p._shots[0].shootMinutes=1441,/whole number/],
    [p=>p._shots[0].actualMinutes=10081,/whole number/],
    [p=>p._shots[0].takes=10001,/whole number/],
    [p=>p._shotSettings={startTime:'24:00'},/HH:MM/]
  ];
  for(const [mutate,error] of cases){const p=project();p._shots=[shot(p)];mutate(p);assert.throws(()=>validateUSS(p),error);}
  const p=project();p._shots=[shot(p,{actualMinutes:null,takes:10000})];validateUSS(p);
});
test('malformed local scene text cannot crash script navigation after backup import', () => {
  const p=project();p.breakdowns[0]._scriptText={unsafe:'text'};
  assert.throws(()=>importBackup(backup(p)),/script|text/i);
});
test('workspace imports without a scenario are repaired or rejected before UI use', () => {
  const p=project();p.stripboards=[];p.calendars=[];
  try {const imported=importBackup(backup(p)).workspace.projects[0];assert.ok(imported.stripboards.length>0,'Workspace needs a usable scenario');}
  catch(error){if(error instanceof assert.AssertionError)throw error;assert.match(error.message,/schedule|scenario|stripboard|calendar/i);}
});
test('native new/load/save use only local messages and validate both directions', async () => {
  const p=project(),value=workspace(p),calls=bridge(message=>message.operation==='load'?structuredClone(value):true);
  assert.deepEqual(await nativeAPI('/api/workspace'),value);
  assert.equal(await nativeAPI('/api/workspace',value),true);
  assert.deepEqual(calls.map(c=>c.operation),['load','save']);
  assert.equal((await nativeAPI('/api/new',{title:'Local production'})).project,'Local production');
  await assert.rejects(()=>nativeAPI('/api/workspace',{projects:[]}),/Invalid workspace/);
  assert.equal(calls.length,2,'Invalid workspace must never be sent to disk');
  bridge(()=>({projects:[]}));await assert.rejects(()=>nativeAPI('/api/workspace'),/Invalid workspace/);
});
test('native first launch seeds and saves a valid workspace only after a confirmed empty load', async () => {
  const calls=bridge(message=>message.operation==='load'?null:true);
  const value=await nativeAPI('/api/workspace');validateWorkspace(value);
  assert.deepEqual(calls.map(c=>c.operation),['load','save']);
  assert.deepEqual(calls[1].workspace,value);
  assert.equal(value.projects[0].source,'Production Desk — Local Film Scheduler');
});
test('native corrupt or failed loads are never overwritten with a blank project', async () => {
  let calls=bridge(()=>({version:1,projects:[]}));
  await assert.rejects(()=>nativeAPI('/api/workspace'),/Invalid workspace/);
  assert.deepEqual(calls.map(c=>c.operation),['load']);
  calls=bridge(()=>{throw Error('Workspace file unreadable');});
  await assert.rejects(()=>nativeAPI('/api/workspace'),/Workspace file unreadable/);
  assert.deepEqual(calls.map(c=>c.operation),['load']);
  bridge(message=>{if(message.operation==='load')return null;throw Error('Disk full');});
  await assert.rejects(()=>nativeAPI('/api/workspace'),/Disk full/);
});
test('native script file import strips BOM, accepts encoded names and preserves Unicode', async () => {
  const calls=bridge();
  const result=await nativeAPI('/api/import',new File(['\uFEFFINT. CAFÉ - DAY\nMAYA\nBonjour.'],'Film.fountain'),{'X-Filename':encodeURIComponent('folder/Café_Story.fountain')});
  assert.equal(result.project.project,'Café Story');
  assert.equal(result.project._scriptFilename,'Café_Story.fountain');
  assert.match(result.project.breakdowns[0]._scriptText,/CAFÉ/);
  assert.equal(calls.length,0,'Text parsing stays inside the local webview');
});
test('native backup import preserves workspace and rejects malformed or unrelated JSON', async () => {
  bridge();const p=project();
  assert.deepEqual((await nativeAPI('/api/import',backup(p),{'X-Filename':'backup.json'})).workspace,workspace(p));
  await assert.rejects(()=>nativeAPI('/api/import','{invalid',{'X-Filename':'backup.json'}),/corrupt|valid Production Desk JSON/);
  await assert.rejects(()=>nativeAPI('/api/import','{"hello":"world"}',{'X-Filename':'backup.json'}),/USS file|workspace backup/);
});
test('native import rejects oversize files before reading or invoking PDFKit', async () => {
  const calls=bridge(),file=new File(['%PDF'],'large.pdf');
  Object.defineProperty(file,'size',{value:40*1024*1024+1});
  file.arrayBuffer=()=>assert.fail('Oversized bytes must never be read');
  await assert.rejects(()=>nativeAPI('/api/import',file,{'X-Filename':'large.pdf'}),/40 MB/);
  assert.equal(calls.length,0);
});
test('native pasted text limits are measured as UTF-8 bytes, including non-ASCII scripts', async () => {
  const calls=bridge(),text='é'.repeat(20*1024*1024+1);
  await assert.rejects(()=>nativeAPI('/api/import',text,{'X-Filename':'Pasted.txt'}),/40 MB/);
  const blob=new Blob(['Script']);Object.defineProperty(blob,'size',{value:40*1024*1024+1});
  blob.text=()=>assert.fail('Oversized blob must never be read');
  await assert.rejects(()=>nativeAPI('/api/import',blob,{'X-Filename':'Script.txt'}),/40 MB/);
  assert.equal(calls.length,0);
});
test('native PDF conversion preserves binary chunks and uses extracted text for parsing', async () => {
  const bytes=Uint8Array.from({length:20003},(_,i)=>i%256),calls=bridge(message=>message.operation==='pdf'?script:{sha256:'a'.repeat(64),filename:'Script.pdf',marks:[]});
  const result=await nativeAPI('/api/import',new File([bytes],'Script.pdf'),{'X-Filename':'Script.pdf'});
  assert.equal(calls.length,2);assert.equal(calls[0].operation,'pdf');assert.equal(calls[1].operation,'storePDF');assert.equal(result.project._linedScript.activePdf,'a'.repeat(64));
  assert.deepEqual(new Uint8Array(Buffer.from(calls[0].base64,'base64')),bytes);
  assert.deepEqual(result.project.breakdowns.map(b=>b.scene),['12A','13']);
});
test('native PDF conversion reports unreadable/scanned PDFs and native failures', async () => {
  const file=new File(['%PDF'],'Script.pdf');bridge(()=> '');
  await assert.rejects(()=>nativeAPI('/api/import',file,{'X-Filename':'Script.pdf'}),/No scene headings/);
  bridge(()=>{throw Error('PDF text extraction failed');});
  await assert.rejects(()=>nativeAPI('/api/import',file,{'X-Filename':'Script.pdf'}),/PDF text extraction failed/);
});
test('native export and print await completion and propagate cancellation/errors', async () => {
  const data={filename:'backup.json',content:backup(project()),mime:'application/json'},calls=bridge(()=>true);
  assert.deepEqual(await nativeAPI('/api/export',data),{native:true});
  assert.deepEqual(calls[0],{operation:'export',...data});
  await nativePrint();assert.equal(calls[1].operation,'print');
  bridge(()=>{throw Error('Share cancelled');});
  await assert.rejects(()=>nativeAPI('/api/export',data),/Share cancelled/);
  await assert.rejects(()=>nativePrint(),/Share cancelled/);
  await assert.rejects(()=>nativeAPI('/api/missing'),/Unknown local operation/);
});
test('shot view excludes omitted shots from totals and reports actual variance only for completed shots', () => {
  const p=project();p._shots=[shot(p,{status:'Done',actualMinutes:30}),shot(p,{number:'B',status:'Omitted',setupMinutes:100,shootMinutes:100}),shot(p,{number:'C',setupMinutes:5,shootMinutes:5})];
  const {controller}=desk(p),html=controller.render();
  assert.match(html,/<strong>2<\/strong><span>planned shots/);
  assert.match(html,/<strong class="shot-duration">35m<\/strong><span>estimated total/);
  assert.match(html,/<strong class="shot-duration">10m<\/strong><span>remaining estimate/);
  assert.match(html,/<strong>\+5<small> min/);
});
test('shots follow scheduled scenes, retain full-day timings under filters and handle overnight time', () => {
  const p=project();p._shots=[shot(p,{description:'First',setupMinutes:10,shootMinutes:20}),shot(p,{number:'B',description:'Second',setupMinutes:5,shootMinutes:10}),shot(p,{number:'A',sceneId:p.breakdowns[1].id,description:'Unscheduled'})];p._shotSettings={startTime:'23:50'};
  p.stripboards[0].boards[0].breakdownIds=[[p.breakdowns[0].id]];p.stripboards[0].boards[1].breakdownIds=[p.breakdowns[1].id];
  const {controller,nodes}=desk(p);controller.render();controller.bind();
  nodes.get('#shot-day').onchange({target:{value:'0'}});
  assert.match(controller.render(),/00:20 \+1d/);
  nodes.get('#shot-search').oninput({target:{value:'Second'}});
  const html=controller.render();assert.match(html,/00:20 \+1d/);assert.doesNotMatch(html,/class="shot-description">First/);
  controller.csv(); // Repeated rendering/export must not clear filters.
  nodes.get('#shot-day').onchange({target:{value:'unscheduled'}});
  nodes.get('#shot-search').oninput({target:{value:''}});
  assert.match(controller.render(),/class="shot-description">Unscheduled/);
});
test('switching productions resets stale shot filters and selection after repeated navigation', () => {
  const p=project();p._shots=[shot(p)];const harness=desk(p);harness.controller.render();harness.controller.bind();
  harness.nodes.get('#shot-search').oninput({target:{value:'No match'}});
  assert.match(harness.controller.render(),/No shots match this view/);
  const other=project();other._shots=[shot(other,{description:'New production shot'})];other._shotSettings={startTime:'07:00'};harness.setProject(other);
  for(let i=0;i<3;i++){assert.match(harness.controller.render(),/New production shot/);harness.controller.bind();}
});
test('shot HTML and CSV exports escape untrusted text, quotes and spreadsheet formulas', () => {
  const p=project();p._shots=[shot(p,{description:'<img src=x onerror=alert(1)>',notes:'=HYPERLINK("https://example.invalid")',camera:'"A"'})];
  const harness=desk(p),html=harness.controller.render();
  assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img src=x/);
  harness.controller.csv();const exported=harness.downloaded();
  assert.equal(exported.filename,'shot-list.csv');assert.equal(exported.mime,'text/csv;charset=utf-8');
  assert.match(exported.content,/"'=HYPERLINK\(""https:\/\/example.invalid""\)"/);
  assert.match(exported.content,/"""A"""/);
  harness.controller.print();assert.equal(harness.printed(),1);assert.doesNotMatch(harness.nodes.get('#print-area').innerHTML,/<img src=x/);
});
test('strip colors accept only safe hex values with readable foregrounds', () => {
  assert.equal(validStripColor('#E60026'),true);assert.equal(validStripColor('url(https://example.invalid)'),false);
  assert.equal(stripTextColor('#000000'),'#FFFFFF');assert.equal(stripTextColor('#FFFFFF'),'#000000');
  assert.equal(formatShotDuration(1501),'1d 1h 1m');
});


test('current full backups retain PDF attachments and pass them through native restore',async()=>{
 const p=project(),hash='a'.repeat(64);p._linedScript={activePdf:hash,documents:[{sha256:hash,filename:'original.pdf',marks:[{id:crypto.randomUUID(),type:'arrow',page:0,start:[.1,.1],end:[.9,.9],color:'#E60026',width:2}]}]};
 const calls=bridge(message=>message.operation==='backupPDFs'?{[hash]:'JVBERi0='}:true);
 const result=await nativeAPI('/api/backup',{workspace:workspace(p),filename:'backup.json'});
 assert.equal(result.native,true);assert.deepEqual(calls.map(c=>c.operation),['backupPDFs','export']);
 const backup=JSON.parse(calls[1].content);assert.equal(backup._pdfDocuments[hash],'JVBERi0=');
 const restored=await nativeAPI('/api/import',JSON.stringify(backup),{'X-Filename':'backup.json'});
 assert.equal(calls[2].operation,'restorePDFs');assert.equal(calls[2].workspace.projects[0]._linedScript.documents[0].marks.length,1);
 assert.equal(restored.workspace._pdfDocuments,undefined);
});
test('invalid annotation references or coordinates are rejected before save',async()=>{
 const p=project(),hash='b'.repeat(64);p._linedScript={activePdf:hash,documents:[{sha256:hash,filename:'script.pdf',marks:[]}]};validateUSS(p);
 const invalid=structuredClone(p);invalid._linedScript.activePdf='c'.repeat(64);assert.throws(()=>validateUSS(invalid),/active PDF/);
 p._linedScript.documents[0].marks.push({id:crypto.randomUUID(),type:'coverage',page:0,start:[.1,.2],end:[.9,.9],color:'#E60026',width:2,style:'wavy'});
 const calls=bridge();await assert.rejects(()=>nativeAPI('/api/workspace',workspace(p)),/coverage/);assert.equal(calls.length,0);
});


test('registered iPad upgrade accepts the original Scheduler sample without changing production or scene IDs',()=>{
 const legacy=JSON.parse(readFileSync(new URL('../ProductionDeskTests/Fixtures/legacy-scheduler-workspace.json',import.meta.url),'utf8'));
 const original=structuredClone(legacy),validated=validateWorkspace(legacy);
 assert.equal(validated.version,1);assert.equal(validated.projects[0].project,'The Last Light');
 assert.equal(validated.activeProject,original.activeProject);
 assert.deepEqual(validated.projects.map(p=>p.id),original.projects.map(p=>p.id));
 assert.deepEqual(validated.projects[0].breakdowns.map(b=>b.id),original.projects[0].breakdowns.map(b=>b.id));
 assert.equal(validated.projects[0].breakdowns.filter(b=>b.type==='scene').length,8);
});

test('portable project wraps every field, preserves original source, and rejects missing assets or future versions', async()=>{
  const {projectFile,readProjectFile}=await import('../ProductionDesk/Web/project-file.js');
  const value=JSON.parse(readFileSync(new URL('../ProductionDeskTests/Fixtures/portable-desktop.productiondesk',import.meta.url)));
  assert.deepEqual(readProjectFile(structuredClone(value)),value.workspace);
  assert.deepEqual(projectFile(structuredClone(value.workspace)),value);
  assert.throws(()=>readProjectFile({...value,formatVersion:2}),/not supported/);
  assert.throws(()=>readProjectFile({...value,format:'other'}),/not a Production Desk/);
  const missing=structuredClone(value);missing.workspace._pdfDocuments={};
  assert.throws(()=>readProjectFile(missing),/embedded original PDF/);
});
test('duplicate imports retain scoped relationships, label copies, preserve all fields, and leave existing work intact', async()=>{
  const {mergeProductions}=await import('../ProductionDesk/Web/project-file.js');
  const value=JSON.parse(readFileSync(new URL('../ProductionDeskTests/Fixtures/portable-desktop.productiondesk',import.meta.url))).workspace;
  delete value._pdfDocuments;
  const original=structuredClone(value),p=value.projects[0];p.description=p.id;p._sourceScript.text=p.id;
  const before=structuredClone(value),first=mergeProductions(value,[p]),copy=first.imported[0];
  assert.deepEqual(value,before);assert.deepEqual(first.workspace.projects[0],p);
  assert.notEqual(copy.id,p.id);assert.equal(copy.breakdowns[0].id,p.breakdowns[0].id);
  assert.equal(copy.description,p.id);assert.equal(copy._sourceScript.text,p.id);
  assert.equal(copy._shots[0].sceneId,copy.breakdowns[0].id);
  assert.equal(copy._linedScript.documents[0].marks[0].shotId,copy._shots[0].id);
  assert.equal(copy._linedScript.activePdf,p._linedScript.activePdf);
  assert.match(copy.project,/imported copy$/);
  const second=mergeProductions(first.workspace,[p]);assert.match(second.imported[0].project,/imported copy 2$/);
  assert.equal(first.workspace.projects.length,2);validateWorkspace(second.workspace);
});
test('native project import validates before asset restore, and Save As cancellation is explicit', async()=>{
  const value=JSON.parse(readFileSync(new URL('../ProductionDeskTests/Fixtures/portable-desktop.productiondesk',import.meta.url)));
  const calls=bridge(m=>m.operation==='backupPDFs'?value.workspace._pdfDocuments:m.operation==='export'?{native:true,cancelled:true}:true);
  const imported=await nativeAPI('/api/import',JSON.stringify(value),{'X-Filename':'Story.productiondesk'});
  assert.equal(imported.workspace.projects[0].id,value.workspace.activeProject);
  assert.equal(calls[0].operation,'restorePDFs');
  const count=calls.length;
  await assert.rejects(()=>nativeAPI('/api/import',JSON.stringify({...value,formatVersion:99}),{'X-Filename':'Story.productiondesk'}),/not supported/);
  await assert.rejects(()=>nativeAPI('/api/import','{bad',{'X-Filename':'Story.productiondesk'}),/corrupt/);
  assert.equal(calls.length,count);
  const result=await nativeAPI('/api/project-file',{workspace:imported.workspace,filename:'Story.productiondesk',destination:'files'});
  assert.deepEqual(result,{native:true,cancelled:true});
  const output=calls.at(-1);assert.equal(output.destination,'files');assert.deepEqual(JSON.parse(output.content),value);
});
test('legacy full JSON backups with missing schedules are repaired without losing script or shots',()=>{
 const p=project();p._shots=[shot(p)];p.stripboards=[];
 const result=importBackup(JSON.stringify(workspace(p)));
 assert.equal(result.workspace.projects[0]._shots[0].sceneId,p.breakdowns[0].id);
 assert.deepEqual(result.workspace.projects[0].stripboards[0].boards[1].breakdownIds,p.breakdowns.map(b=>b.id));
 validateWorkspace(result.workspace);
});

const demoFixture=()=>JSON.parse(readFileSync(new URL('../../windows-src/tests/fixtures/demo/the-last-light.productiondesk',import.meta.url),'utf8')).workspace;
const runtimeDemo=()=>{const w=demoFixture();delete w._pdfDocuments;return w;};

test('offline Last Light sample covers all scenes, schedules, shots and original PDF pages',async()=>{
 const {readProjectFile}=await import('../ProductionDesk/Web/project-file.js');
 const value=JSON.parse(readFileSync(new URL('../../windows-src/tests/fixtures/demo/the-last-light.productiondesk',import.meta.url),'utf8'));
 const w=readProjectFile(value),p=w.projects[0];validateUSS(p);
 assert.equal(p.project,'DEMO · The Last Light');assert.equal(p.breakdowns.filter(b=>b.type==='scene').length,8);
 assert.equal(p.breakdowns.filter(b=>b.type==='banner').length,3);assert.equal(p.stripboards.length,2);
 assert.equal(p._shots.length,16);assert.equal(new Set(p._shots.map(s=>s.sceneId)).size,8);
 assert.ok(p._shots.some(s=>s.status==='Done'&&s.takes===3&&s.circleTake==='2'&&s.actualMinutes===20));
 assert.equal(p._linedScript.documents[0].marks.length,12);
 assert.equal(new Set(p._linedScript.documents[0].marks.map(m=>m.page)).size,8);
 const raw=Buffer.from(Object.values(w._pdfDocuments)[0],'base64');assert.ok(raw.subarray(0,8).toString().startsWith('%PDF-1.4'));
 const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(raw).digest('hex'),p._linedScript.activePdf);
 const text=readFileSync(new URL('../../windows-src/tests/fixtures/demo/the-last-light.fountain',import.meta.url),'utf8');assert.equal(p._sourceScript.text,text);
 for(const sentence of ['We should have left yesterday.',"One hundred and twelve steps. Your father counted every morning.",'Now I am.'])assert.ok(text.includes(sentence));
});
test('demo load preserves legacy samples, same-title productions, workspace extensions and edited repeats',async()=>{
 const {DEMO_KEY,planDemo,managedDemo}=await import('../../windows-src/tests/fixtures/demo/demo.js');
 const incoming=runtimeDemo(),w=workspace(project());w.projects[0].project=incoming.projects[0].project;w.projects[0]._betaDemo={key:'productiondesk.the-last-cue.v1'};w._extension={keep:true};
 const before=structuredClone(w),first=planDemo(w,incoming);assert.deepEqual(w,before);assert.equal(first.workspace.projects.length,2);
 assert.deepEqual(first.workspace.projects[0],w.projects[0]);assert.deepEqual(first.workspace._extension,w._extension);
 const demo=managedDemo(first.workspace);assert.equal(first.workspace._demoProjects[DEMO_KEY],demo.id);assert.notEqual(demo.id,w.projects[0].id);
 demo.project='My renamed rehearsal';demo.breakdowns[0].description='Keep this edit';
 const saved=structuredClone(first.workspace),repeat=planDemo(first.workspace);assert.equal(repeat.created,false);assert.deepEqual(first.workspace,saved);
 assert.equal(repeat.workspace.activeProject,demo.id);assert.deepEqual(managedDemo(repeat.workspace),demo);assert.equal(repeat.workspace.projects.length,2);
});
test('portable copies never acquire reset ownership; safe reset replaces only its managed sample',async()=>{
 const {planDemo,managedDemo}=await import('../../windows-src/tests/fixtures/demo/demo.js');
 const {mergeProductions,projectFile,readProjectFile}=await import('../ProductionDesk/Web/project-file.js');
 const source=demoFixture(),first=planDemo(workspace(project()),runtimeDemo()).workspace,owned=managedDemo(first);
 owned.breakdowns[0].comments='Only this edited demo may reset';
 const portable=projectFile({version:1,activeProject:owned.id,projects:[structuredClone(owned)],_pdfDocuments:source._pdfDocuments});
 const returned=readProjectFile(JSON.parse(JSON.stringify(portable)));
 const merged=mergeProductions(first,returned.projects,returned.activeProject).workspace,imported=merged.projects.at(-1);
 assert.notEqual(imported.id,owned.id);assert.equal(managedDemo(merged).id,owned.id);assert.equal(imported.breakdowns[0].comments,'Only this edited demo may reset');
 assert.throws(()=>planDemo(merged,runtimeDemo(),imported.id),/Only the demo created here/);
 const before=structuredClone(merged),reset=planDemo(merged,runtimeDemo(),owned.id).workspace;
 assert.deepEqual(merged,before);assert.equal(reset.projects.length,merged.projects.length);
 for(const p of merged.projects.filter(p=>p.id!==owned.id))assert.deepEqual(reset.projects.find(q=>q.id===p.id),p);
 assert.notEqual(managedDemo(reset).breakdowns[0].comments,owned.breakdowns[0].comments);
 // A copied marker without the workspace-local registry is an ordinary production.
 assert.equal(managedDemo({version:1,projects:[imported],activeProject:imported.id}),undefined);
});
test('collision and stale-registry demo loading preserves imported copies and valid relationships',async()=>{
 const {DEMO_KEY,planDemo,managedDemo}=await import('../../windows-src/tests/fixtures/demo/demo.js');
 const incoming=runtimeDemo(),w=structuredClone(incoming);w._demoProjects={[DEMO_KEY]:'deleted-production'};
 const before=structuredClone(w),added=planDemo(w,incoming).workspace;
 assert.deepEqual(w,before);assert.equal(added.projects.length,2);assert.deepEqual(added.projects[0],w.projects[0]);
 const demo=managedDemo(added);assert.notEqual(demo.id,w.projects[0].id);assert.equal(demo.breakdowns[0].id,w.projects[0].breakdowns[0].id);
 assert.equal(demo._shots[0].sceneId,demo.breakdowns[0].id);assert.equal(demo._linedScript.documents[0].marks[0].shotId,demo._shots[0].id);validateWorkspace(added);
});
test('invalid or stale demo operations leave workspace untouched',async()=>{
 const {planDemo}=await import('../../windows-src/tests/fixtures/demo/demo.js');const w=workspace(project()),before=structuredClone(w);
 for(const value of [undefined,{projects:[]},{projects:[project()]}])assert.throws(()=>planDemo(w,value),/bundled demo/);
 assert.throws(()=>planDemo(w,runtimeDemo(),'stale-ID'),/Only the demo created here/);assert.deepEqual(w,before);
});

test('turning off the demo flag rejects new loads without changing saved productions',async()=>{
 const source=readFileSync(new URL('../../windows-src/tests/fixtures/demo/demo.js',import.meta.url),'utf8')
   .replace("'../../../web/project-file.js'",JSON.stringify(new URL('../ProductionDesk/Web/project-file.js',import.meta.url).href))
   .replace('export const DEMO_ENABLED = true','export const DEMO_ENABLED = false');
 const disabled=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const w=runtimeDemo(),before=structuredClone(w);assert.equal(disabled.DEMO_ENABLED,false);
 assert.throws(()=>disabled.planDemo(w,runtimeDemo()),/disabled/);assert.deepEqual(w,before);validateWorkspace(w);
});

function demoControlsHarness(initial,options={}) {
 const nodes=new Map(['#load-demo','#demo-guide','#demo-launcher'].map(key=>[key,{disabled:false,hidden:true}]));
 globalThis.document={querySelector:key=>nodes.get(key),activeElement:{blur(){}}};
 let current=initial,applied=0,imports=0,fetches=0,messages=[];
 globalThis.fetch=async()=>{fetches++;if(options.fetchError)throw Error(options.fetchError);await options.duringFetch?.();return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};};
 const config={workspace:()=>current,flush:async()=>options.flush?.()??true,
   importFile:async()=>{imports++;return {workspace:runtimeDemo()};},apply:w=>{current=w;applied++;},toast:m=>messages.push(m)};
 return {nodes,config,workspace:()=>current,stats:()=>({applied,imports,fetches,messages})};
}
test('demo controls stop on failed current save or missing asset and keep existing work intact',async()=>{
 const {createDemoControls}=await import('../../windows-src/tests/fixtures/demo/demo-controls.js');
 const before=workspace(project()),failed=demoControlsHarness(before,{flush:()=>false});createDemoControls(failed.config).bind();
 await failed.nodes.get('#load-demo').onclick();assert.equal(failed.workspace(),before);assert.equal(failed.stats().applied,0);assert.equal(failed.stats().fetches,0);assert.match(failed.stats().messages[0],/Save your current work/);assert.equal(failed.nodes.get('#load-demo').disabled,false);
 const missing=demoControlsHarness(before,{fetchError:'Missing sample'});createDemoControls(missing.config).bind();await missing.nodes.get('#load-demo').onclick();
 assert.equal(missing.workspace(),before);assert.equal(missing.stats().applied,0);assert.match(missing.stats().messages[0],/Missing sample/);
});
test('demo controls merge against current async edits and repeated load reuses the saved sample offline',async()=>{
 const {createDemoControls}=await import('../../windows-src/tests/fixtures/demo/demo-controls.js');
 const w=workspace(project()),h=demoControlsHarness(w,{duringFetch:()=>{w.projects[0].description='Edit made while reading sample';}});
 createDemoControls(h.config).bind();await h.nodes.get('#load-demo').onclick();
 assert.equal(h.workspace().projects.length,2);assert.equal(h.workspace().projects[0].description,'Edit made while reading sample');assert.equal(h.stats().imports,1);
 h.workspace().projects.at(-1).project='Renamed managed sample';await h.nodes.get('#load-demo').onclick();
 assert.equal(h.workspace().projects.length,2);assert.equal(h.workspace().projects.at(-1).project,'Renamed managed sample');assert.equal(h.stats().fetches,1);assert.equal(h.stats().imports,1);assert.equal(h.nodes.get('#demo-launcher').hidden,false);
});
test('demo controls report a failed final save truthfully and permit a safe retry',async()=>{
 const {createDemoControls}=await import('../../windows-src/tests/fixtures/demo/demo-controls.js');let saves=0;
 const h=demoControlsHarness(workspace(project()),{flush:()=>++saves!==2});createDemoControls(h.config).bind();await h.nodes.get('#load-demo').onclick();
 assert.equal(h.workspace().projects.length,2);assert.match(h.stats().messages[0],/open but its save failed/);assert.equal(h.nodes.get('#load-demo').disabled,false);
 await h.nodes.get('#load-demo').onclick();assert.equal(h.workspace().projects.length,2);assert.equal(h.stats().imports,1);assert.match(h.stats().messages.at(-1),/existing demo/);
});


test('demo guide exports the paired Scenic file with the supported JSON export type',async()=>{
 const {createDemoControls}=await import('../../windows-src/tests/fixtures/demo/demo-controls.js');
 const h=demoControlsHarness(workspace(project()));
 for(const key of ['#demo-guide-close','#demo-scenic-file','#demo-guide-open','#modal'])h.nodes.set(key,{disabled:false,close(){}});
 h.config.modal=()=>{};let exported;
 h.config.download=async(filename,content,type)=>{exported={filename,content,type};return true;};
 const fixture=readFileSync(new URL('../../windows-src/tests/fixtures/demo/the-last-light.scenic',import.meta.url),'utf8');
 globalThis.fetch=async()=>({ok:true,text:async()=>fixture});
 createDemoControls(h.config).bind();h.nodes.get('#demo-guide').onclick();await h.nodes.get('#demo-scenic-file').onclick();
 assert.equal(exported.filename,'The-Last-Light.scenic');assert.equal(exported.type,'application/json');
 assert.equal(JSON.parse(exported.content).scenes.length,8);assert.equal(h.nodes.get('#demo-scenic-file').disabled,false);
});
