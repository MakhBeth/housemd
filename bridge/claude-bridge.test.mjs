import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, chmod, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBridge, startBridge, findClaude, compatibleHealth } from './claude-bridge.mjs';
const origin = 'http://localhost:5173';
const headers = { Origin: origin, 'Content-Type': 'application/json' };
const request = { model: 'opus', stream: false, messages: [{ role: 'system', content: 'Sistema' }, { role: 'user', content: 'Prima' }, { role: 'assistant', content: 'Risposta' }, { role: 'user', content: 'Seconda' }] };
async function fixture(t, options = {}, mode = 'normal') {
  const dir = await mkdtemp(join(tmpdir(), 'housemd-bridge-test-')); const record = join(dir, 'record'); const bin = join(dir, 'claude');
  await writeFile(bin, `#!${process.execPath}\nimport fs from 'node:fs';\nconst record=${JSON.stringify(record)};const mode=${JSON.stringify(mode)};let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{fs.appendFileSync(record,JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),input,time:Date.now()})+'\\n');if(mode==='normal'){process.stdout.write('Risultato');}else if(mode==='fail'){process.stderr.write('non autenticato');process.exitCode=1;}else{process.on('SIGTERM',()=>{fs.appendFileSync(record+'.killed','yes');if(mode!=='stubborn')process.exit(0)});setTimeout(()=>process.stdout.write('Finito'),mode==='slow'?150:10000)}});\n`);
  await chmod(bin, 0o700);
  const server = createBridge({ claudeBin: bin, ...options }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  return { server, dir, bin, record, base: `http://127.0.0.1:${server.address().port}` };
}
async function post(f, body = request, signal) { return fetch(f.base + '/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(body), signal }); }
async function recorded(path) { return (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line)); }
async function eventually(fn) { for (let i = 0; i < 100; i++) { try { return await fn(); } catch { await new Promise(resolve => setTimeout(resolve, 20)); } } throw new Error('Attesa evento scaduta'); }
test('health, origine obbligatoria e preflight', async t => {
  const f = await fixture(t); assert.equal(f.server.address().address, '127.0.0.1');
  const health = await fetch(f.base + '/health', { headers }); const value = await health.json(); assert.equal(compatibleHealth(value), true); assert.equal(value.claude, f.bin);
  for (const h of [{}, { Origin: 'https://evil.example' }, { Origin: 'null' }]) assert.equal((await fetch(f.base + '/health', { headers: h })).status, 403);
  const preflight = await fetch(f.base + '/v1/chat/completions', { method: 'OPTIONS', headers }); assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), origin); assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
  assert.equal((await fetch(f.base, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } })).status, 403);
});
test('argomenti CLI esatti, storico con ruoli, cwd vuota eliminata', async t => {
  const f = await fixture(t); const res = await post(f); assert.equal(res.status, 200); assert.equal((await res.json()).choices[0].message.content, 'Risultato');
  const [record] = await recorded(f.record); assert.deepEqual(record.args, ['-p', '--output-format', 'text', '--no-session-persistence', '--tools', '', '--strict-mcp-config', '--model', 'opus', '--append-system-prompt', 'Sistema']);
  assert.equal(record.input, '<user>\nPrima\n</user>\n\n<assistant>\nRisposta\n</assistant>\n\n<user>\nSeconda\n</user>'); assert.ok(record.cwd.startsWith(join(tmpdir(), 'housemd-claude-'))); await eventually(async () => { await assert.rejects(access(record.cwd)); });
});
test('modello vuoto omette --model; payload errati e limite corpo', async t => {
  const f = await fixture(t, { maxBody: 500 }); const res = await post(f, { ...request, model: '' }); assert.equal(res.status, 200); assert.ok(!(await recorded(f.record))[0].args.includes('--model'));
  assert.equal((await post(f, { ...request, stream: true })).status, 400); assert.equal((await post(f, { ...request, model: '--dangerous' })).status, 400); assert.equal((await post(f, { ...request, messages: [{ role: 'tool', content: 'x' }] })).status, 400);
  assert.equal((await post(f, { ...request, messages: [{ role: 'user', content: 'x'.repeat(600) }] })).status, 413);
});
test('CLI non trovata, non autenticata, timeout', async t => {
  assert.equal(await findClaude({ CLAUDE_BIN: '/nonexistent/claude' }), null);
  const missing = await fixture(t, { claudeBin: null }); assert.equal((await post(missing)).status, 500);
  const failing = await fixture(t, {}, 'fail'); const failure = await post(failing); assert.equal(failure.status, 500); assert.match((await failure.json()).error, /non autenticato/);
  const timed = await fixture(t, { timeoutMs: 200 }, 'hang'); const timeout = await post(timed); assert.equal(timeout.status, 500); assert.match((await timeout.json()).error, /Timeout/); assert.equal(await readFile(timed.record + '.killed', 'utf8'), 'yes');
});
test('client Stop termina CLI; richiesta successiva eseguibile', async t => {
  const f = await fixture(t, {}, 'hang'); const abort = new AbortController(); const pending = post(f, request, abort.signal); const rejection = assert.rejects(pending, { name: 'AbortError' }); await eventually(() => readFile(f.record, 'utf8')); abort.abort(); await rejection; await eventually(() => readFile(f.record + '.killed', 'utf8'));
});
test('coda seriale, mai due processi contemporanei', async t => {
  const f = await fixture(t, {}, 'slow'); const responses = await Promise.all([post(f), post(f)]); for (const response of responses) assert.equal(response.status, 200); const records = await recorded(f.record); assert.equal(records.length, 2); assert.ok(records[1].time - records[0].time >= 140);
});
test('porta occupata: riuso compatibile, rifiuto altro server', async t => {
  const f = await fixture(t); const reused = await startBridge({ port: f.server.address().port, claudeBin: f.bin }); assert.equal(reused.reused, true); assert.equal(reused.server, null);
  const other = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); }); await new Promise(resolve => other.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => other.close(resolve))); await assert.rejects(startBridge({ port: other.address().port, claudeBin: f.bin }), /occupata da un altro programma/);
});

test('Stop di una richiesta in coda non avvia una seconda CLI', async t => {
  const f = await fixture(t, {}, 'slow');
  const first = post(f); await eventually(() => readFile(f.record, 'utf8'));
  const abort = new AbortController(); const queued = post(f, request, abort.signal);
  const rejection = assert.rejects(queued, { name: 'AbortError' });
  await new Promise(resolve => setTimeout(resolve, 30)); abort.abort(); await rejection;
  assert.equal((await first).status, 200);
  await new Promise(resolve => setTimeout(resolve, 80)); assert.equal((await recorded(f.record)).length, 1);
});
test('CLI che ignora SIGTERM viene terminata con SIGKILL al timeout', async t => {
  const f = await fixture(t, { timeoutMs: 150 }, 'stubborn'); const started = Date.now();
  const result = await post(f); assert.equal(result.status, 500); assert.match((await result.json()).error, /Timeout/);
  assert.ok(Date.now() - started >= 1000); const [record] = await recorded(f.record);
  await eventually(async () => { await assert.rejects(access(record.cwd)); });
});
