const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deckvaultDesktop", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getCardTraderConfig: () => ipcRenderer.invoke("get-cardtrader-config"),
  saveCardTraderToken: (token) => ipcRenderer.invoke("save-cardtrader-token", token),
  removeCardTraderToken: () => ipcRenderer.invoke("remove-cardtrader-token"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onUpdateStatus: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },
});
