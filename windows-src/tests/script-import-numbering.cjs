const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const moduleAt=name=>import(pathToFileURL(path.join(__dirname,'../web',name)).href);
test('script revisions stay in the current production and preserve shot, schedule and PDF links',async()=>{
 const {emptyProject,importScript}=await moduleAt('film-native.js'),{loadScriptIntoProduction}=await moduleAt('project-file.js');
 const p=emptyProject('My production'),other=emptyProject('Unrelated');
 const original={version:1,activeProject:p.id,projects:[p,other]},before=structuredClone(original);
 let w=loadScriptIntoProduction(original,importScript('INT. ROOM - DAY\n\nA clock ticks.','First.txt')).workspace;
 assert.deepEqual(original,before);assert.equal(w.projects.length,2);assert.equal(w.activeProject,p.id);assert.equal(w.projects[0].project,'My production');
 const target=w.projects[0],scene=target.breakdowns[0];scene.description='Keep custom breakdown';scene._stripColor='#112233';
 target._shots=[];target._linedScript={activePdf:null,documents:[],numbering:{[scene.id]:'7.1'}};
 const scheduled=structuredClone(target.stripboards),id=scene.id,elementCount=target.elements.length;
 for(let i=0;i<3;i++)w=loadScriptIntoProduction(w,importScript('INT. ROOM - DAY\n\nA revised clock ticks.','Revision.txt')).workspace;
 assert.equal(w.projects.length,2);assert.equal(w.projects[0].breakdowns.length,1);assert.equal(w.projects[0].breakdowns[0].id,id);
 assert.equal(w.projects[0].breakdowns[0].description,'Keep custom breakdown');assert.equal(w.projects[0].breakdowns[0]._stripColor,'#112233');
 assert.match(w.projects[0].breakdowns[0]._scriptText,/revised/);assert.equal(w.projects[0].elements.length,elementCount);
 assert.deepEqual(w.projects[0].stripboards,scheduled);assert.deepEqual(w.projects[1],other);assert.equal(w.projects[0]._linedScript.numbering[id],'7.1');
});
test('manual full-number baselines continue after reload, repeated changes and occupied values',async()=>{
 const {nextLinedShotNumber:next,rememberLinedShotNumber:remember,normalizeShotNumber:normalize}=await moduleAt('shot-identifiers.js');
 let p={breakdowns:[{id:'scene4',scene:'4'},{id:'scene3',scene:'3'}],_shots:[]};
 const add=n=>{const shot={sceneId:'scene4',number:normalize(n,'4')};p._shots.push(shot);remember(p,shot);return shot;};
 const shot=add('4.3');shot.number='7.1';remember(p,shot);assert.equal(next(p,'scene4'),'7.2');add(next(p,'scene4'));assert.equal(next(p,'scene4'),'7.3');add(next(p,'scene4'));
 p=JSON.parse(JSON.stringify(p));shot.number='3.2';remember(p,shot);assert.equal(next(p,'scene4'),'3.3');add(next(p,'scene4'));assert.equal(next(p,'scene4'),'3.4');
 p._shots.push({sceneId:'scene4',number:'3.4'});assert.equal(next(p,'scene4'),'3.5');assert.equal(next(p,'scene3'),'.1');
});
