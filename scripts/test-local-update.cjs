const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { validateProject, buildLocalUpdate, backupProfile, runCommand } = require('../electron/local-update.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'deckvault-update-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'project with spaces');
  await fs.mkdir(source);
  const pkg = { name: 'deckvault', version: '0.2.15', build: { appId: 'com.deckvault.desktop', win: { executableName: 'DeckVault Desktop' } } };
  for (const file of ['electron/main.cjs', 'scripts/prepare-desktop.mjs', 'node_modules/next/dist/bin/next', 'node_modules/electron-builder/out/cli/cli.js']) {
    await fs.mkdir(path.dirname(path.join(source, file)), { recursive: true });
    await fs.writeFile(path.join(source, file), '');
  }
  await fs.writeFile(path.join(source, 'package.json'), JSON.stringify(pkg));
  return { root, source, pkg };
}

test('rejects another application and a downgrade before any build', async (t) => {
  const { source, pkg } = await fixture(t);
  await assert.rejects(validateProject(source, '0.2.16'), /antiga/);
  pkg.build.appId = 'another.app';
  await fs.writeFile(path.join(source, 'package.json'), JSON.stringify(pkg));
  await assert.rejects(validateProject(source, '0.2.14'), /DeckVault/);
});

test('accepts rebuilding the same version and rejects missing dependencies', async (t) => {
  const { source } = await fixture(t);
  assert.equal((await validateProject(source, '0.2.15')).version, '0.2.15');
  await fs.unlink(path.join(source, 'node_modules/next/dist/bin/next'));
  await assert.rejects(validateProject(source, '0.2.15'), /dependências/);
});

test('failed compilation cannot proceed to packaging or return a stale installer', async (t) => {
  const { root, source } = await fixture(t);
  const calls = [];
  await assert.rejects(buildLocalUpdate({ source, currentVersion: '0.2.15', node: process.execPath, job: root,
    run: async (_exe, args) => { calls.push(args); throw new Error('compile failed'); },
  }), /compile failed/);
  assert.equal(calls.length, 1);
});

test('build packages without publishing and requires a newly generated installer', async (t) => {
  const { root, source } = await fixture(t);
  const calls = [];
  const run = async (_exe, args, options) => {
    assert.equal(options.cwd, source);
    calls.push(args);
    if (calls.length === 3) {
      assert.deepEqual(args.slice(-2), ['--publish', 'never']);
      const output = args.find((arg) => arg.startsWith('--config.directories.output=')).split('=')[1];
      await fs.writeFile(path.join(output, 'DeckVault-Setup-0.2.15.exe'), 'new installer');
    }
  };
  const result = await buildLocalUpdate({ source, currentVersion: '0.2.15', node: process.execPath, job: root, run });
  assert.equal(await fs.readFile(result.installer, 'utf8'), 'new installer');
  assert.equal(calls.length, 3);
  await assert.rejects(buildLocalUpdate({ source, currentVersion: '0.2.15', node: process.execPath, job: root, run: async () => {} }), /ENOENT/);
});

test('backup preserves nested data and never overwrites an existing backup', async (t) => {
  const { root } = await fixture(t);
  const profile = path.join(root, 'profile');
  const backup = path.join(root, 'backup');
  await fs.mkdir(path.join(profile, 'Local Storage'), { recursive: true });
  await fs.writeFile(path.join(profile, 'Local Storage', 'data'), 'collection data');
  await fs.writeFile(path.join(profile, 'preferences'), 'settings');
  await backupProfile(profile, backup);
  assert.equal(await fs.readFile(path.join(backup, 'Local Storage', 'data'), 'utf8'), 'collection data');
  assert.equal(await fs.readFile(path.join(profile, 'preferences'), 'utf8'), 'settings');
  await assert.rejects(backupProfile(profile, backup), /EEXIST/);
});

test('process runner reports failure and treats shell characters as literal arguments', async (t) => {
  const { root } = await fixture(t);
  const log = path.join(root, 'build.log');
  await runCommand(process.execPath, ['-e', 'console.log(process.argv[1])', 'a & b'], { cwd: root, log });
  assert.match(await fs.readFile(log, 'utf8'), /a & b/);
  await assert.rejects(runCommand(process.execPath, ['-e', 'process.exit(7)'], { cwd: root, log }), /7/);
});

test('Windows helper backs up after exit, runs installer and reopens the application', { skip: process.platform !== 'win32' }, async (t) => {
  const { root } = await fixture(t);
  const csc = path.join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  try { await fs.access(csc); } catch { t.skip('C# fixture compiler unavailable'); return; }
  const profile = path.join(root, 'profile');
  await fs.mkdir(profile);
  await fs.writeFile(path.join(profile, 'collection'), 'original cards');
  const source = path.join(root, 'Fixture.cs');
  const executable = path.join(root, 'Fixture.exe');
  await fs.writeFile(source, `using System; using System.IO; class Fixture {
    static int Main(string[] args) {
      string root = AppDomain.CurrentDomain.BaseDirectory;
      if (args.Length == 0) { File.WriteAllText(Path.Combine(root, "restarted"), "yes"); return 0; }
      if (args.Length != 2 || args[0] != "/S" || args[1] != "/currentuser") return 3;
      if (File.ReadAllText(Path.Combine(root, "backup", "collection")) != "original cards") return 4;
      File.WriteAllText(Path.Combine(root, "installed"), "yes"); return 0;
    }
  }`);
  await runCommand(csc, ['/nologo', `/out:${executable}`, source], { cwd: root });
  const config = { job: root, backup: path.join(root, 'backup'), profile, executable, installer: executable, pid: 2147483647 };
  const configFile = path.join(root, 'install.json');
  await fs.writeFile(configFile, JSON.stringify(config));
  await fs.writeFile(path.join(root, 'install.commit'), 'install');
  await runCommand(process.execPath, [path.resolve(__dirname, '../electron/local-update-install.cjs'), configFile], { cwd: root });
  const status = JSON.parse(await fs.readFile(path.join(root, 'status.json'), 'utf8'));
  assert.equal(status.state, 'complete');
  assert.equal(await fs.readFile(path.join(root, 'installed'), 'utf8'), 'yes');
  for (let n = 0; n < 50; n++) {
    try { await fs.access(path.join(root, 'restarted')); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.equal(await fs.readFile(path.join(root, 'restarted'), 'utf8'), 'yes');
  assert.equal(await fs.readFile(path.join(profile, 'collection'), 'utf8'), 'original cards');
});

test('a late helper without committed handoff cannot back up, install or restart', async (t) => {
  const { root } = await fixture(t);
  const profile = path.join(root, 'profile');
  await fs.mkdir(profile);
  await fs.writeFile(path.join(profile, 'collection'), 'unchanged');
  const configFile = path.join(root, 'install.json');
  const backup = path.join(root, 'backup');
  await fs.writeFile(configFile, JSON.stringify({ job: root, profile, backup, pid: 2147483647,
    installer: 'must-not-run.exe', executable: 'must-not-restart.exe' }));
  await runCommand(process.execPath, [path.resolve(__dirname, '../electron/local-update-install.cjs'), configFile], { cwd: root });
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'status.json'), 'utf8')).state, 'error');
  await assert.rejects(fs.access(backup), /ENOENT/);
  assert.equal(await fs.readFile(path.join(profile, 'collection'), 'utf8'), 'unchanged');
});
