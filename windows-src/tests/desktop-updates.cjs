const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const windowsRequire = createRequire(path.resolve(__dirname, '../desktop/windows/package.json'));
const {NsisUpdater} = windowsRequire('electron-updater/out/NsisUpdater');
const yaml = windowsRequire('js-yaml');
const {ProductionDeskUpdates, plainText, releaseNotes} = require('../desktop/windows/updates.cjs');
const candidate = (overrides = {}) => ({version:'1.5.5', releaseNotes:'<h2>Changes</h2><ul><li>Launch update notice</li><li>Keep portable projects</li></ul>',
  files:[{url:'Production-Desk-Windows-Setup.exe', sha512:Buffer.alloc(64, 3).toString('base64')}], ...overrides});
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settle(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); } assert.fail('Updater did not reach expected state'); }

function fixture(t, options = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'production-desk-update-check-'));
  t.after(() => fs.rmSync(folder, {recursive:true, force:true}));
  const updater = new NsisUpdater(undefined, {version:'1.5.4', name:'Production Desk', isPackaged:true,
    userDataPath:folder, whenReady:async () => {}});
  updater.logger = null;
  let info = options.info ?? candidate(), body, failure, requests = 0, downloads = 0, installs = 0;
  updater.httpExecutor = {request:async request => {
    requests++; assert.equal(request.protocol, 'https:'); assert.match(request.path, /latest\.yml/);
    if (failure) throw failure;
    return body ?? yaml.dump(info);
  }};
  updater._testOnlyOptions = {platform:'win32'};
  updater.setFeedURL({provider:'generic', url:'https://production-desk-fixture.invalid/'});
  updater.downloadUpdate = async () => { downloads++; updater.emit('update-downloaded', info); };
  updater.quitAndInstall = () => { throw Error('Tests must never launch an installer'); };
  const prompts = [], responses = [], scheduled = [], repeated = [];
  let enabled = true, automatic = true;
  const update = new ProductionDeskUpdates({updater, getWindow:() => ({isDestroyed:() => false}), enabled:() => enabled,
    automaticChecks:() => automatic, refreshMenu:() => {}, install:async () => { installs++; }, osVersion:'10.0.22631',
    dialog:{showMessageBox:async (_win, prompt) => { prompts.push(prompt); return {response:responses.shift() ?? 1}; }},
    schedule:(fn, ms) => { scheduled.push({fn, ms}); return {}; }, repeat:(fn, ms) => { repeated.push({fn, ms}); return {}; }});
  return {updater, update, prompts, responses, scheduled, repeated, folder,
    get requests() {return requests;}, get downloads() {return downloads;}, get installs() {return installs;},
    info(value) {info = value;}, body(value) {body = value;}, fail(value) {failure = value;}, enabled(value) {enabled = value;}, automatic(value) {automatic = value;}};
}

test('Scenic-style text, HTML and versioned changelogs remain readable and inert', () => {
  assert.equal(plainText('<h2>Changes</h2><li>Camera &amp; light</li><script>bad()</script>'), 'Changes\n\n• Camera & light');
  assert.equal(releaseNotes({releaseNotes:[null, {version:'1.5.5', note:'<p>Save &#x26; reopen</p>'}]}), 'Production Desk 1.5.5\nSave & reopen');
  assert.match(releaseNotes({}), /unavailable/);
  assert.ok(releaseNotes({releaseNotes:'X'.repeat(50000)}).length <= 16000);
});

test('launch schedules one nonblocking check after startup and respects opt-out', async t => {
  const f = fixture(t); f.update.start(); f.update.start();
  assert.equal(f.requests, 0); assert.equal(f.scheduled.length, 1); assert.equal(f.scheduled[0].ms, 0);
  assert.equal(f.repeated.length, 1); assert.equal(f.repeated[0].ms, 86400000);
  f.automatic(false); f.scheduled[0].fn(); await tick(); assert.equal(f.requests, 0);
  f.automatic(true); f.repeated[0].fn(); await settle(() => f.prompts.length === 1);
  assert.equal(f.requests, 1);
});

test('actual pinned NSIS provider rejects equal, older, incompatible and malformed releases', async t => {
  for (const info of [candidate({version:'1.5.4'}), candidate({version:'1.4.9'}), candidate({version:'bad'}),
    candidate({minimumSystemVersion:'99.0.0'}), candidate({minimumSystemVersion:'10.0.30000'}),
    candidate({minimumSystemVersion:'invalid'}), candidate({files:[]}), candidate({files:[{url:'bad.exe', sha512:'wrong'}]}),
    candidate({files:[{url:'http://example.invalid/bad.exe', sha512:Buffer.alloc(64).toString('base64')}]}), candidate({version:'1.6.0-beta.1'})]) {
    const f = fixture(t, {info}); f.update.start(); await f.update.check(false); await tick();
    assert.equal(f.prompts.length, 0, JSON.stringify(info)); assert.equal(f.downloads, 0); assert.equal(f.installs, 0);
  }
});

