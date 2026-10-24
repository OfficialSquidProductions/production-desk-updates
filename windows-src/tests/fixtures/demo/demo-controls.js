import {DEMO_ENABLED, managedDemo, planDemo} from './demo.js';

export function createDemoControls(c) {
  let busy = false;
  const button = () => document.querySelector('#load-demo');
  const update = () => {
    const area = document.querySelector('#demo-launcher');
    if (area) area.hidden = !DEMO_ENABLED;
    if (button()) button().disabled = busy;
    const guideButton = document.querySelector('#demo-guide');
    if (guideButton) guideButton.disabled = busy;
  };
  async function load(resetID) {
    if (busy || !DEMO_ENABLED) return;
    busy = true; update();
    try {
      document.activeElement?.blur?.();
      if (!await c.flush()) throw Error('Save your current work successfully before opening the demo.');
      let incoming;
      if (resetID || !managedDemo(c.workspace())) {
        const response = await fetch('/demo/the-last-light.productiondesk');
        if (!response.ok) throw Error('The offline demo file is missing.');
        const file = new File([await response.arrayBuffer()], 'The-Last-Light.productiondesk', {type:'application/json'});
        const result = await c.importFile(file);
        incoming = result.workspace;
      }
      const plan = planDemo(c.workspace(), incoming, resetID);
      c.apply(plan.workspace);
      if (!await c.flush()) throw Error('The demo is open but its save failed. Retry Save before closing.');
      c.toast(plan.reset ? 'Only the sample was reset. Other productions and imported copies are unchanged. Undo is available.' : plan.created ? 'The Last Light demo added separately. Your existing productions are preserved.' : 'Opened your existing demo, keeping all edits.');
    } catch (error) { c.toast('Demo: ' + error.message); }
    finally { busy = false; update(); }
  }
  function guide() {
    if (!DEMO_ENABLED || !c.workspace()) return;
    const owned = managedDemo(c.workspace());
    c.modal('Demo production · The Last Light', `<p>Explore Production Desk’s original eight-scene screenplay: Maya and Eli follow a map to Point Harbor, where Jonah helps Maya bring her father’s lighthouse back to life. All people, places, dates and take data are fictional.</p><ol class="help-steps"><li><strong>Main breakdown:</strong> read all eight scenes, search or tag Maya/Eli/Jonah and the key, map, letter, photograph and compass. Scene 8 is flagged for review; scene 3 has sample completion data.</li><li><strong>Shooting schedule:</strong> compare Location-first shoot and Story-order alternate. Try PREP/MEAL/WRAP banners, the boneyard, three shooting days, strip colors, calendars and cast availability.</li><li><strong>Lined script:</strong> eight original PDF pages, one per scene, with linked solid/wavy coverage and pen, highlighter, arrow and text examples. Edit a mark or export a lined PDF.</li><li><strong>Shot list:</strong> 16 setups cover every scene with cameras A/B, 24–85 mm lenses, static/pan/tilt/tracking moves and setup/shoot timings. Scene 3A has fictional takes, a circle take and actual time; other setups are ready/planned.</li><li><strong>Elements:</strong> explore cast, locations, wardrobe, props, vehicle, camera, sound, lighting, art and continuity examples; inspect relationships and the fictional availability exception. No animals, stunt performers or background cast appear in this story.</li><li><strong>Reports:</strong> open One-line schedule, Scene breakdowns and Cast workdays; compare the two schedule scenarios and print or save the report.</li><li><strong>Files and settings:</strong> try Save As/import, full backup, USS, CSV and theme/production settings. Imported copies remain separate.</li></ol><h3>Use the same production in Scenic</h3><p>Load <strong>The Last Light</strong> in Scenic, or save the original Scenic demo below and use Scenic’s <strong>Import project…</strong>. The eight scene numbers and 16 shot numbers match. To transfer subsequent shot edits, choose Production Desk → Shot list → All days / All scenes / All statuses → Export shots, then Scenic → Shot list → Import shot list CSV. Preview the eight existing scenes before importing; matching numbers preserve maps, camera links and coverage checks.</p><p>The original Scenic file is a starting copy; it does not contain later Production Desk edits. Script edits, layouts and schedules do not sync automatically, and Scenic CSV does not import back into Production Desk. Use each app’s portable Save As file to preserve its full project.</p><p>Load Demo reopens this workspace’s sample and keeps edits. Reset replaces only this managed sample. Existing Last Light, Last Cue and imported productions are preserved; Undo can restore a reset.</p>`, `<button id="demo-guide-close">Close</button><button id="demo-scenic-file">Save original Scenic demo…</button>${owned ? '<button id="demo-reset" class="danger">Reset demo…</button>' : ''}<button id="demo-guide-open" class="primary">${owned ? 'Open demo' : 'Load Demo'}</button>`);
    document.querySelector('#demo-scenic-file').onclick = async () => {
      const target=document.querySelector('#demo-scenic-file');target.disabled=true;
      try {const response=await fetch('/demo/the-last-light.scenic');if(!response.ok)throw Error('The offline Scenic file is missing.');await c.download('The-Last-Light.scenic',await response.text(),'application/json');}
      catch(error){c.toast('Scenic demo: '+error.message);}finally{target.disabled=false;}
    };
    document.querySelector('#demo-guide-close').onclick = () => document.querySelector('#modal').close();
    document.querySelector('#demo-guide-open').onclick = () => { document.querySelector('#modal').close(); load(); };
    const reset = document.querySelector('#demo-reset');
    if (reset) reset.onclick = () => {
      const targetID = owned.id;
      c.modal('Reset only the demo?', '<p>This replaces the sample created by Load Demo with its original script, breakdown, schedules, shots and PDF marks. Edits in that sample will be removed. Other productions and imported copies are unchanged. You can Undo the reset.</p>', '<button id="demo-reset-cancel">Cancel</button><button id="demo-reset-confirm" class="danger">Reset only demo</button>');
      document.querySelector('#demo-reset-cancel').onclick = () => document.querySelector('#modal').close();
      document.querySelector('#demo-reset-confirm').onclick = () => { document.querySelector('#modal').close(); load(targetID); };
    };
  }
  return {update, bind() {
    document.querySelector('#load-demo').onclick = () => load();
    document.querySelector('#demo-guide').onclick = guide;
    update();
  }};
}
