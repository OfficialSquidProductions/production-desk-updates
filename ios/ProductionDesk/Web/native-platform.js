import {emptyProject,importScript,importBackup,validateWorkspace} from './film-native.js';
import {projectFile,readProjectFile} from './project-file.js';
const send=value=>window.webkit.messageHandlers.scheduler.postMessage(value);
const encode=bytes=>{let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
export async function nativeAPI(path,data,headers={}){
 switch(path){
 case '/api/workspace':
  if(data!==undefined){validateWorkspace(data);return send({operation:'save',workspace:data});}
  {const loaded=await send({operation:'load'});if(loaded!==null)return validateWorkspace(loaded);const project=emptyProject(),workspace={version:1,activeProject:project.id,projects:[project]};await send({operation:'save',workspace});return workspace;}
 case '/api/new':return emptyProject(data.title||'Untitled production');
 case '/api/pdf':{
  if(!(data instanceof Blob)||data.size>40*1024*1024)throw Error('Choose a PDF smaller than 40 MB.');
  return {document:await send({operation:'storePDF',base64:encode(new Uint8Array(await data.arrayBuffer())),filename:decodeURIComponent(headers['X-Filename']||'script.pdf')})};}
 case '/api/import':{
  const filename=decodeURIComponent(headers['X-Filename']||'script.txt').split(/[\\/]/).pop(),pdf=/\.pdf$/i.test(filename),limit=(/\.(json|productiondesk)$/i.test(filename)?200:40)*1024*1024;
  if((data instanceof Blob&&data.size>limit)||(typeof data==='string'&&new TextEncoder().encode(data).length>limit))throw Error('The selected file is too large. PDFs/scripts support 40 MB; full backups support 200 MB.');
  if(pdf){const base64=encode(new Uint8Array(await data.arrayBuffer())),text=await send({operation:'pdf',base64}),document=await send({operation:'storePDF',base64,filename}),project=importScript(text,filename);project._linedScript={activePdf:document.sha256,documents:[document]};return {project};}
  const text=(typeof data==='string'?data:await data.text()).replace(/^\uFEFF/,'');
  if(!/\.(uss|json|productiondesk)$/i.test(filename)){const project=importScript(text,filename);project._sourceScript={filename,text};return {project};}
  let value;try{value=JSON.parse(text);}catch{throw Error('This file is corrupt or is not valid Production Desk JSON.');}
  const portable=/\.productiondesk$/i.test(filename)||value?.format!==undefined;
  const result=portable?{workspace:readProjectFile(value)}:importBackup(text);
  await send({operation:'restorePDFs',workspace:result.workspace||{projects:[result.project]}});
  if(result.workspace)delete result.workspace._pdfDocuments;
  return result;
 }
 case '/api/project-file':{
  const workspace=structuredClone(data.workspace);validateWorkspace(workspace);
  workspace._pdfDocuments=await send({operation:'backupPDFs',workspace});
  const content=JSON.stringify(projectFile(workspace));
  return send({operation:'export',filename:data.filename,content,destination:data.destination||'files'});}
 case '/api/backup':{
  validateWorkspace(data.workspace);const workspace=structuredClone(data.workspace);workspace._pdfDocuments=await send({operation:'backupPDFs',workspace});
  await send({operation:'export',filename:data.filename,content:JSON.stringify(workspace,null,2)});return {native:true};}
 case '/api/export':await send({operation:'export',...data});return {native:true};
 default:throw Error('Unknown local operation.');
 }
}
export async function nativePrint(){return send({operation:'print'});}