test('no-update, offline and invalid YAML fail quietly at launch; manual errors remain useful', async t => {
  const f = fixture(t, {info:candidate({version:'1.5.4'})}); f.update.start();
  await f.update.check(false); assert.equal(f.prompts.length, 0);
  await f.update.check(true); assert.match(f.prompts.at(-1).message, /latest compatible/);
  f.fail(Error('Offline fixture')); await f.update.check(false); assert.equal(f.prompts.length, 1);
  await f.update.check(true); assert.match(f.prompts.at(-1).message, /Could not check/);
  f.fail(null); f.body('files: [unterminated'); await f.update.check(false); assert.equal(f.prompts.length, 2);
  await f.update.check(true); assert.match(f.prompts.at(-1).message, /Could not check/);
  f.body(null); f.info(candidate({files:[]})); await f.update.check(true);
  assert.match(f.prompts.at(-1).message, /could not be validated/);
});

test('Later preserves the app and suppresses duplicate prompts until relaunch', async t => {
  const f = fixture(t); f.update.start(); await f.update.check(false); await tick();
  assert.deepEqual(f.prompts[0].buttons, ['Install Update', 'Later']);
  assert.match(f.prompts[0].detail, /Launch update notice[\s\S]*saves your work/);
  assert.equal(f.downloads, 0); assert.equal(f.installs, 0);
  await f.update.check(false); await tick(); assert.equal(f.prompts.length, 1);
  await f.update.check(true); await tick(); assert.equal(f.prompts.length, 2, 'Explicit menu check can reopen the offer');
  const relaunched = fixture(t); relaunched.update.start(); await relaunched.update.check(false); await tick();
  assert.equal(relaunched.prompts.length, 1);
});

test('Install choice routes one updater download to installation; duplicate events do not install twice', async t => {
  const f = fixture(t); f.responses.push(0); f.update.start();
  await f.update.check(false); await settle(() => f.installs === 1);
  assert.equal(f.downloads, 1); assert.equal(f.updater.autoDownload, false); assert.equal(f.updater.autoInstallOnAppQuit, false);
  f.updater.emit('update-downloaded', candidate()); f.updater.emit('update-available', candidate()); await tick();
  assert.equal(f.installs, 1); assert.equal(f.downloads, 1); assert.equal(f.prompts.length, 1);
});

test('cached download still needs consent; legacy automatic settings cannot install on exit', async t => {
  const f = fixture(t); f.updater.autoDownload = true; f.updater.autoInstallOnAppQuit = true; f.update.start();
  await f.update.downloaded(candidate()); assert.equal(f.update.ready, true); assert.equal(f.installs, 0);
  assert.equal(f.updater.autoDownload, false); assert.equal(f.updater.autoInstallOnAppQuit, false);
  await f.update.details(); assert.match(f.prompts.at(-1).detail, /Keep portable projects/);
  f.responses.push(0); await f.update.check(true); assert.equal(f.installs, 1);
});

test('download failure leaves the app open and allows an explicit retry', async t => {
  const f = fixture(t); f.updater.downloadUpdate = async () => { throw Error('Checksum mismatch fixture'); };
  f.responses.push(0); f.update.start(); await f.update.check(false);
  await settle(() => f.prompts.length === 2);
  assert.match(f.prompts[1].message, /current app is unchanged/); assert.equal(f.installs, 0);
  assert.equal(f.update.ready, false); assert.equal(f.update.consent, null);
});

test('development/beta/smoke exclusions and a closing window never initiate updates', async t => {
  const f = fixture(t); f.enabled(false); f.update.start(); await f.update.check(true);
  assert.equal(f.scheduled.length, 0); assert.equal(f.requests, 0); assert.equal(f.prompts.length, 0);
});

function mainFixture(t) {
  const f = fixture(t), menus = []; let saved = false, quits = 0, installed = 0, finishSave;
  fs.writeFileSync(path.join(f.folder, 'desktop-settings.json'), JSON.stringify({automaticChecks:false, automaticInstall:true}));
  const electron = {app:{getPath:() => f.folder, getVersion:() => '1.5.4', isPackaged:true,
      requestSingleInstanceLock:() => false, quit:() => {quits++;}},
    Menu:{buildFromTemplate:value => value, setApplicationMenu:value => {menus.push(value);}},
    dialog:{showMessageBox:async (_win, prompt) => { f.prompts.push(prompt); return {response:1}; }}};
  f.updater.quitAndInstall = (silent, restart) => {assert.equal(silent, false); assert.equal(restart, true); installed++;};
  const context = vm.createContext({Buffer, URL, require:name => name === 'electron' ? electron
    : name === 'electron-updater' ? {autoUpdater:f.updater} : name === './package.json' ? windowsRequire('./package.json')
    : name === './updates.cjs' ? {ProductionDeskUpdates:class extends ProductionDeskUpdates {
      constructor(options) {super({...options, schedule:() => ({}), repeat:() => ({})});}
    }} : require(name),
    process:{argv:[], on:() => {}}, setTimeout:() => ({}),
    fixtureWin:{isDestroyed:() => false, webContents:{executeJavaScript:async script => {
      assert.ok(['window.slateDesktop?.flush() ?? false', 'window.slateDesktop?.prepareForUpdate() ?? false'].includes(script));
      if (script.includes('prepareForUpdate')) context.preparedForUpdate = true;
      return finishSave ? new Promise(resolve => { finishSave.resolve = resolve; }) : saved;
    }}}});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../desktop/windows/main.cjs'), 'utf8'), context);
  vm.runInContext("win=fixtureWin; origin='http://127.0.0.1:55555'; configureUpdates(); buildMenu();", context);
  context.fixtureInfo = candidate();
  return {f, context, menus, get installed() {return installed;}, get quits() {return quits;},
    save(value) {saved = value;}, deferSave() {finishSave = {}; return finishSave;},
    run(code) {return vm.runInContext(code, context);}};
}

