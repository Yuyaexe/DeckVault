// Copied outside the installation before launch so NSIS can replace the application.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { backupProfile, runCommand } = require('./local-update.cjs');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function install(config) {
  let parentClosed = false;
  const statusFile = path.join(config.job, 'status.json');
  const status = (state, message) => fs.writeFile(statusFile, JSON.stringify({ state, message, backup: config.backup, log: path.join(config.job, 'build.log') }));
  try {
    await status('waiting', 'Aguardando o DeckVault fechar…');
    // A late worker must never install after the UI has reported a failed handoff.
    const commitDeadline = Date.now() + 10000;
    while (true) {
      try { await fs.access(path.join(config.job, 'install.commit')); break; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (Date.now() > commitDeadline) {
        await status('error', 'Atualização cancelada antes de fechar o DeckVault.');
        return;
      }
      await delay(100);
    }
    const deadline = Date.now() + 60000;
    while (true) {
      let running = true;
      try { process.kill(config.pid, 0); } catch (error) {
        if (error.code === 'ESRCH') running = false;
        else throw error;
      }
      if (!running) { parentClosed = true; break; }
      if (Date.now() > deadline) throw new Error('O DeckVault não fechou. A instalação foi cancelada.');
      await delay(300);
    }
    await delay(1000);
    await status('backup', 'Salvando e verificando o backup…');
    await fs.mkdir(path.dirname(config.backup), { recursive: true });
    await backupProfile(config.profile, config.backup);
    await status('installing', 'Instalando a atualização…');
    await runCommand(config.installer, ['/S', '/currentuser'], { cwd: config.job, log: path.join(config.job, 'build.log') });
    await status('complete', 'Atualização local instalada. Backup verificado e preservado.');
  } catch (error) {
    await status('error', `${error.message} Backup: ${config.backup}`);
    // Show a persistent explanation even if the old application cannot reopen.
    const report = path.join(config.job, 'ERRO-ATUALIZACAO.txt');
    await fs.writeFile(report, `${error.message}\r\n\r\nBackup: ${config.backup}\r\nLog: ${path.join(config.job, 'build.log')}`);
    const notice = spawn('notepad.exe', [report], { detached: true, stdio: 'ignore' });
    notice.on('error', () => {});
    notice.unref();
  }
  if (!parentClosed) return;
  const app = spawn(config.executable, [], { detached: true, stdio: 'ignore', cwd: path.dirname(config.executable) });
  app.on('error', () => {});
  app.unref();
}

if (require.main === module) {
  fs.readFile(process.argv[2], 'utf8').then(JSON.parse).then(install).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
