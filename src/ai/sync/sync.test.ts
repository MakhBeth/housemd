import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryOps } from '../../fs/testing/memoryOps';
import { createMemoryAiStores, type SyncSnapshot } from '../stores';
import type { ModelProfile } from '../types';
import { canonical, makeFile, parseFile, fileSnapshot, snapshotContent } from './schema';
import { merge, compareEpoch } from './merge';
import { nextStamp } from './stamp';
import { acquireLock, LOCK_FILE } from './lock';
import { backup, readSync, writeSync, SYNC_FILE, listBackups } from './syncFile';
import { syncCycle } from './syncCycle';
import { restoreBackup } from './restore';
const profile = (id = 'p', updatedAt = 0): ModelProfile => ({ id, name: id, kind: 'ollama', model: 'm', baseUrl: 'http://localhost:11434', params: {}, secretId: null, contextTokens: null, updatedAt, updatedBy: 'seed' });
const snap = (...profiles: ModelProfile[]): SyncSnapshot => ({ profiles, presets: [], tombstones: [], epoch: null });
const instant = { now: () => 10000, wait: async () => {} };
test('stamp supera anche orologi futuri; schema canonico esclude segreti e duplicati', () => {
  assert.equal(nextStamp(2, 100), 101);
  const file = makeFile(snap({ ...profile(), secretId: 'do-not-export' }), 'w', 1);
  assert.ok(!canonical(file).includes('secretId')); assert.ok(!canonical(file).includes('do-not-export'));
  assert.equal(canonical(parseFile(canonical(file))), canonical(file));
  file.stores.profiles.push(file.stores.profiles[0]); assert.throws(() => parseFile(canonical(file)), /syncInvalid/);
});
test('merge è commutativo associativo idempotente, incluso spareggio payload', () => {
  const variants = Array.from({ length: 10 }, (_, i) => { const s = snap({ ...profile('p', i % 3), name: String(i), updatedBy: String(i % 2) }); if (i % 4 === 0) { s.tombstones.push({ store: 'profiles', id: 'p', deletedAt: 2 }); s.profiles = s.profiles.filter(p => p.updatedAt >= 2); } return s; });
  const m = (a: SyncSnapshot, b: SyncSnapshot) => merge(a, b).merged, c = snapshotContent;
  for (const a of variants) { assert.equal(c(m(a, a)), c(a)); for (const b of variants) { assert.equal(c(m(a, b)), c(m(b, a))); for (const d of variants) assert.equal(c(m(m(a, b), d)), c(m(a, m(b, d)))); } }
});
test('backup verificato obbligatorio, nomi univoci, fallback move e temporanei unici', async () => {
  const fs = memoryOps({ withMove: true });
  fs.moveFile = async () => { throw new DOMException('unsupported', 'NotAllowedError'); };
  const one = makeFile(snap(profile()), 'w', 1); await writeSync(fs, one, null, 'w', 1);
  const old = await readSync(fs); await writeSync(fs, makeFile(snap(profile('q')), 'w', 2), old, 'w', 2);
  await backup(fs, old!.text, 'w', 2); assert.equal((await listBackups(fs)).length, 2);
  assert.equal((await readSync(fs))!.file.stores.profiles[0].id, 'q');
  const parts = fs.log.filter(l => l.startsWith('write ') && l.endsWith('.part')); assert.equal(new Set(parts).size, 2);
  assert.ok(![...fs.files.keys()].some(p => p.endsWith('.part')));
  const failing = memoryOps({ failWrite: p => p.startsWith('housemd-backups') }); failing.setFile(SYNC_FILE, old!.text);
  await assert.rejects(writeSync(failing, one, await readSync(failing), 'w', 1), /syncBackupFailed/);
  assert.equal(await failing.textOf(SYNC_FILE), old!.text);
});
test('backup concorrenti con writer e timestamp uguali restano distinti; vecchi nomi leggibili', async () => {
  const fs = memoryOps();
  const legacy = 'housemd-backups/housemd-sync.1970-01-01T00-00-10.000Z.shared-writer.json';
  fs.setFile(legacy, 'legacy-version');
  const contents = ['version-A', 'version-B', 'version-C'];
  const paths = await Promise.all(contents.map(text => backup(fs, text, 'shared-writer', 10000)));
  assert.equal(new Set(paths).size, contents.length);
  assert.deepEqual(await Promise.all(paths.map(path => fs.textOf(path))), contents);
  assert.equal(await fs.textOf(legacy), 'legacy-version');
  assert.deepEqual(new Set(await listBackups(fs)), new Set([legacy, ...paths]));
});
test('lock scaduto, timeout e token altrui non cancellato', async () => {
  const fs = memoryOps(); fs.setFile(LOCK_FILE, JSON.stringify({ acquiredAt: -1, token: 'old' }));
  const release = await acquireLock(fs, 'a', instant); assert.ok(release);
  fs.setFile(LOCK_FILE, JSON.stringify({ acquiredAt: 10000, token: 'other' })); await release(); assert.ok(await fs.exists(LOCK_FILE));
  assert.equal(await acquireLock(fs, 'a', instant), null);
});
test('ciclo crea, non riscrive invariato, converge due database e non tocca JSON invalido', async () => {
  const fs = memoryOps(), a = createMemoryAiStores({ writerId: 'a' }), b = createMemoryAiStores({ writerId: 'b' });
  await a.saveProfile(profile('a')); await b.saveProfile(profile('b'));
  assert.equal((await syncCycle({ store: a, fs, ...instant })).status, 'created');
  const writes = fs.log.length; assert.equal((await syncCycle({ store: a, fs, ...instant })).status, 'unchanged'); assert.equal(fs.log.length, writes);
  await syncCycle({ store: b, fs, ...instant }); await syncCycle({ store: a, fs, ...instant });
  assert.deepEqual((await a.load()).profiles.map(p => p.id).sort(), ['a', 'b']);
  fs.setFile(SYNC_FILE, '{bad'); await assert.rejects(syncCycle({ store: a, fs, ...instant }), /syncInvalid/); assert.equal(await fs.textOf(SYNC_FILE), '{bad');
});
test('ripristino rimpiazza record nuovi, preserva tombstone adottati e respinge epoche obsolete', async () => {
  const fs = memoryOps(), a = createMemoryAiStores({ writerId: 'a', now: () => 10 }), b = createMemoryAiStores({ writerId: 'b', now: () => 50000 });
  await a.saveProfile(profile('keep')); await syncCycle({ store: a, fs, ...instant });
  const source = await backup(fs, (await readSync(fs))!.text, 'a', 1);
  await a.saveProfile(profile('remove')); await syncCycle({ store: a, fs, ...instant });
  const obsolete = (await readSync(fs))!.text;
  await b.saveProfile(profile('newer')); await syncCycle({ store: b, fs, ...instant });
  await restoreBackup({ store: a, fs, ...instant }, source);
  assert.equal((await syncCycle({ store: b, fs, ...instant })).status, 'restored');
  assert.deepEqual((await b.load()).profiles.map(p => p.id), ['keep']);
  assert.ok((await listBackups(fs)).some(p => p.includes('local-before-restore')));
  const staleSameEpoch = (await readSync(fs))!.text;
  await a.deleteProfile('keep'); await syncCycle({ store: a, fs, ...instant });
  const c = createMemoryAiStores({ writerId: 'c' }); await syncCycle({ store: c, fs, ...instant });
  assert.equal((await c.snapshot()).tombstones.length, 1);
  fs.setFile(SYNC_FILE, staleSameEpoch); await syncCycle({ store: c, fs, ...instant }); assert.equal(fileSnapshot((await readSync(fs))!.file).profiles.length, 0);
  fs.setFile(SYNC_FILE, obsolete); await syncCycle({ store: a, fs, ...instant }); assert.equal((await readSync(fs))!.file.stores.profiles.length, 0);
  assert.ok(compareEpoch((await a.snapshot()).epoch, null) > 0);
});
test('epoche con stesso tempo hanno ordine totale', () => {
  const a = { restoredAt: 1, restoredFrom: 'a', restoreId: 'b' }, b = { ...a, restoredFrom: 'b', restoreId: 'a' }, c = { ...b, restoreId: 'c' };
  assert.ok(compareEpoch(a, b) < 0); assert.ok(compareEpoch(b, c) < 0); assert.ok(compareEpoch(a, c) < 0);
});
test('modifica locale durante un giro non viene sovrascritta e finisce nel file', async () => {
  const fs = memoryOps(), a = createMemoryAiStores({ writerId: 'a', now: () => 10 }); await a.saveProfile(profile());
  const originalApply = a.applySnapshot;
  let changed = false;
  a.applySnapshot = async (expected, next) => { if (!changed) { changed = true; await a.saveProfile({ ...profile(), name: 'during-cycle' }); } return originalApply(expected, next); };
  await syncCycle({ fs, store: a, ...instant });
  assert.equal((await a.load()).profiles[0].name, 'during-cycle');
  assert.equal((await readSync(fs))!.file.stores.profiles[0].name, 'during-cycle');
});
test('file cambiato sotto lock causa nuova lettura e rifusione', async () => {
  const fs = memoryOps(), a = createMemoryAiStores({ writerId: 'a', now: () => 10 }); await a.saveProfile(profile('a'));
  let changed = false;
  await syncCycle({ fs, store: a, ...instant, wait: async () => { if (!changed) { changed = true; fs.setFile(SYNC_FILE, canonical(makeFile(snap(profile('b')), 'b', 2))); } } });
  assert.deepEqual((await readSync(fs))!.file.stores.profiles.map(p => p.id), ['a', 'b']);
});
test('doppio possesso advisory: recupero dai DB intatti e limite con DB perso', async () => {
  async function race(loseB: boolean) {
    const fs = memoryOps(), a = createMemoryAiStores({ writerId: 'a', now: () => 10 }), b = createMemoryAiStores({ writerId: 'b', now: () => 10 });
    await a.saveProfile(profile('a')); await b.saveProfile(profile('b'));
    // Entrambi osservano il lock assente; la lettura di B riprende solo dopo che A l'ha verificato.
    const originalRead = fs.readFile, originalWrite = fs.writeFile, originalRemove = fs.removeEntry;
    let lockReads = 0, firstWrites = 0;
    let unblockB!: () => void, unblockA!: () => void;
    const bReadGate = new Promise<void>(r => { unblockB = r; });
    const aWriteGate = new Promise<void>(r => { unblockA = r; });
    fs.readFile = async path => {
      if (path === LOCK_FILE && ++lockReads <= 2) { if (lockReads === 2) await bReadGate; return null; }
      return originalRead(path);
    };
    fs.writeFile = async (path, data) => {
      if (path === SYNC_FILE) {
        const which = ++firstWrites;
        if (which === 1) { unblockB(); await aWriteGate; }
        await originalWrite(path, data);
        return;
      }
      return originalWrite(path, data);
    };
    fs.removeEntry = async (path, recursive) => { await originalRemove(path, recursive); if (path.endsWith('.part')) unblockA(); };
    // A e B partono insieme: A pubblica per ultimo e sovrascrive B dopo la sua verifica.
    await Promise.all([syncCycle({ fs, store: a, ...instant }), syncCycle({ fs, store: b, ...instant })]);
    fs.readFile = originalRead; fs.writeFile = originalWrite; fs.removeEntry = originalRemove;
    const replacementB = loseB ? createMemoryAiStores({ writerId: 'b-reset' }) : b;
    await syncCycle({ fs, store: a, ...instant }); await syncCycle({ fs, store: replacementB, ...instant }); await syncCycle({ fs, store: a, ...instant });
    const ids = (await readSync(fs))!.file.stores.profiles.map(p => p.id);
    assert.deepEqual(ids, loseB ? ['a'] : ['a', 'b']);
    const parts = fs.log.filter(l => l.startsWith('write ') && l.endsWith('.part')); assert.equal(new Set(parts).size, parts.length);
  }
  await race(false); await race(true);
});
test('crash dopo pubblicazione restore: il browser completa adozione al giro successivo', async () => {
  const fs = memoryOps(), a = createMemoryAiStores({ writerId: 'a', now: () => 10 });
  await a.saveProfile(profile('keep')); await syncCycle({ fs, store: a, ...instant });
  const source = await backup(fs, (await readSync(fs))!.text, 'a', 1);
  await a.saveProfile(profile('drop')); await syncCycle({ fs, store: a, ...instant });
  const replace = a.replaceSnapshot; a.replaceSnapshot = async () => { throw new Error('simulated crash'); };
  await assert.rejects(restoreBackup({ fs, store: a, ...instant }, source), /simulated crash/); a.replaceSnapshot = replace;
  assert.equal((await syncCycle({ fs, store: a, ...instant })).status, 'restored');
  assert.deepEqual((await a.load()).profiles.map(p => p.id), ['keep']);
});

test('URL non valide nel file sync: nessuna importazione né scrittura', async () => {
  for (const baseUrl of ['invalid', '', 'javascript:alert(1)', 'file:///tmp/file', 'https://name:password@example.com', 'https://example.com?token=private', 'https://example.com#private']) {
    const fs = memoryOps(), store = createMemoryAiStores({ writerId: 'a' });
    const value = makeFile(snap(profile()), 'remote', 1);
    value.stores.profiles[0].baseUrl = baseUrl;
    const text = canonical(value); fs.setFile(SYNC_FILE, text);
    await assert.rejects(syncCycle({ fs, store, ...instant }), /syncInvalid/);
    assert.equal(await fs.textOf(SYNC_FILE), text);
    assert.equal((await store.load()).profiles.length, 0);
    assert.equal(fs.log.length, 0);
  }
});
