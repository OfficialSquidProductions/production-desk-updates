(() => {
  'use strict';
  const recipient = 'alexanderhosier@squidproductions.org';
  let pending = null, dialog, notice, recording = false, stateRevision = 0, openSerial = 0;
  let initialLoad = Promise.resolve();
  const boundedText = (value, limit) => Array.from(String(value)).slice(0, limit).join('');
  const version = () => document.querySelector('.sidebar-bottom small')?.textContent.replace('PRODUCTION DESK / ', '') || 'unknown';
  async function request(value) {
    const response = await fetch('/api/support', value === undefined ? {} : {
      method: 'POST', headers: {'Content-Type':'application/json', 'X-Slate-Local':'1'}, body: JSON.stringify(value)
    });
    if (!response.ok) throw new Error('Crash details could not be saved locally.');
    return response.json();
  }
  function summary(report) {
    return report ? [`Recorded: ${report.time}`, `Problem: ${report.kind}`, report.message,
      report.location ? `Location: ${report.location}` : '', report.version ? `Version at failure: ${report.version}` : ''].filter(Boolean).join('\n') : 'No automatically recorded crash is available.';
  }
  function body() {
    return `Production Desk ${dialog.dataset.kind} report\n\nWhat happened:\n${dialog.querySelector('textarea').value.trim()}\n\nTechnical details:\n${dialog.querySelector('pre').textContent}`;
  }
  function updateDraft() {
    const description = dialog.querySelector('textarea').value.trim();
    const link = dialog.querySelector('#support-email');
    link.hidden = !description;
    link.href = `mailto:${recipient}?subject=${encodeURIComponent(`Production Desk ${version()} — ${dialog.dataset.kind} report`)}&body=${encodeURIComponent(body())}`;
  }
  function open(kind) {
    if (!dialog) mount();
    dialog.dataset.kind = kind;
    dialog.querySelector('h2').textContent = kind === 'crash' ? 'Report a crash' : 'Report a bug';
    dialog.querySelector('textarea').value = '';
    dialog.querySelector('pre').textContent = `Production Desk ${version()}\nPlatform: ${navigator.userAgent}\nReport created: ${new Date().toISOString()}${kind === 'crash' ? '\n\n' + summary(pending) : ''}`;
    dialog.querySelector('#support-status').textContent = '';
    dialog.querySelector('#support-discard').hidden = kind !== 'crash' || !pending;
    updateDraft();
    const serial = ++openSerial;
    initialLoad.then(() => {
      if (kind !== 'crash' || !dialog.open || serial !== openSerial) return;
      dialog.querySelector('pre').textContent = `Production Desk ${version()}\nPlatform: ${navigator.userAgent}\nReport created: ${new Date().toISOString()}\n\n${summary(pending)}`;
      dialog.querySelector('#support-discard').hidden = !pending;
      updateDraft();
    });
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('textarea').focus();
  }
  function showNotice() {
    if (!notice || !pending) return;
    notice.hidden = false;
  }
  function mount() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'support-report';
    dialog.setAttribute('aria-labelledby', 'support-title');
    dialog.innerHTML = `<div class="modal-header"><h2 id="support-title">Report a bug</h2><button type="button" id="support-close" aria-label="Close report">×</button></div>
      <div class="modal-body"><p>To: <strong>${recipient}</strong></p><label class="field">What happened? (required)<textarea id="support-description" rows="5" maxlength="1800" required placeholder="Describe what you were doing, what you expected, and what happened. For a crash, include the last steps before it stopped."></textarea></label>
      <p class="tiny">Your description and the technical details below will be included. No scripts, productions, PDFs, or log files are attached automatically.</p>
      <details open><summary>Technical details included in the report</summary><pre></pre></details><p id="support-status" role="status"> </p></div>
      <div class="modal-footer"><button type="button" id="support-discard" hidden>Dismiss saved crash report</button><button type="button" id="support-copy">Copy report</button><button type="button" id="support-save">Save report…</button><a class="support-email" id="support-email" hidden>Open email draft</a></div>`;
    document.body.append(dialog);
    dialog.querySelector('#support-close').onclick = () => dialog.close();
    dialog.querySelector('textarea').oninput = updateDraft;
    const requireDescription = () => {
      const field = dialog.querySelector('textarea');
      if (field.value.trim()) return true;
      field.value = ''; field.reportValidity(); field.focus(); return false;
    };
    dialog.querySelector('#support-discard').onclick = async () => {
      try {
        await request({action:'clear'}); stateRevision++; pending = null; notice.hidden = true;
        dialog.querySelector('#support-discard').hidden = true;
        dialog.querySelector('pre').textContent = `Production Desk ${version()}\nPlatform: ${navigator.userAgent}\n\n${summary(null)}`;
        dialog.querySelector('#support-status').textContent = 'Saved crash report dismissed.'; updateDraft();
      } catch { dialog.querySelector('#support-status').textContent = 'The saved crash report could not be dismissed.'; }
    };
    dialog.querySelector('#support-copy').onclick = async () => {
      if (!requireDescription()) return;
      try {
        if (window.productionDeskWindows?.copyReport) await window.productionDeskWindows.copyReport(body());
        else if (window.webkit?.messageHandlers?.supportCopy) await window.webkit.messageHandlers.supportCopy.postMessage(body());
        else await navigator.clipboard.writeText(body());
        dialog.querySelector('#support-status').textContent = 'Report copied. Paste it into an email when ready.';
      }
      catch { dialog.querySelector('#support-status').textContent = 'Clipboard unavailable. Use Save report, or select and copy the text.'; }
    };
    dialog.querySelector('#support-save').onclick = async () => {
      if (!requireDescription()) return;
      try {
        const response = await fetch('/api/support/export', {method:'POST', headers:{'Content-Type':'application/json','X-Slate-Local':'1'}, body:JSON.stringify({content:body()})});
        if (!response.ok) throw new Error();
        const result = await response.json();
        const link = document.createElement('a'); link.href = result.url; link.download = 'Production-Desk-support-report.txt'; document.body.append(link); link.click(); link.remove();
      } catch { dialog.querySelector('#support-status').textContent = 'The report could not be saved. You can still copy its text or open an email draft.'; }
    };
    notice = document.createElement('section'); notice.id = 'support-notice'; notice.hidden = true; notice.setAttribute('role','status');
    notice.innerHTML = '<span>Production Desk recorded an unexpected problem.</span><button type="button">Review crash report</button><button type="button" aria-label="Hide crash notification">Not now</button>';
    notice.querySelectorAll('button')[0].onclick = () => open('crash');
    notice.querySelectorAll('button')[1].onclick = () => { notice.hidden = true; };
    document.body.append(notice);
    const revision = stateRevision;
    initialLoad = request().then(result => { if (revision === stateRevision) pending = result.report; showNotice(); }).catch(() => {});
  }
  function record(kind, message, source, line) {
    if (recording) return;
    let location = '';
    try { location = source ? new URL(source, locationHref()).pathname.split('/').pop() : ''; } catch {}
    if (line) location += `:${line}`;
    const revision = ++stateRevision;
    pending = {kind, message:boundedText(message || 'Unexpected application error',500), location:boundedText(location,150), time:new Date().toISOString(), version:version()};
    showNotice();
    recording = true;
    request({action:'record', report:pending}).then(result => { if (revision === stateRevision) pending = result.report; }).catch(() => {}).finally(() => {recording = false;});
  }
  function locationHref() { return window.location.href; }
  window.addEventListener('error', event => {
    if (event instanceof ErrorEvent) record('script', event.message, event.filename, event.lineno);
  });
  window.addEventListener('unhandledrejection', event => record('promise', event.reason instanceof Error ? event.reason.message : 'An asynchronous operation failed unexpectedly.'));
  window.productionDeskSupport = {
    open,
    attachSettings(parent) {
      const section = document.createElement('section'); section.className = 'support-settings';
      section.innerHTML = `<h3>Help &amp; reports</h3><p>Tell us about a problem at <a href="mailto:${recipient}">${recipient}</a>.</p><div><button type="button" id="report-bug">Report a bug…</button><button type="button" id="report-crash">Report a crash…</button></div>`;
      parent.append(section);
      section.querySelector('#report-bug').onclick = () => open('bug');
      section.querySelector('#report-crash').onclick = () => open('crash');
    }
  };
  document.addEventListener('DOMContentLoaded', mount);
})();
