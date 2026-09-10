const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deckvaultDesktop", {
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
});