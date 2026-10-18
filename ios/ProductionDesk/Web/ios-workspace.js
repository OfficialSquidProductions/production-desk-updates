// Pane changes only alter visibility; editor nodes, input handlers and their
// scroll positions survive. Layout changes never redraw the production.
let current, activePane = 'script', scriptRange;
const compact = matchMedia('(max-width: 1100px)');

function rememberSelection() {
  const selection = getSelection(), text = current?.querySelector('#script-text');
  if (selection?.rangeCount && text?.contains(selection.anchorNode) && text.contains(selection.focusNode)) {
    scriptRange = selection.getRangeAt(0).cloneRange();
  }
}
function update() {
  if (!current?.isConnected) return;
  const enabled = !!window.productionDeskTablet && window.productionDeskPortrait === true && compact.matches;
  current.classList.toggle('single-pane', enabled);
  for (const pane of ['script', 'breakdown']) {
    const panel = current.querySelector('#workspace-' + pane);
    panel.setAttribute('role', enabled ? 'tabpanel' : 'region');
    const scroll = panel.querySelector('.script-scroll, .breakdown-scroll');
    if (!panel.hidden && scroll) panel.savedScrollTop = scroll.scrollTop;
    panel.hidden = enabled && pane !== activePane;
    if (!panel.hidden && scroll) scroll.scrollTop = panel.savedScrollTop || 0;
    const tab = current.querySelector('[data-workspace-pane="' + pane + '"]');
    tab.setAttribute('aria-selected', String(pane === activePane));
    tab.tabIndex = pane === activePane ? 0 : -1;
  }
}
window.addEventListener('productiondesk-layout', update);
compact.addEventListener('change', update);

export function bindWorkspacePanes(root) {
  current = root; scriptRange = undefined;
  if (!root) return;
  const tabs = [...root.querySelectorAll('[data-workspace-pane]')];
  for (const tab of tabs) {
    tab.addEventListener('pointerdown', rememberSelection);
    tab.addEventListener('click', () => {
      rememberSelection();
      activePane = tab.dataset.workspacePane;
      update();
      if (activePane === 'script' && scriptRange?.startContainer.isConnected) {
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(scriptRange);
      }
    });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[1] : tabs[1 - tabs.indexOf(tab)];
      next.click(); next.focus();
    });
  }
  update();
}
