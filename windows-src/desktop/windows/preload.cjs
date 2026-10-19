const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('SquidPlatform', process.platform === 'darwin' ? 'MacBook' : 'Desktop');
contextBridge.exposeInMainWorld('SquidBuild', {version:process.argv.find(value=>value.startsWith('--squid-version='))?.slice('--squid-version='.length) || ''});
contextBridge.exposeInMainWorld('productionDeskWindows', {
  print: () => ipcRenderer.invoke('desk:print'),
  copyReport: text => ipcRenderer.invoke('desk:copy-report', text),
  openReportEmail: address => ipcRenderer.invoke('desk:report-email', address)
});
