// Prova reale di «Apri con… HouseMD» su Linux (LAB-22), dal sistema e non da DevTools:
// 1. installa la PWA in un Chromium vero, con una HOME temporanea (la HOME vera non si tocca);
// 2. avvia la riga Exec del .desktop creato da Chromium con un file, come fa il file manager, e conferma il dialog
//    nativo «Open and edit … in this web app?» con mouse finto (XTest);
// 3. modifica il documento, risponde «Save changes» al permesso di scrittura di Chromium e controlla il file su disco;
// 4. apre un secondo file con l'app già aperta (stessa finestra, il primo resta salvato), con «Ricorda la scelta»;
// 5. apre un terzo file: il dialog non torna.
// Con FBDIR le foto dei dialog finiscono accanto a questo script (dialog-1.png, save-prompt.png, dialog-2.png).
//
// Uso, su una macchina senza schermo (serve Xvfb; con -fbdir lo script fotografa lo schermo):
//   npm run build
//   mkdir -p /tmp/hmd-fb && FBDIR=/tmp/hmd-fb xvfb-run -a -s "-screen 0 1280x900x24 -fbdir /tmp/hmd-fb" \
//     node scripts/linux/open-with-check.mjs [/usr/bin/chromium]
// Le coordinate dei clic valgono per Chromium 156 con lo schermo sopra; un'altra versione può spostarle.
import { chromium } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const executablePath = process.argv[2] ?? '/usr/bin/chromium';
const port = 4319;
const origin = `http://localhost:${port}/`;
const home = mkdtempSync(join(tmpdir(), 'housemd-linux-'));
const env = { ...process.env, HOME: home, XDG_DATA_HOME: join(home, '.local/share'), XDG_CONFIG_HOME: join(home, '.config') };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pointer = (...steps) => execSync(`python3 ${join(here, 'xkeys.py')} ${steps.join(' ')}`);
const photo = (name, x, y, w, h) => {
  if (process.env.FBDIR) execSync(`python3 ${join(here, 'xwd2png.py')} ${process.env.FBDIR}/Xvfb_screen0 ${join(here, `${name}.png`)} ${x},${y},${w},${h}`);
};
const windows = () => execSync('xwininfo -root -tree').toString().split('\n').filter((l) => /"[^"]+":/.test(l) && !/clipboard|"chromium": \(/.test(l)).map((l) => l.trim());
const titles = async () => (await fetch('http://127.0.0.1:9333/json').then((r) => r.json()).catch(() => [])).filter((t) => t.type === 'page').map((t) => t.title);
const read = (name) => readFileSync(join(home, name), 'utf8');
console.log('HOME temporanea:', home);

/** Il dialog nativo di Chromium, se c'è: foto, «Ricorda la scelta» se chiesto, poi «Open». */
async function confirm(name, remember) {
  const dialog = windows().find((w) => /"Chromium": \(\)/.test(w));
  console.log(`${name}:`, dialog ? 'dialog di conferma presente' : 'nessun dialog');
  if (!dialog) return;
  const [w, h, x, y] = dialog.match(/(\d+)x(\d+)\+(-?\d+)\+(-?\d+)/).slice(1).map(Number);
  photo(name, x, y, w, h);
  pointer(...(remember ? [`move:${x + 28},${y + 125}`, 'click'] : []), `move:${x + w - 80},${y + h - 39}`, 'click');
  await wait(4000);
}

// Gruppo di processi proprio: alla fine si chiude anche il vite lanciato da npx.
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
await wait(3000);
try {
  // 1. Installazione (come «Installa» nella barra degli indirizzi).
  const context = await chromium.launchPersistentContext(join(home, 'profile'), { executablePath, headless: false, env, args: ['--no-first-run'] });
  const page = await context.newPage();
  await page.goto(origin);
  await wait(2000);
  await (await context.newCDPSession(page)).send('PWA.install', { manifestId: origin });
  await wait(3000);
  await context.close();
  const apps = join(home, '.local/share/applications');
  const desktop = readdirSync(apps).find((name) => name.endsWith('.desktop'));
  const entry = readFileSync(join(apps, desktop), 'utf8');
  console.log(`\n${desktop}\n${entry.split('\n').filter((l) => /^(Name|MimeType|Exec)=/.test(l)).join('\n')}\n`);
  const exec = entry.match(/^Exec=(.*)$/m)[1];
  execSync(`mkdir -p "${env.XDG_CONFIG_HOME}" && xdg-mime default ${desktop} text/markdown`, { env });
  console.log('xdg-mime default text/markdown:', execSync('xdg-mime query default text/markdown', { env }).toString().trim());

  // 2. Avvio a freddo dal .desktop con un file.
  for (const [name, text] of [['uno.md', '# Uno'], ['due.md', '# Due'], ['tre.md', '# Tre']]) writeFileSync(join(home, name), text);
  spawn('sh', ['-c', exec.replace('%U', `--remote-debugging-port=9333 "${join(home, 'uno.md')}"`)], { env, stdio: 'ignore' });
  await wait(7000);
  await confirm('dialog-1', false);
  console.log("1. finestre dell'app:", JSON.stringify(await titles()));

  // 3. Modifica e permesso di scrittura (Chromium lo chiede alla prima scrittura di un file aperto così).
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const app = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith(origin));
  const editor = app.getByRole('textbox').first();
  await editor.click();
  await app.keyboard.press('Control+End');
  await app.keyboard.type(' modificato');
  await wait(3000);
  photo('save-prompt', 0, 0, 1080, 520);
  pointer('move:673,201', 'click');
  await wait(3000);
  console.log('2. uno.md su disco:', JSON.stringify(read('uno.md')));

  // 4. Secondo file con l'app aperta.
  spawn('sh', ['-c', exec.replace('%U', `"${join(home, 'due.md')}"`)], { env, stdio: 'ignore' });
  await wait(5000);
  await confirm('dialog-2', true);
  console.log("3. finestre dell'app:", JSON.stringify(await titles()), '— editor:', JSON.stringify(await editor.textContent()));
  console.log('3. uno.md su disco:', JSON.stringify(read('uno.md')));

  // 5. Terzo file: scelta ricordata.
  spawn('sh', ['-c', exec.replace('%U', `"${join(home, 'tre.md')}"`)], { env, stdio: 'ignore' });
  await wait(5000);
  await confirm('dialog-3', false);
  console.log("4. finestre dell'app:", JSON.stringify(await titles()));
  await browser.close().catch(() => {});
} finally {
  const chromiumPids = execSync(`pgrep -f "^/usr/lib/chromium/chromium .*${home}" || true`).toString().split('\n').filter(Boolean);
  for (const pid of chromiumPids) process.kill(Number(pid));
  process.kill(-server.pid);
}
