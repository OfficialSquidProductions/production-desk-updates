import {mergeProductions} from '../project-file.js';

// Temporary beta entry point. Disable this flag in both bundled copies to hide
// the controls at launch; saved sample productions remain ordinary user files.
export const DEMO_ENABLED = true;
export const DEMO_KEY = 'productiondesk.scenic.the-last-cue.v2';

// Ownership is workspace-local. Portable imports never grant reset ownership.
export function managedDemo(workspace) {
  const ownedID = workspace._demoProjects?.[DEMO_KEY];
  return workspace.projects.find(p => p.id === ownedID && p._betaDemo?.key === DEMO_KEY);
}

export function planDemo(workspace, incoming, resetID) {
  if (!DEMO_ENABLED) throw Error('Demo content is disabled in this build.');
  const existing = managedDemo(workspace);
  if (resetID && existing?.id !== resetID) throw Error('Only the demo created here can be reset. Other productions are unchanged.');
  if (existing && !resetID) return {workspace:{...workspace, activeProject:existing.id}, created:false};
  if (incoming?.projects?.length !== 1 || incoming.projects[0]._betaDemo?.key !== DEMO_KEY) {
    throw Error('The bundled demo could not be read. Your productions are unchanged.');
  }
  const base = resetID ? {...workspace, projects:workspace.projects.filter(p => p.id !== resetID)} : workspace;
  const merged = mergeProductions(base, incoming.projects, incoming.activeProject);
  merged.workspace._demoProjects = {...workspace._demoProjects, [DEMO_KEY]:merged.imported[0].id};
  return {workspace:merged.workspace, created:true, reset:!!resetID};
}
