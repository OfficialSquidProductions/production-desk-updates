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
