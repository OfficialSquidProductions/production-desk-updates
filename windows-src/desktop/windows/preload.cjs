const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('productionDeskWindows', {
  print: () => ipcRenderer.invoke('desk:print')
});
