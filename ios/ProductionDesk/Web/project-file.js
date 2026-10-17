import {validateWorkspace} from './film-native.js';

export const PROJECT_FORMAT = 'org.squidproductions.productiondesk.project';
export const PROJECT_VERSION = 1;
export const MAX_PROJECT_BYTES = 200 * 1024 * 1024;

// Project files are data only. PDFs are the existing checksum-addressed backup
// attachments; scripts and all application extensions stay in the workspace.
export function projectFile(workspace) {
  validateWorkspace(workspace);
  if(workspace.projects.length!==1)throw Error('Choose one production to save as a project file.');
  const wanted=new Set(workspace.projects.flatMap(p=>p._linedScript?.documents?.map(d=>d.sha256)||[]));
  const documents=workspace._pdfDocuments;
  if(!documents||typeof documents!=='object'||Array.isArray(documents)||wanted.size!==Object.keys(documents).length||[...wanted].some(hash=>typeof documents[hash]!=='string'))throw Error('This project is missing an embedded original PDF. Save it again from the source device.');
  const plain=structuredClone(workspace);delete plain._pdfDocuments;
  if(new TextEncoder().encode(JSON.stringify(plain)).length>40*1024*1024)throw Error('The production data exceeds 40 MB.');
  const value={format:PROJECT_FORMAT,formatVersion:PROJECT_VERSION,workspace};
  if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_PROJECT_BYTES)throw Error('This project file exceeds 200 MB.');
  return value;
}

export function readProjectFile(value) {
  if(value?.format!==PROJECT_FORMAT)throw Error('This is not a Production Desk project file.');
  if(value.formatVersion!==PROJECT_VERSION)throw Error('This Production Desk project version is not supported. Update Production Desk to open it.');
  return projectFile(value.workspace).workspace;
}

// Remap only identifiers and relationship fields. Free text and the embedded
// source script must remain byte-for-byte equivalent, even if they contain IDs.
export function mergeProductions(current, incoming, activeID) {
  const known=new Set(current.projects.map(p=>p.id));
  const titles=new Set(current.projects.map(p=>p.project||p.name));
  const imported=incoming.map(original=>{
    let copy=structuredClone(original);
    if(known.has(copy.id)) {
      const map=new Map();
      const gather=value=>{if(Array.isArray(value))value.forEach(gather);else if(value&&typeof value==='object'){if(typeof value.id==='string')map.set(value.id,crypto.randomUUID());for(const [key,item] of Object.entries(value))if(key!=='_sourceScript')gather(item);}};
      const references=new Set(['id','category','calendar','sceneId','shotId','elements','linkedElements','breakdownIds']);
      const replace=(value,key)=>typeof value==='string'?(references.has(key)?map.get(value)||value:value):Array.isArray(value)?value.map(item=>replace(item,key)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='_sourceScript'?v:replace(v,k)])):value;
      gather(copy);copy=replace(copy);
    }
    let title=copy.project||copy.name;
    if(titles.has(title)){const base=title+' · imported copy';title=base;let n=2;while(titles.has(title))title=base+' '+n++;copy.project=title;}
    known.add(copy.id);titles.add(title);return copy;
  });
  const activeIndex=incoming.findIndex(p=>p.id===activeID);
  const result={...current,projects:[...current.projects,...imported],activeProject:imported[Math.max(0,activeIndex)].id};
  validateWorkspace(result);
  if(new TextEncoder().encode(JSON.stringify(result)).length>40*1024*1024)throw Error('There is not enough workspace capacity to import this production (40 MB limit). Your current work is unchanged.');
  return {workspace:result,imported};
}
