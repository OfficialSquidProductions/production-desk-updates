import {importScript,validateUSS} from '../film-native.js';

// Temporary TestFlight feature. Set false to hide/disable Load Demo; existing
// saved demo productions remain ordinary editable/exportable user documents.
export const DEMO_ENABLED = true;
export const DEMO_KEY = 'productiondesk.the-last-cue.v1';

export function createDemoProduction(text) {
  const filename='The_Last_Cue_Demo.fountain',p=importScript(text,filename);
  p.project='DEMO · The Last Cue';
  p.description='Fictional TestFlight sample: adult college students Maya (stage manager) and Leo (lighting operator) rehearse a missed cue and complete the reset. Safe to edit, export or delete.';
  p._demo=true;p._betaDemo={key:DEMO_KEY,version:1};p._sourceScript={filename,text};
  p._importNotes='Original fictional demo. Scene lengths, cue notes and shot timings are sample values for testing.';
  const add=(b,ucid,name)=>{
    const category=p.categories.find(c=>c.ucid===ucid);
    let e=p.elements.find(e=>e.category===category.id&&e.name===name);
    if(!e){e={id:crypto.randomUUID(),category:category.id,created:p.created,name,daysOff:[],elementId:null,events:[],isDood:false,isDrop:true,isHold:true,isIdLock:false,linkedElements:[]};p.elements.push(e);}
    if(!b.elements.includes(e.id))b.elements.push(e.id);
  };
  const descriptions=['Maya and Leo prepare the desk, chair, prop notebook and practical lamp for rehearsal.','Leo misses lighting cue twelve, identifies the page-turn trigger, and marks the cue list.','The pair reset the chair and notebook, take the lighting cue correctly, and finish rehearsal.'];
  p.breakdowns.forEach((b,i)=>{
    b.description=descriptions[i];b.comments=i===1?'Cue 12: lamp follows the page turn. Rehearse the reset before recording.':'Fictional demo scene. Edit this sheet to try the workflow.';
    b.duration=[15,10,15][i]*60000;b._needsReview=false;
    add(b,104,'Prop notebook');add(b,104,'Practical lamp');add(b,112,'Lighting cue 12');
    if(i!==1){add(b,116,'Desk');add(b,116,'Chair');}
    else add(b,112,'Lighting console');
  });
  p.stripboards[0].name='Demo rehearsal day';
  p.stripboards[0].boards[0].breakdownIds=[p.breakdowns.map(b=>b.id)];
  p.stripboards[0].boards[1].breakdownIds=[];
  p._shots=p.breakdowns.map((b,i)=>({id:crypto.randomUUID(),created:p.created,sceneId:b.id,number:'A',description:['Wide rehearsal setup: desk, chair, notebook and practical lamp','Medium on Leo identifying the missed cue','Wide reset and successful final lighting cue'][i],size:i===1?'Medium':'Wide',movement:'Static',camera:'A',lens:i===1?'50':'35',equipment:'Tripod',setupMinutes:5,shootMinutes:5,actualMinutes:null,takes:0,circleTake:'',priority:'Essential',notes:'Fictional demo shot; change any field to test saving.',status:'Planned'}));
  p._shotSettings={startTime:'09:00'};
  return validateUSS(p);
}

export async function demoForWorkspace(workspace,readScript=async()=>{
  const response=await fetch('/demo/the-last-cue.fountain');
  if(!response.ok)throw Error('The bundled demo script could not be opened.');
  return response.text();
}) {
  if(!DEMO_ENABLED)throw Error('Demo content is disabled in this build.');
  const existing=workspace.projects.find(p=>p._betaDemo?.key===DEMO_KEY);
  // Reopening by marker also preserves renamed or edited demo productions.
  if(existing)return {project:existing,created:false};
  return {project:createDemoProduction(await readScript()),created:true};
}
