const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

async function validateProject(source, currentVersion) {
  const pkg = JSON.parse(await fsp.readFile(path.join(source, 'package.json'), 'utf8'));
  if (pkg.name !== 'deckvault' || pkg.build?.appId !== 'com.deckvault.desktop' ||
      pkg.build?.win?.executableName !== 'DeckVault Desktop' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    throw new Error('Selecione a pasta do código do DeckVault, com a configuração Windows original.');
  }
  const current = currentVersion.split('.').map(Number);
  const next = pkg.version.split('.').map(Number);
  const difference = next.map((n, i) => n - current[i]).find((n) => n !== 0) ?? 0;
  if (difference < 0) throw new Error('A pasta contém uma versão mais antiga que a instalada.');
  for (const file of ['electron/main.cjs', 'scripts/prepare-desktop.mjs']) {
    await fsp.access(path.join(source, file));
  }
  for (const file of ['node_modules/next/dist/bin/next', 'node_modules/electron-builder/out/cli/cli.js']) {
    try { await fsp.access(path.join(source, file)); }
    catch { throw new Error('Esta pasta está sem as dependências de compilação. Execute npm ci nela antes de atualizar.'); }
  }
  return pkg;
}

function buildEnvironment() {
  const env = { ...process.env };
  // The installed Next server sets these; they must not leak into a source build.
  for (const key of ['NODE_PATH', 'NODE_ENV', 'PORT', 'HOSTNAME', 'ELECTRON_RUN_AS_NODE', 'DECKVAULT_DESKTOP', 'CARDTRADER_API_TOKEN', 'CARDTRADER_OWNER_USER_ID']) delete env[key];
  return env;
}

function runCommand(executable, args, { cwd, log, env = buildEnvironment() }) {
  return new Promise((resolve, reject) => {
    const output = log ? fs.openSync(log, 'a') : null;
    let child;
    try {
      child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true,
        stdio: ['ignore', output ?? 'ignore', output ?? 'ignore'] });
    } catch (error) { reject(error); }
    finally { if (output !== null) fs.closeSync(output); }
    if (!child) return;
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`O processo terminou com código ${code}. Consulte o log da atualização.`)));
  });
}

async function buildLocalUpdate({ source, currentVersion, node, job, onStatus = () => {}, run = runCommand }) {
  const pkg = await validateProject(source, currentVersion);
  // A unique output makes it impossible to install a stale executable after a failed build.
  const output = await fsp.mkdtemp(path.join(job, 'build-'));
  const log = path.join(job, 'build.log');
  const options = { cwd: source, log, env: { ...buildEnvironment(), PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH ?? ''}` } };
  onStatus('Compilando os arquivos locais…');
  await run(node, [path.join(source, 'node_modules/next/dist/bin/next'), 'build'], options);
  onStatus('Preparando o aplicativo Windows…');
  await run(node, [path.join(source, 'scripts/prepare-desktop.mjs')], options);
  onStatus('Gerando o instalador…');
  await run(node, [path.join(source, 'node_modules/electron-builder/out/cli/cli.js'), '--win', 'nsis',
    `--config.directories.output=${output}`, '--publish', 'never'], options);
  const installer = path.join(output, `DeckVault-Setup-${pkg.version}.exe`);
  const stat = await fsp.stat(installer);
  if (!stat.isFile() || !stat.size) throw new Error('O instalador não foi gerado.');
  // Only this freshly created build directory is eligible for cleanup.
  await fsp.rm(path.join(output, 'win-unpacked'), { recursive: true, force: true });
  return { installer, version: pkg.version };
}

async function manifest(root) {
  const result = {};
  async function walk(relative) {
    for (const entry of await fsp.readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error('O perfil contém um link; o backup foi interrompido.');
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) {
        const hash = crypto.createHash('sha256');
        for await (const chunk of fs.createReadStream(path.join(root, name))) hash.update(chunk);
        result[name] = hash.digest('hex');
      }
    }
  }
  await walk('');
  return result;
}

async function backupProfile(profile, destination) {
  await fsp.mkdir(destination); // Never overwrite a previous backup.
  const before = await manifest(profile);
  for (const entry of await fsp.readdir(profile)) {
    await fsp.cp(path.join(profile, entry), path.join(destination, entry), { recursive: true, force: false, errorOnExist: true });
  }
  const after = await manifest(profile);
  const copied = await manifest(destination);
  const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => a[key] === b[key]);
  if (!same(before, after) || !same(before, copied)) throw new Error('O backup não passou na verificação. A instalação foi cancelada.');
}

module.exports = { validateProject, buildEnvironment, runCommand, buildLocalUpdate, backupProfile };
