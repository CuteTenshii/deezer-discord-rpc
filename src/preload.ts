// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deezerRpc', {
  updateActivity: (currentTimeChanged: boolean) => {
    if (typeof currentTimeChanged === 'boolean')
      ipcRenderer.send('update_activity', currentTimeChanged);
  },
  navigateBack: () => ipcRenderer.send('nav_back'),
  navigateForward: () => ipcRenderer.send('nav_forward'),
  retryLoad: () => ipcRenderer.send('retry_load'),
});