test('actual Windows main saves before NSIS; failed save, concurrent clicks and duplicate install are blocked', async t => {
  const m = mainFixture(t); await m.run('updates.downloaded(fixtureInfo)');
  await m.run('installUpdate()'); assert.equal(m.installed, 0); assert.match(m.f.prompts.at(-1).message, /Save your changes/);
  assert.equal(m.context.preparedForUpdate, true);
  const pending = m.deferSave();
  const first = m.run('installUpdate()'); await tick(); const second = m.run('installUpdate()');
  pending.resolve(true); await Promise.all([first, second]); assert.equal(m.installed, 1);
  await m.run('installUpdate()'); assert.equal(m.installed, 1);
});

test('normal Windows quit never installs, even with a saved legacy automaticInstall preference', async t => {
  const m = mainFixture(t); await m.run('updates.downloaded(fixtureInfo)'); m.save(true);
  const before = m.quits; await m.run('quitOrInstall()');
  assert.equal(m.quits, before + 1); assert.equal(m.installed, 0);
});

test('native Windows installation errors keep the saved workspace open for retry', async t => {
  const m = mainFixture(t); await m.run('updates.downloaded(fixtureInfo)'); m.save(true);
  const install = m.f.updater.quitAndInstall;
  m.f.updater.quitAndInstall = () => {m.f.updater.emit('error', Error('Native installer fixture failure'));};
  await m.run('installUpdate()'); assert.equal(m.installed, 0);
  assert.equal(m.run('quitting || closing || installing'), false);
  assert.match(m.f.prompts.at(-1).message, /could not be installed/);
  m.f.updater.quitAndInstall = install; await m.run('installUpdate()'); assert.equal(m.installed, 1);
});

test('actual editor update preparation preserves drafts with LF and CRLF source checkouts', async () => {
  const original = fs.readFileSync(path.resolve(__dirname, '../web/app.js'), 'utf8').replace(/\r\n/g, '\n');
  for (const checkout of [original, original.replace(/\n/g, '\r\n')]) {
  const source = checkout.replace(/\r\n/g, '\n');
  const start = source.indexOf('window.slateDesktop = {');
  const end = source.indexOf('\n\nasync function api', start);
  assert.ok(start > 0 && end > start);
  const draft = {value:'Unsubmitted scene text'};
  let open = true, flushes = 0, saved = true;
  const context = vm.createContext({window:{}, document:{querySelector:selector => {
    assert.equal(selector, 'dialog[open]'); return open ? draft : null;
  }}});
  vm.runInContext(source.slice(start, end), context);
  let ready = false;
  context.window.slateDesktop.ready.then(value => {ready = value;});
  await tick(); assert.equal(ready, false, 'Ready must wait for the editor');
  context.editorReady(true); await tick(); assert.equal(ready, true);
  context.window.slateDesktop.flush = async () => {flushes++; return saved;};
  assert.equal(await context.window.slateDesktop.prepareForUpdate(), false);
  assert.equal(draft.value, 'Unsubmitted scene text'); assert.equal(flushes, 0);
  open = false;
  assert.equal(await context.window.slateDesktop.prepareForUpdate(), true); assert.equal(flushes, 1);
  saved = false;
  assert.equal(await context.window.slateDesktop.prepareForUpdate(), false); assert.equal(flushes, 2);
  }
});

test('Windows package includes the updater and existing release notes in future feed artifacts', () => {
  const config = windowsRequire('./package.json');
  assert.ok(config.build.files.includes('updates.cjs'));
  const notes = path.resolve(__dirname, '../desktop/windows', config.build.releaseInfo.releaseNotesFile);
  assert.equal(notes, path.resolve(__dirname, '../desktop/release-notes.txt')); assert.ok(fs.readFileSync(notes, 'utf8').trim());
  assert.equal(config.build.publish[0].url, 'https://github.com/OfficialSquidProductions/production-desk-updates/releases/latest/download/');
  assert.equal(config.build.win.verifyUpdateCodeSignature, false, 'Preserve existing unsigned Windows distribution contract');
});
