// Native hosts supply the device/platform identity before page scripts run.
// Resizing a window must never change the platform printed in the brand.
(() => {
  const known = new Set(['iOS', 'iPad', 'MacBook', 'Desktop']);
  const hint = window.SquidPlatform;
  const agent = navigator.userAgent || '', platform = navigator.userAgentData?.platform || navigator.platform || '';
  const label = known.has(hint) ? hint
    : /iPhone|iPod/.test(agent) ? 'iOS'
    : /iPad/.test(agent) ? 'iPad'
    : /Mac/.test(platform) ? 'MacBook' : 'Desktop';
  const apply = () => {
    document.documentElement.dataset.brandPlatform = label;
    for (const node of document.querySelectorAll('[data-platform-label]')) node.textContent = label;
    const metadata = window.SquidBuild;
    if (metadata && typeof metadata.version === 'string' && metadata.version && metadata.version.length <= 64) {
      const versionLabel = document.querySelector('.sidebar-bottom small');
      if (versionLabel) versionLabel.textContent = 'PRODUCTION DESK / ' + metadata.version + (metadata.build ? ' (' + metadata.build + ')' : '');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {once:true});
  else apply();
})();
