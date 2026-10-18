const os = require('node:os');

// Match Scenic's native, plain-text release notes. Feed markup is never executed.
function plainText(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 100000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<li\b[^>]*>/gi, '\n• ').replace(/<\/(?:p|h[1-6]|ul|ol|div)>|<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
      const key = entity.toLowerCase();
      if (key[0] !== '#') return {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' '}[key];
      const code = key[1] === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 16000);
}
function releaseNotes(info) {
  const notes = info?.releaseNotes;
  const text = Array.isArray(notes) ? notes.slice(0, 20).map(entry => {
    const body = plainText(entry?.note);
    return body ? `Production Desk ${plainText(entry?.version).slice(0, 80)}\n${body}` : '';
  }).filter(Boolean).join('\n\n') : plainText(notes);
  return text.slice(0, 16000) || 'Release notes are unavailable for this update.';
}
function updateDetail(info) {
  return `What's new in Production Desk ${info.version}\n\n${releaseNotes(info)}\n\nInstall Update downloads the update, saves your work and restarts Production Desk. Later keeps your current app open.`;
}

// electron-updater retains ownership of the existing generic feed, version
// selection, SHA-512 verification, download cache and NSIS installation.
class ProductionDeskUpdates {
  constructor({updater, dialog, getWindow, enabled, automaticChecks, refreshMenu, install,
    osVersion = os.release(), schedule = setTimeout, repeat = setInterval}) {
    Object.assign(this, {updater, dialog, getWindow, enabled, automaticChecks, refreshMenu, install, osVersion, schedule, repeat});
    this.started = false; this.checking = false; this.prompting = false; this.downloading = false;
    this.available = null; this.ready = false; this.consent = null; this.offered = new Set();
  }

  valid(info) {
    try {
      const Version = this.updater.currentVersion.constructor;
      const candidate = new Version(info.version);
      if (candidate.prerelease.length || candidate.compare(this.updater.currentVersion) <= 0) return false;
      if (info.minimumSystemVersion != null) {
        const minimum = new Version(info.minimumSystemVersion);
        if (minimum.prerelease.length || new Version(this.osVersion).compare(minimum) < 0) return false;
      }
      // Reject incomplete manifests before offering an action that cannot work.
      return Array.isArray(info.files) && info.files.length > 0 && info.files.every(file => {
        if (typeof file?.url !== 'string' || typeof file.sha512 !== 'string') return false;
        const url = new URL(file.url, 'https://github.com/');
        return url.protocol === 'https:' && !url.username && !url.password && /\.exe$/i.test(url.pathname)
          && /^[A-Za-z0-9+/]{86}==$/.test(file.sha512) && Buffer.from(file.sha512, 'base64').length === 64;
      });
    } catch { return false; }
  }

  start() {
    if (this.started || !this.enabled()) return;
    this.started = true;
    // Old automaticInstall preferences never authorize a silent install.
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.allowDowngrade = false;
    this.updater.allowPrerelease = false;
    this.updater.disableWebInstaller = true;
    this.updater.on('error', () => {}); // Automatic checks fail quietly; explicit operations report below.
    this.updater.on('update-not-available', () => {
      if (this.manual) void this.show({message:'You have the latest compatible version of Production Desk.', buttons:['OK']});
    });
    this.updater.on('update-available', info => { void this.offer(info, this.manual).catch(() => {}); });
    this.updater.on('update-downloaded', info => { void this.downloaded(info).catch(() => {}); });
    this.schedule(() => { if (this.automaticChecks()) void this.check(false); }, 0).unref?.();
    this.repeat(() => { if (this.automaticChecks()) void this.check(false); }, 86400000).unref?.();
  }

  async show(options) {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) return {response:1};
    return this.dialog.showMessageBox(window, {title:'Production Desk Update', defaultId:0, cancelId:(options.buttons?.length ?? 2) - 1, ...options});
  }

  async check(manual = false) {
    if (!this.enabled() || this.checking || this.prompting || this.downloading) return;
    if (this.ready) { if (manual) await this.offer(this.available, true); return; }
    this.checking = true; this.manual = manual;
    try {
      const result = await this.updater.checkForUpdates();
      if (manual && result?.isUpdateAvailable && !this.valid(result.updateInfo)) {
        await this.show({type:'warning', message:'The update information could not be validated.', detail:'Keep using your current app and check again later.', buttons:['OK']});
      }
    }
    catch (error) {
      if (manual) await this.show({type:'warning', message:'Could not check for updates.', detail:plainText(error.message), buttons:['OK'], cancelId:0});
    } finally { this.checking = false; this.manual = false; }
  }

  async offer(info, manual = false) {
    if (!this.enabled() || !this.valid(info) || this.prompting || this.downloading) return;
    if (this.ready && this.available?.version !== info.version) return;
    if (!manual && this.offered.has(info.version)) return;
    this.available = info; this.offered.add(info.version); this.refreshMenu(); this.prompting = true;
    let response;
    try {
      ({response} = await this.show({message:`Production Desk ${info.version} ${this.ready ? 'is ready to install.' : 'is available.'}`,
        detail:updateDetail(info), buttons:['Install Update', 'Later']}));
    } finally { this.prompting = false; }
    if (response !== 0 || !this.enabled()) return;
    this.consent = info.version;
    if (this.ready) { await this.install(); return; }
    this.downloading = true; this.refreshMenu();
    try { await this.updater.downloadUpdate(); }
    catch (error) {
      this.consent = null;
      await this.show({type:'warning', message:'Update download failed. Your current app is unchanged.', detail:plainText(error.message), buttons:['OK'], cancelId:0});
    } finally { this.downloading = false; this.refreshMenu(); }
  }

  async downloaded(info) {
    if (!this.enabled() || !this.valid(info) || this.ready) return;
    if (this.available && info.version !== this.available.version) return;
    this.available = info; this.ready = true; this.refreshMenu();
    if (this.consent === info.version) await this.install();
    else await this.offer(info);
  }

  async details() {
    if (this.available) await this.show({message:`Production Desk ${this.available.version}`, detail:updateDetail(this.available), buttons:['OK'], cancelId:0});
  }
}
module.exports = {ProductionDeskUpdates, plainText, releaseNotes, updateDetail};
