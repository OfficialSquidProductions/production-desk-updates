// Store only IDs. New shots append; deleted/stale IDs disappear without changing
// the canonical Shot List, identifiers, scene schedules or coverage relationships.
export function shotShootingOrder(project) {
  const valid=new Set(project._shots.map(s=>s.id)),seen=new Set();
  return [...(Array.isArray(project._shotShootingOrder)?project._shotShootingOrder:[]),...valid]
    .filter(id=>valid.has(id)&&!seen.has(id)&&seen.add(id));
}
export function reconcileShotShootingOrder(project) {
  if(Array.isArray(project._shotShootingOrder))project._shotShootingOrder=shotShootingOrder(project);
}
