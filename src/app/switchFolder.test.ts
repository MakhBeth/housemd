import test from 'node:test';
import assert from 'node:assert/strict';

import { gate, harness, tick } from '../workspace/testing/harness';
import { switchFolder } from './switchFolder';

function fakeWorkspace(secured: boolean) {
  const calls: string[] = [];
  const current = {
    closeFile: async () => {
      calls.push('closeFile');
      return secured;
    },
    dispose: () => {
      calls.push('dispose');
    },
  };
  return { calls, current };
}

test('a picker error keeps the current workspace and its document untouched', async () => {
  const { calls, current } = fakeWorkspace(false);
  const result = await switchFolder({
    pick: async () => {
      throw Object.assign(new Error('selettore non disponibile'), { name: 'SecurityError' });
    },
    current,
    open: async () => 'nuova',
  });
  assert.deepEqual(result, { kind: 'error', detail: 'selettore non disponibile' });
  assert.deepEqual(calls, [], 'né closeFile né dispose: lo workspace resta visibile com’è');
});

test('cancelling the picker changes nothing', async () => {
  const { calls, current } = fakeWorkspace(true);
  assert.deepEqual(await switchFolder({ pick: async () => null, current, open: async () => 'nuova' }), { kind: 'cancelled' });
  assert.deepEqual(calls, []);
});

test('a document that cannot be secured blocks the switch before opening the new folder', async () => {
  const { calls, current } = fakeWorkspace(false);
  let opened = false;
  const result = await switchFolder({
    pick: async () => 'handle',
    current,
    open: async () => {
      opened = true;
      return 'nuova';
    },
  });
  assert.deepEqual(result, { kind: 'blocked' });
  assert.equal(opened, false);
  assert.deepEqual(calls, ['closeFile']);
});

test('if the new folder fails to open, the current workspace stays (not disposed)', async () => {
  const { calls, current } = fakeWorkspace(true);
  const result = await switchFolder({
    pick: async () => 'handle',
    current,
    open: async () => {
      throw new Error('EIO');
    },
  });
  assert.deepEqual(result, { kind: 'error', detail: 'EIO' });
  assert.deepEqual(calls, ['closeFile']);
});

test('a successful switch disposes the old workspace only after the new one is open', async () => {
  const { calls, current } = fakeWorkspace(true);
  const result = await switchFolder({
    pick: async () => 'handle',
    current,
    open: async (handle) => {
      calls.push(`open ${handle}`);
      return 'nuova';
    },
  });
  assert.deepEqual(result, { kind: 'opened', value: 'nuova' });
  assert.deepEqual(calls, ['closeFile', 'open handle', 'closeFile', 'dispose']);
});

/** Workspace vero in `off`, con l'apertura della cartella nuova ferma su un cancello. */
async function switchingFrom(secureAgain: boolean) {
  const h = await harness({ 'a.md': 'A', 'b.md': 'B' }, { autosave: { mode: 'off', delayMs: 1000 } });
  await h.ws.openFile('a.md');
  h.ws.edit('a modificato');
  const slow = gate();
  const discarded: string[] = [];
  const switching = switchFolder({
    pick: async () => 'handle',
    current: h.ws,
    open: async () => {
      await slow.wait;
      return 'nuova';
    },
    discard: (value) => {
      discarded.push(value);
    },
  });
  await tick(); // a.md messo al sicuro e chiuso; la cartella nuova si sta ancora aprendo
  assert.equal(h.ws.getState().doc, null);
  // Nel frattempo lo workspace vecchio è ancora usabile: l'utente apre un altro file e scrive.
  await h.ws.openFile('b.md');
  if (!secureAgain) {
    h.buffers.save = async () => {
      throw new Error('QuotaExceededError');
    };
  }
  h.ws.edit('scritto durante il cambio');
  slow.open();
  return { ...h, result: await switching, discarded };
}

test('a file opened and edited in the old workspace while the new folder opens is secured before disposal', async () => {
  const { buffers, ws, result, discarded } = await switchingFrom(true);
  assert.deepEqual(result, { kind: 'opened', value: 'nuova' });
  assert.deepEqual(discarded, []);
  assert.deepEqual(await buffers.load('ws-1', 'b.md'), { text: 'scritto durante il cambio', base: 'B' });
  assert.equal(ws.getState().doc, null);
});

test('if that late edit cannot be secured, the switch is abandoned and the new folder discarded', async () => {
  const { ws, result, discarded } = await switchingFrom(false);
  assert.deepEqual(result, { kind: 'blocked' });
  assert.deepEqual(discarded, ['nuova']);
  assert.equal(ws.getState().doc?.path, 'b.md', 'lo workspace vecchio resta, con il suo documento');
  assert.equal(ws.getState().doc?.text, 'scritto durante il cambio');
});

test('from the start screen (no workspace) a picker error is just reported', async () => {
  const result = await switchFolder({
    pick: async () => {
      throw new Error('x');
    },
    current: null,
    open: async () => 'nuova',
  });
  assert.deepEqual(result, { kind: 'error', detail: 'x' });
});

test('the new folder is persisted as current only when the switch succeeds', async () => {
  const persisted: string[] = [];
  const persist = (value: string) => {
    persisted.push(value);
  };

  const blocked = fakeWorkspace(false);
  await switchFolder({ pick: async () => 'handle', current: blocked.current, open: async () => 'nuova', persist });
  const failing = fakeWorkspace(true);
  await switchFolder({
    pick: async () => 'handle',
    current: failing.current,
    open: async () => {
      throw new Error('EIO');
    },
    persist,
  });
  await switchFolder({ pick: async () => null, current: fakeWorkspace(true).current, open: async () => 'nuova', persist });
  assert.deepEqual(persisted, [], 'bloccato, errore o annullato: la cartella corrente salvata resta quella vecchia');

  const ok = fakeWorkspace(true);
  const result = await switchFolder({
    pick: async () => 'handle',
    current: ok.current,
    open: async () => 'nuova',
    persist: (value) => {
      ok.calls.push(`persist ${value}`);
      persist(value);
    },
  });
  assert.deepEqual(result, { kind: 'opened', value: 'nuova' });
  assert.deepEqual(persisted, ['nuova']);
  assert.deepEqual(ok.calls, ['closeFile', 'closeFile', 'dispose', 'persist nuova']);
});

test('a late block after opening does not persist the discarded folder', async () => {
  const { result, discarded } = await switchingFromWithPersist();
  assert.deepEqual(result.kind, 'blocked');
  assert.deepEqual(discarded, ['nuova']);
});

async function switchingFromWithPersist() {
  let closes = 0;
  const persisted: string[] = [];
  const discarded: string[] = [];
  const result = await switchFolder({
    pick: async () => 'handle',
    current: {
      closeFile: async () => ++closes === 1, // la seconda messa al sicuro fallisce
      dispose: () => undefined,
    },
    open: async () => 'nuova',
    discard: (value) => {
      discarded.push(value);
    },
    persist: (value) => {
      persisted.push(value);
    },
  });
  assert.deepEqual(persisted, []);
  return { result, discarded };
}
