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
        const response = await fetch('/demo/the-last-cue.productiondesk');
        if (!response.ok) throw Error('The offline demo file is missing.');
        const file = new File([await response.arrayBuffer()], 'The-Last-Cue.productiondesk', {type:'application/json'});
        const result = await c.importFile(file);
        incoming = result.workspace;
      }
      const plan = planDemo(c.workspace(), incoming, resetID);
      c.apply(plan.workspace);
      if (!await c.flush()) throw Error('The demo is open but its save failed. Retry Save before closing.');
      c.toast(plan.reset ? 'Only the sample was reset. Other productions and imported copies are unchanged. Undo is available.' : plan.created ? 'The Last Cue demo added separately. Your existing productions are preserved.' : 'Opened your existing demo, keeping all edits.');
    } catch (error) { c.toast('Demo: ' + error.message); }
    finally { busy = false; update(); }
  }
  function guide() {
    if (!DEMO_ENABLED || !c.workspace()) return;
    const owned = managedDemo(c.workspace());
    c.modal('Demo production · The Last Cue', `<p>An offline fictional rehearsal matching Scenic: Maya calls lighting cue twelve, Leo selects thirteen, and they reset together. Scene 1 and shots 1A–1D match the Scenic demo.</p><ol class="help-steps"><li><strong>Main breakdown:</strong> read the script, tag Maya/Leo and the notebook, lamp, set and lighting equipment; edit the sheet and review flag.</li><li><strong>Shooting schedule:</strong> compare the rehearsal shoot with the unscheduled alternate; move strips, change colors, and review calendars and availability.</li><li><strong>Shot list:</strong> inspect cameras A–D, lenses 24/50/85/35 mm and setup/shoot times. Try a take, completion status or reorder, then Undo.</li><li><strong>Lined script:</strong> the original two-page demo PDF is bundled with linked coverage, pen, highlighter, arrow and note samples. Edit a mark or export a lined PDF.</li><li><strong>Elements and reports:</strong> inspect cast, props, set dressing and departments; open the one-line, breakdown and day-out-of-days reports.</li><li><strong>Portable files:</strong> Save As a .productiondesk file, import a separate copy, and compare the script, PDF, marks, schedules and shots. Export CSV or USS, or open Print / PDF.</li></ol><p>Load Demo reopens this sample without replacing edits or adding duplicates. Reset replaces only the demo created in this workspace; imported copies and other productions are preserved. Delete it normally in Production settings when finished.</p>`, `<button id="demo-guide-close">Close</button>${owned ? '<button id="demo-reset" class="danger">Reset demo…</button>' : ''}<button id="demo-guide-open" class="primary">${owned ? 'Open demo' : 'Load Demo'}</button>`);
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
