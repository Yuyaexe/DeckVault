const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const Module = require("node:module");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = 3000;
const startupLog = path.join(app.getPath("temp"), "deckvault-startup.log");

function logStartupError(error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  fs.appendFileSync(startupLog, `${new Date().toISOString()}\n${message}\n\n`);
  dialog.showErrorBox("DeckVault não conseguiu iniciar", `${message}\n\nLog: ${startupLog}`);
}

function getStandaloneDirectory() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ".next", "standalone");
  }

  return path.join(__dirname, "..", ".next", "standalone");
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Next.js server did not start at ${url}`));
          return;
        }

        setTimeout(check, 250);
      });
    };

    check();
  });
}

function startNextServer() {
  const standaloneDirectory = getStandaloneDirectory();
  const serverPath = path.join(standaloneDirectory, "server.js");

  if (!fs.existsSync(serverPath)) {
    throw new Error(`Next.js server not found: ${serverPath}`);
  }

  process.chdir(standaloneDirectory);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.PORT = String(PORT);
  const appNodeModules = path.join(process.resourcesPath, "app.asar", "node_modules");
  process.env.NODE_PATH = [path.join(standaloneDirectory, "node_modules"), appNodeModules]
    .filter((directory) => fs.existsSync(directory))
    .join(path.delimiter);
  Module._initPaths();
  require(serverPath);
}

async function createWindow() {
  startNextServer();
  await waitForServer(`http://127.0.0.1:${PORT}/collection`);

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "DeckVault",
    show: true,
    backgroundColor: "#121318",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logStartupError(new Error(`Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`));
  });
  await window.loadURL(`http://127.0.0.1:${PORT}/collection`);
  checkForUpdates();
}

function checkForUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("update-downloaded", async () => {
    const result = await dialog.showMessageBox({
      type: "info",
      buttons: ["Reiniciar agora", "Mais tarde"],
      defaultId: 0,
      cancelId: 1,
      title: "Atualização disponível",
      message: "Uma nova versão do DeckVault foi baixada.",
      detail: "Reinicie o aplicativo agora para concluir a atualização.",
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
  autoUpdater.checkForUpdates().catch((error) => {
    fs.appendFileSync(
      startupLog,
      `${new Date().toISOString()}\nUpdate check failed: ${error.stack || error.message}\n\n`,
    );
  });
}

app.whenReady().then(createWindow).catch((error) => {
  logStartupError(error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
