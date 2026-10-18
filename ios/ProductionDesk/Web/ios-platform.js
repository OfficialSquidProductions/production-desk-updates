// Custom WebKit schemes are local origins. Keep the standard UUID API available
// on iOS versions that limit randomUUID() to HTTPS secure contexts.
// Apply the saved choice before the editor's first paint, then keep UIKit's
// safe areas and WebKit's under-page surface in the same palette as the DOM.
if (window.webkit?.messageHandlers?.scheduler) {
  try { document.documentElement.dataset.theme = localStorage.getItem('productionDeskTheme') === 'dark' ? 'dark' : 'light'; } catch {}
  let lastAppearance = '';
  const syncAppearance = () => {
    const root = document.documentElement, styles = getComputedStyle(root);
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const fixedSidebar = getComputedStyle(sidebar).position === 'fixed';
    const appearance = {operation:'appearance', theme:root.dataset.theme === 'dark' ? 'dark' : 'light',
      background:styles.getPropertyValue('--bg').trim(), sidebar:styles.getPropertyValue('--sidebar').trim(),
      paper:styles.getPropertyValue('--paper').trim(), fixedSidebar,
      sidebarFraction:fixedSidebar ? sidebar.getBoundingClientRect().width / innerWidth : 1};
    const key = JSON.stringify(appearance);
    if (key === lastAppearance) return;
    lastAppearance = key;
    window.webkit.messageHandlers.scheduler.postMessage(appearance).catch(() => { lastAppearance = ''; });
  };
  document.addEventListener('DOMContentLoaded', () => {
    syncAppearance();
    new MutationObserver(syncAppearance).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
    new ResizeObserver(syncAppearance).observe(document.querySelector('.sidebar'));
    window.addEventListener('resize', syncAppearance);
    window.addEventListener('pageshow', syncAppearance);
  }, {once:true});
}
if (!crypto.randomUUID) {
  crypto.randomUUID = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  };
}
