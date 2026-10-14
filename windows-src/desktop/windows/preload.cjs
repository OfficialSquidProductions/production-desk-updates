const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('productionDeskWindows', {
  print: () => ipcRenderer.invoke('desk:print'),
  copyReport: text => ipcRenderer.invoke('desk:copy-report', text)
});
