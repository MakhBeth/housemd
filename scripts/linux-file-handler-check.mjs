// Verifica reale di «Apri con… HouseMD» su Linux (LAB-22): installa la PWA in un Chromium vero, con una HOME
// temporanea, e controlla cosa registra Chromium nel sistema (.desktop, tipo MIME) e che il file arrivi a launchQueue.
//
// Uso (serve un server X: su un desktop basta lanciarlo, su un server senza schermo con Xvfb):
//   npm run build
//   xvfb-run -a node scripts/linux-file-handler-check.mjs [/usr/bin/chromium]
//
// Non tocca la HOME vera: tutto finisce in una cartella temporanea, stampata all'inizio.
import { chromium } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const executablePath = process.argv[2] ?? '/usr/bin/chromium';
const port = 4319;
const origin = `http://localhost:${port}/`;
const home = mkdtempSync(join(tmpdir(), 'housemd-linux-'));
const env = { ...process.env, HOME: home, XDG_DATA_HOME: join(home, '.local/share'), XDG_CONFIG_HOME: join(home, '.config') };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
console.log('HOME temporanea:', home);

// Gruppo di processi proprio: alla fine si chiude anche il vite lanciato da npx.
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
await wait(3000);
const context = await chromium.launchPersistentContext(join(home, 'profile'), { executablePath, headless: false, env, args: ['--no-first-run'] });
try {
  const page = await context.newPage();
  await page.goto(origin);
  await wait(2000);
  const cdp = await context.newCDPSession(page);
  // Come «Installa HouseMD» nella barra degli indirizzi, senza clic.
  await cdp.send('PWA.install', { manifestId: origin });
  await wait(3000);
  const apps = join(home, '.local/share/applications');
  const desktop = existsSync(apps) ? readdirSync(apps).find((name) => name.endsWith('.desktop')) : undefined;
  if (!desktop) throw new Error('Nessun .desktop creato: Chromium non ha registrato la PWA');
  const entry = readFileSync(join(apps, desktop), 'utf8');
  console.log(`\n${desktop}\n${entry}`);
  console.log('MimeType text/markdown:', /^MimeType=.*text\/markdown/m.test(entry) ? 'sì' : 'NO');
  console.log('Exec con %U (il file passa all\'app):', /^Exec=.*%U/m.test(entry) ? 'sì' : 'NO');
  console.log('Gestori di file visti da Chromium:', JSON.stringify((await cdp.send('PWA.getOsAppState', { manifestId: origin })).fileHandlers));

  // Il file aperto con la PWA arriva a launchQueue: il titolo della finestra diventa il suo nome.
  writeFileSync(join(home, 'prova.md'), '# Prova da «Apri con»');
  await cdp.send('PWA.launchFilesInApp', { manifestId: origin, files: [join(home, 'prova.md')] });
  await wait(3000);
  const titles = await Promise.all(context.pages().map((p) => p.title()));
  console.log('Finestre dell\'app:', JSON.stringify(titles), titles.some((t) => t.includes('prova.md')) ? '→ file ricevuto' : '→ file NON ricevuto');

  // Associazione predefinita, come farebbe l'utente.
  execSync(`mkdir -p "${env.XDG_CONFIG_HOME}" && xdg-mime default ${desktop} text/markdown`, { env });
  console.log('xdg-mime default text/markdown:', execSync('xdg-mime query default text/markdown', { env }).toString().trim());
} finally {
  await context.close();
  process.kill(-server.pid);
}
