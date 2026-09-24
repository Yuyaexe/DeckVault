const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { buildLocalUpdate, validateProject } = require('./local-update.cjs');
const exec = promisify(execFile);

function registerLocalUpdates({ app, ipcMain, dialog, BrowserWindow, shell, autoUpdater }) {
  let busy = false;
  let state = { state: 'idle', message: '' };
  const configPath = () => path.join(app.getPath('userData'), 'local-update.json');
  const readConfig = async () => {
    try { return JSON.parse(await fs.readFile(configPath(), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  };
  const saveConfig = (config) => fs.writeFile(configPath(), JSON.stringify(config));
  const send = (next) => {
    state = { ...state, ...next };
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('local-update-status', state);
  };
  function assertCaller(event) {
    if (event.senderFrame !== event.sender.mainFrame || new URL(event.senderFrame.url).origin !== 'http://127.0.0.1:3000') {
      throw new Error('Origem não autorizada.');
    }
  }
  async function chooseSource(config) {
    const result = await dialog.showOpenDialog({ title: 'Selecione a pasta do projeto DeckVault',
      defaultPath: config.source || path.join(app.getPath('desktop'), 'DeckVault'), properties: ['openDirectory'] });
    if (result.canceled) return null;
    const source = result.filePaths[0];
    await validateProject(source, app.getVersion());
    await saveConfig({ ...config, source });
    send({ source });
    return source;
  }
  async function findNode(config) {
    const candidates = [config.node, path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe')];
    try { candidates.push(...(await exec('where.exe', ['node.exe'], { windowsHide: true })).stdout.trim().split(/\r?\n/)); } catch { /* Try the standard install location. */ }
    for (const candidate of candidates.filter(Boolean)) {
      try {
        const { stdout } = await exec(candidate, ['--version'], { windowsHide: true, timeout: 5000 });
        if (/^v(2[2-9]|[3-9]\d)\./.test(stdout.trim())) return candidate;
      } catch { /* Try the next runtime. */ }
    }
    throw new Error('Instale o Node.js 22 ou mais recente para compilar os arquivos locais e reabra o DeckVault.');
  }
  ipcMain.handle('get-local-update', async (event) => {
    assertCaller(event);
    const config = await readConfig();
    if (!busy && config.job) {
      try { state = JSON.parse(await fs.readFile(path.join(config.job, 'status.json'), 'utf8')); } catch { /* No completed handoff. */ }
      if (['waiting', 'backup', 'installing'].includes(state.state)) {
        state = { ...state, state: 'error', message: 'Uma atualização anterior pode estar em andamento. Confira o log antes de tentar novamente.' };
      }
    }
    return { ...state, source: config.source, log: config.job ? path.join(config.job, 'build.log') : undefined };
  });
  ipcMain.handle('choose-local-update-source', async (event) => {
    assertCaller(event);
    if (busy) throw new Error('Já existe uma atualização em andamento.');
    busy = true;
    try { return await chooseSource(await readConfig()); }
    finally { busy = false; }
  });
  ipcMain.handle('open-local-update-log', async (event) => {
    assertCaller(event);
    const config = await readConfig();
    if (config.job) return shell.openPath(path.join(config.job, 'build.log'));
  });
  ipcMain.handle('start-local-update', async (event) => {
    assertCaller(event);
    if (!app.isPackaged || process.platform !== 'win32') throw new Error('Use este botão no aplicativo Windows instalado.');
    if (busy) throw new Error('Já existe uma atualização em andamento.');
    busy = true;
    const previousAutoInstall = autoUpdater?.autoInstallOnAppQuit;
    if (autoUpdater) autoUpdater.autoInstallOnAppQuit = false;
    let handedOff = false;
    try {
      const config = await readConfig();
      const source = config.source || await chooseSource(config);
      if (!source) return;
      const node = await findNode(config);
      await validateProject(source, app.getVersion());
      const job = await fs.mkdtemp(path.join(app.getPath('temp'), 'deckvault-local-update-'));
      await fs.writeFile(path.join(job, 'build.log'), 'Atualização local do DeckVault\r\n');
      await saveConfig({ source, node, job });
      send({ state: 'building', source, log: path.join(job, 'build.log'), message: 'Preparando atualização…' });
      const result = await buildLocalUpdate({ source, node, job, currentVersion: app.getVersion(),
        onStatus: (message) => send({ state: 'building', message }) });
      const backup = path.join(app.getPath('appData'), 'DeckVault Backups', path.basename(job));
      const installConfig = { ...result, job, backup, profile: app.getPath('userData'), executable: process.execPath, pid: process.pid };
      for (const file of ['local-update.cjs', 'local-update-install.cjs']) await fs.copyFile(path.join(__dirname, file), path.join(job, file));
      await fs.writeFile(path.join(job, 'install.json'), JSON.stringify(installConfig));
      // Flush browser storage before the helper waits for full application shutdown.
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.session.flushStorageData();
        await window.webContents.session.cookies.flushStore();
      }
      const worker = spawn(node, [path.join(job, 'local-update-install.cjs'), path.join(job, 'install.json')], {
        detached: true, windowsHide: true, stdio: 'ignore', cwd: job,
      });
      let workerError;
      worker.once('error', (error) => { workerError = error; });
      worker.unref();
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (workerError) throw workerError;
        try { ready = JSON.parse(await fs.readFile(path.join(job, 'status.json'), 'utf8')).state === 'waiting'; } catch { /* Wait for helper acknowledgement. */ }
        if (ready) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error('O assistente de instalação não iniciou. O DeckVault permanecerá aberto.');
      await fs.writeFile(path.join(job, 'install.commit'), 'install', { flag: 'wx' });
      handedOff = true;
      send({ state: 'installing', message: 'O DeckVault vai fechar para fazer backup e instalar. Ele reabrirá ao terminar.' });
      setTimeout(() => app.quit(), 1200);
    } catch (error) {
      send({ state: 'error', message: error.message });
      throw error;
    } finally {
      if (!handedOff) {
        busy = false;
        if (autoUpdater) autoUpdater.autoInstallOnAppQuit = previousAutoInstall;
      }
    }
  });
  return { isBusy: () => busy };
}

module.exports = { registerLocalUpdates };
