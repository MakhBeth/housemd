import http from 'node:http';
import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROTOCOL = 1;
export const MAX_BODY = 5 * 1024 * 1024;
export const DEFAULT_ORIGINS = ['http://localhost:5173'];
export function compatibleHealth(value) { return value?.app === 'housemd-bridge' && value.protocol === PROTOCOL && ['originCheck', 'noTools', 'noSessionPersistence'].every(k => value.protections?.[k] === true); }
export async function findClaude(env = process.env) {
  const candidates = env.CLAUDE_BIN ? [env.CLAUDE_BIN] : [...(env.PATH ?? '').split(delimiter).filter(Boolean).map(p => join(p, 'claude')), join(homedir(), '.local/bin/claude'), join(homedir(), '.claude/local/claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  for (const candidate of candidates) { try { await access(candidate, constants.X_OK); return candidate; } catch { /* Prossimo percorso noto. */ } }
  return null;
}
function json(res, status, value) { if (!res.destroyed && !res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); } }
function safeError(value) { return String(value).replace(/(authorization|x-api-key)\s*[:=][^\r\n]+/gi, '$1: [redacted]').replace(/\bsk-[\w-]+/g, '[redacted]').slice(0, 500); }
function validateRequest(body) {
  if (!body || body.stream === true || (body.model !== undefined && (typeof body.model !== 'string' || body.model.length > 200 || body.model.startsWith('-'))) || !Array.isArray(body.messages) || !body.messages.length || body.messages.some(m => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) throw new Error('Richiesta non valida');
}
function readBody(req, maxBody) { return new Promise((resolve, reject) => { let size = 0; const chunks = []; req.on('data', chunk => { size += chunk.length; if (size > maxBody) { reject(Object.assign(new Error('Corpo troppo grande'), { status: 413 })); chunks.length = 0; } else chunks.push(chunk); }); req.on('end', () => { if (size > maxBody) return; try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('JSON non valido'), { status: 400 })); } }); req.on('error', reject); req.on('aborted', () => reject(new Error('Client disconnesso'))); }); }
export function createBridge({ claudeBin = null, allowedOrigins = DEFAULT_ORIGINS, timeoutMs = 300000, maxBody = MAX_BODY, spawnImpl = spawn } = {}) {
  const origins = new Set(allowedOrigins); let tail = Promise.resolve(); const active = new Set();
  const server = http.createServer(async (req, res) => {
    // Controllo esplicito su ogni richiesta, anche non proveniente da un browser.
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || !origins.has(origin)) { json(res, 403, { error: 'Origine non ammessa' }); return; }
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Private-Network', 'true'); res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && req.url === '/health') { json(res, 200, { app: 'housemd-bridge', protocol: PROTOCOL, version: '1.0.0', protections: { originCheck: true, noTools: true, noSessionPersistence: true }, claude: claudeBin }); return; }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') { json(res, 404, { error: 'Endpoint non trovato' }); return; }
    let body; try { body = await readBody(req, maxBody); validateRequest(body); } catch (error) { json(res, error.status ?? 400, { error: safeError(error.message) }); return; }
    let cancelled = false; let child; let killTimer;
    const terminate = () => { cancelled = true; if (child && child.exitCode === null) { child.kill('SIGTERM'); killTimer = setTimeout(() => child?.kill('SIGKILL'), 1000); killTimer.unref(); } };
    res.once('close', terminate);
    const run = async () => {
      if (cancelled || res.destroyed) return;
      if (!claudeBin) { json(res, 500, { error: 'CLI claude non trovata: configura CLAUDE_BIN' }); return; }
      let cwd; let timeout;
      try {
        cwd = await mkdtemp(join(tmpdir(), 'housemd-claude-'));
        if (cancelled) return;
        const args = ['-p', '--output-format', 'text', '--no-session-persistence', '--tools', '', '--strict-mcp-config'];
        if (body.model) args.push('--model', body.model);
        const system = body.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n'); if (system) args.push('--append-system-prompt', system);
        const input = body.messages.filter(m => m.role !== 'system').map(m => `<${m.role}>\n${m.content}\n</${m.role}>`).join('\n\n');
        const output = await new Promise((resolve, reject) => {
          child = spawnImpl(claudeBin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false }); active.add(child);
          let stdout = ''; let stderr = ''; let timedOut = false; let excessive = false;
          child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
          timeout = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
          child.stdout.on('data', chunk => { if (!excessive) stdout += chunk; if (!excessive && Buffer.byteLength(stdout) > MAX_BODY * 4) { excessive = true; terminate(); } });
          child.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk.toString(); });
          child.once('error', reject);
          child.once('close', code => { active.delete(child); if (timedOut) reject(new Error('Timeout CLI claude')); else if (excessive) reject(new Error('Risposta CLI troppo grande')); else if (code !== 0) reject(new Error(`CLI claude: uscita ${code}: ${safeError(stderr)}`)); else resolve(stdout); });
          child.stdin.on('error', () => {}); child.stdin.end(input);
        });
        if (!res.destroyed) json(res, 200, { object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: output }, finish_reason: 'stop' }] });
      } catch (error) { json(res, 500, { error: safeError(error.message) }); }
      finally { clearTimeout(timeout); clearTimeout(killTimer); res.off('close', terminate); if (cwd) await rm(cwd, { recursive: true, force: true }); }
    };
    tail = tail.then(run, run);
  });
  server.on('close', () => { for (const child of active) child.kill('SIGTERM'); });
  server.requestTimeout = 30000;
  return server;
}
export async function startBridge({ port = Number(process.env.PORT ?? 11436), allowedOrigins = (process.env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS.join(',')).split(',').map(s => s.trim()).filter(Boolean), claudeBin, ...options } = {}) {
  const server = createBridge({ ...options, allowedOrigins, claudeBin: claudeBin ?? await findClaude() });
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return { server, reused: false }; }
  catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    try { const res = await fetch(`http://127.0.0.1:${port}/health`, { headers: { Origin: allowedOrigins[0] ?? '' }, signal: AbortSignal.timeout(2000), redirect: 'error' }); if (res.ok && compatibleHealth(await res.json())) return { server: null, reused: true }; } catch { /* La porta non è un bridge compatibile. */ }
    throw new Error(`Porta ${port} occupata da un altro programma`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startBridge().then(({ server, reused }) => { console.log(reused ? 'Bridge HouseMD già attivo' : `Bridge HouseMD in ascolto su 127.0.0.1:${server.address().port}`); if (server) { const stop = () => { server.close(); server.closeAllConnections(); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); } }).catch(error => { console.error(safeError(error.message)); process.exitCode = 1; });
}
