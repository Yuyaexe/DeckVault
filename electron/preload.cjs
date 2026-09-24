const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deckvaultDesktop", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getCardTraderConfig: () => ipcRenderer.invoke("get-cardtrader-config"),
  saveCardTraderToken: (token) => ipcRenderer.invoke("save-cardtrader-token", token),
  removeCardTraderToken: () => ipcRenderer.invoke("remove-cardtrader-token"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  getLocalUpdate: () => ipcRenderer.invoke("get-local-update"),
  chooseLocalUpdateSource: () => ipcRenderer.invoke("choose-local-update-source"),
  startLocalUpdate: () => ipcRenderer.invoke("start-local-update"),
  openLocalUpdateLog: () => ipcRenderer.invoke("open-local-update-log"),
  onLocalUpdateStatus: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("local-update-status", handler);
    return () => ipcRenderer.removeListener("local-update-status", handler);
  },
  onUpdateStatus: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },
});
