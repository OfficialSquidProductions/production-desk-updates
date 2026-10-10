const {app, BrowserWindow, Menu, dialog, shell, ipcMain} = require('electron');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {autoUpdater} = require('electron-updater');

const smokeIndex = process.argv.indexOf('--smoke-test');
const smokeResult = smokeIndex >= 0 ? path.resolve(process.argv[smokeIndex + 1]) : null;
if (smokeResult) app.setPath('userData', path.join(path.dirname(smokeResult), 'smoke-user-data'));
const dataFolder = app.getPath('userData');
const settingsFile = path.join(dataFolder, 'desktop-settings.json');
let settings = {automaticChecks:true, automaticInstall:false};
try { Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile, 'utf8'))); } catch {}
let win, backend, origin, temporary, quitting = false, closing = false, checking = false;
let updateReady = false, manualCheck = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function persistSettings() {
  fs.mkdirSync(dataFolder, {recursive:true});
  const tmp = settingsFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings));
  fs.renameSync(tmp, settingsFile);
}
function localAddress(address) {
  try { return new URL(address).origin === origin; } catch { return false; }
}
async function external(address) {
  try {
    if (['https:', 'mailto:'].includes(new URL(address).protocol)) await shell.openExternal(address);
  } catch {}
}
async function flush() {
  if (!win || win.isDestroyed() || !origin) return true;
  try {
    return await Promise.race([
      win.webContents.executeJavaScript('window.slateDesktop?.flush() ?? false'),
      delay(20000).then(() => false)
    ]) === true;
  } catch { return false; }
}
async function canClose() {
  if (await flush()) return true;
  const {response} = await dialog.showMessageBox(win, {
    type:'warning', title:'Changes have not been saved',
    message:'Your latest changes have not been saved.',
    detail:'Keep Production Desk open to retry saving or export a backup.',
    buttons:['Keep Working', 'Quit Without Saving'], defaultId:0, cancelId:0
  });
  return response === 1;
}
async function quitOrInstall() {
  if (closing || quitting) return;
  closing = true;
  const saved = await flush();
  const allowed = saved || await canClose();
  if (allowed) {
    quitting = true;
    // Updates always require a successful save, even if the user chooses to quit unsaved.
    if (saved && updateReady && settings.automaticInstall) autoUpdater.quitAndInstall(false, true);
    else app.quit();
  }
  closing = false;
}
async function installUpdate() {
  if (!updateReady || closing) return;
  closing = true;
  if (await flush()) {
    quitting = true;
    autoUpdater.quitAndInstall(false, true);
  } else {
    await dialog.showMessageBox(win, {type:'warning', message:'Save your changes before installing the update.',
      detail:'Retry saving or export a backup, then choose Continue Installing Update.'});
  }
  closing = false;
}
async function printReport() {
  const {response} = await dialog.showMessageBox(win, {message:'Print or save this report',
    buttons:['Print…', 'Save PDF…', 'Cancel'], cancelId:2});
  if (response === 0) {
    win.webContents.print({printBackground:true}, (success, reason) => {
      if (!success && reason !== 'cancelled') dialog.showErrorBox('Printing failed', reason);
    });
  } else if (response === 1) {
    const result = await dialog.showSaveDialog(win, {defaultPath:'Production-Desk-report.pdf',
      filters:[{name:'PDF document', extensions:['pdf']}]});
    if (!result.canceled) {
      const bytes = await win.webContents.printToPDF({printBackground:true, preferCSSPageSize:true});
      await fs.promises.writeFile(result.filePath, bytes);
    }
  }
}
async function click(selector) {
  if (win && origin) await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)})?.click()`);
}
function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Production Desk', submenu:[
      {label:'About Production Desk', click:() => dialog.showMessageBox(win, {
        message:`Production Desk ${app.getVersion()}`, detail:'Offline film scheduling by Squid Productions.\nWindows x64'})},
      {label:'Check for Updates…', click:() => checkUpdates(true)},
      {label:'Continue Installing Update…', enabled:updateReady, click:installUpdate},
      {label:'Updates', submenu:[
        {label:'Automatically Check for Updates', type:'checkbox', checked:settings.automaticChecks,
          click:item => {settings.automaticChecks=item.checked; persistSettings();}},
        {label:'Automatically Download and Install Updates on Exit', type:'checkbox', checked:settings.automaticInstall,
          click:item => {settings.automaticInstall=item.checked; autoUpdater.autoDownload=item.checked;
            persistSettings(); if(item.checked) checkUpdates(false);}}
      ]},
      {label:'Open Data Folder', click:() => shell.openPath(dataFolder)},
      {type:'separator'}, {label:'Quit Production Desk', accelerator:'Ctrl+Q', click:quitOrInstall}
    ]},
    {label:'File', submenu:[
      {label:'Import Script / USS…', click:() => click('#import-open')},
      {label:'Export…', click:() => click('#export-open')},
      {label:'Save', accelerator:'Ctrl+S', click:() => click('#save-status')},
      {label:'Print Schedule…', accelerator:'Ctrl+P', click:() => win.webContents.executeJavaScript('window.slateDesktop.print()')}
    ]},
    {label:'Edit', submenu:[
      {label:'Undo', accelerator:'Ctrl+Z', click:() => editUndo(false)},
      {label:'Redo', accelerator:'Ctrl+Shift+Z', click:() => editUndo(true)},
      {type:'separator'}, {role:'cut'}, {role:'copy'}, {role:'paste'}, {role:'selectAll'}
    ]},
    {label:'View', submenu:[{role:'resetZoom'}, {role:'zoomIn'}, {role:'zoomOut'}, {role:'togglefullscreen'}]},
    {label:'Help', submenu:[{label:'Quick Guide', click:() => click('#help-open')},
      {label:'Report a Bug', click:() => external('mailto:alexanderhosier@squidproductions.org')}]}
  ]));
}
async function editUndo(redo) {
  const editing = await win.webContents.executeJavaScript('/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)');
  if (editing) win.webContents[redo ? 'redo' : 'undo']();
  else await click(redo ? '#redo' : '#undo');
}
async function checkUpdates(manual) {
  if (checking || !app.isPackaged || smokeResult) return;
  checking = true; manualCheck = manual;
  try { await autoUpdater.checkForUpdates(); }
  catch (error) {
    if (manual) await dialog.showMessageBox(win, {type:'warning', message:'Could not check for updates.', detail:error.message});
  } finally { checking = false; manualCheck = false; }
}
function configureUpdates() {
  autoUpdater.autoDownload = settings.automaticInstall;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('error', () => {});
  autoUpdater.on('update-not-available', () => {
    if (manualCheck) dialog.showMessageBox(win, {message:'You have the latest version of Production Desk.'});
  });
  autoUpdater.on('update-available', async info => {
    if (autoUpdater.autoDownload) return;
    const {response} = await dialog.showMessageBox(win, {message:`Production Desk ${info.version} is available.`,
      buttons:['Download Update', 'Later'], cancelId:1});
    if (response === 0) {
      try { await autoUpdater.downloadUpdate(); }
      catch (error) { dialog.showErrorBox('Update download failed', error.message); }
    }
  });
  autoUpdater.on('update-downloaded', async () => {
    updateReady = true; buildMenu();
    if (settings.automaticInstall) return;
    const {response} = await dialog.showMessageBox(win, {message:'The update is ready to install.',
      detail:'Production Desk will save your work and restart.', buttons:['Install and Restart', 'Later'], cancelId:1});
    if (response === 0) await installUpdate();
  });
  if (!smokeResult) {
    setTimeout(() => {if(settings.automaticChecks) checkUpdates(false);}, 15000).unref();
    setInterval(() => {if(settings.automaticChecks) checkUpdates(false);}, 86400000).unref();
  }
}
async function start() {
  fs.mkdirSync(dataFolder, {recursive:true});
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'production-desk-'));
  const readyFile = path.join(temporary, 'ready.json');
  const executable = path.join(process.resourcesPath, 'backend', 'ProductionDeskServer.exe');
  backend = spawn(executable, ['--port','0','--data',path.join(dataFolder,'workspace.json'),
    '--ready-file',readyFile,'--parent-pid',String(process.pid)], {windowsHide:true, stdio:['ignore','pipe','pipe']});
  const log = fs.createWriteStream(path.join(dataFolder,'server.log'), {flags:'a'});
  backend.stdout.pipe(log); backend.stderr.pipe(log);
  let startupError;
  backend.on('error', error => {startupError=error;});
  backend.on('exit', code => {
    log.end();
    if (!quitting) startupError = new Error(`Local server stopped (${code}).`);
    if (!quitting && win) dialog.showErrorBox('Production Desk server stopped', 'Your saved workspace is safe. Restart Production Desk to continue.');
  });
  const deadline = Date.now() + 30000;
  while (!fs.existsSync(readyFile)) {
    if (startupError) throw startupError;
    if (Date.now() > deadline) throw new Error('The local server did not start within 30 seconds.');
    await delay(100);
  }
  origin = JSON.parse(fs.readFileSync(readyFile,'utf8')).url;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Invalid local server address.');
  const bounds = settings.bounds || {};
  win = new BrowserWindow({width:bounds.width || 1440, height:bounds.height || 940,
    minWidth:900, minHeight:650, title:'Production Desk', backgroundColor:'#191419', show:!smokeResult,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'), nodeIntegration:false,
      contextIsolation:true, sandbox:true, spellcheck:false}});
  win.webContents.setWindowOpenHandler(({url}) => {external(url); return {action:'deny'};});
  win.webContents.on('will-navigate', (event, address) => {if(!localAddress(address)){event.preventDefault(); external(address);}});
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.on('will-download', (_event, item) => {
    if (!localAddress(item.getURL())) {item.cancel(); return;}
    if (smokeResult) item.setSavePath(path.join(path.dirname(smokeResult), item.getFilename()));
    else item.setSaveDialogOptions({title:'Export Production Desk file', defaultPath:item.getFilename()});
    item.once('done', (_event, state) => {
      if(state === 'interrupted') dialog.showErrorBox('Export failed', 'The file could not be saved. Export it again.');
    });
  });
  win.on('close', event => {if(!quitting){event.preventDefault(); quitOrInstall();}});
  win.on('resize', () => {if(!win.isMaximized()){settings.bounds=win.getBounds(); persistSettings();}});
  ipcMain.handle('desk:print', async event => {
    if(event.sender !== win.webContents || !localAddress(event.senderFrame.url)) throw new Error('Local window required.');
    try { await printReport(); } catch(error) { dialog.showErrorBox('PDF export failed',error.message); }
  });
  buildMenu(); configureUpdates();
  await win.loadURL(origin);
  if (smokeResult) {
    try {
      const result = await require('./smoke.cjs')({win, origin, dataFolder, output:path.dirname(smokeResult), flush});
      fs.writeFileSync(smokeResult, JSON.stringify(result, null, 2));
      quitting = true; app.quit();
    } catch (error) {
      fs.writeFileSync(smokeResult, JSON.stringify({passed:false, error:error.stack}));
      quitting = true; app.exit(1);
    }
  }
}
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on('second-instance', () => {if(win){if(win.isMinimized())win.restore(); win.focus();}});
  app.on('before-quit', event => {if(!quitting){event.preventDefault(); quitOrInstall();}});
  app.on('will-quit', () => {
    if(backend) backend.kill();
    if(temporary) fs.rmSync(temporary, {recursive:true, force:true});
  });
  app.whenReady().then(start).catch(error => {
    if(smokeResult) fs.writeFileSync(smokeResult, JSON.stringify({passed:false, error:error.stack}));
    else dialog.showErrorBox('Production Desk could not start',error.message);
    quitting=true; app.quit();
  });
}
