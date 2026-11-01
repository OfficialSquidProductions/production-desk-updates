// Store numeric entries as suffixes so existing scene + suffix projects stay portable.
export function normalizeShotNumber(value,scene){
  const number=String(value??'').trim().replace(/\.{2,}/g,'.');
  const prefix=String(scene??'').trim()+'.';
  if(number.toUpperCase().startsWith(prefix.toUpperCase()))return '.'+number.slice(prefix.length);
  if(number.startsWith('.')||number.includes('.'))return number;
  return /^\d/.test(number)?'.'+number:number;
}
export function shotIdentifier(scene,number){
  const value=normalizeShotNumber(number,scene);
  return value.includes('.')&&!value.startsWith('.')?value:String(scene||'?')+value;
}
export function shotNumberKey(value,scene){return normalizeShotNumber(value,scene).toUpperCase();}

// A manual renumber establishes a persisted baseline for this scene. Continue
// its full numeric prefix and skip occupied values without filling earlier gaps.
export function nextLinedShotNumber(project,sceneId){
  const scene=project.breakdowns.find(b=>b.id===sceneId)?.scene;
  const key=value=>shotNumberKey(value,scene);
  const used=new Set((project._shots||[]).filter(s=>s.sceneId===sceneId).map(s=>key(s.number)));
  const baseline=project._linedScript?.numbering?.[sceneId];
  const match=typeof baseline==='string'&&baseline.match(/^(.*\.)(\d+)$/);
  let prefix=match?match[1]:'.',n=match?BigInt(match[2])+1n:1n;
  while(used.has(key(prefix+n)))n++;
  return prefix+n;
}
export function rememberLinedShotNumber(project,shot){
  project._linedScript||={activePdf:null,documents:[]};
  project._linedScript.numbering||={};
  project._linedScript.numbering[shot.sceneId]=shot.number;
}
