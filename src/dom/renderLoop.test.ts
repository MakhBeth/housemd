import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { RenderLoop, type RenderLoopOptions } from './renderLoop';

test.afterEach(() => document.body.replaceChildren());

/** Un host collegato, un contatore delle passate e il loop; `pass` personalizza la passata. */
function setup(options: Partial<RenderLoopOptions> = {}, pass: (n: number) => void = () => {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const state = { ready: true, passes: 0, depth: 0, maxDepth: 0 };
  const loop: RenderLoop = new RenderLoop(host, {
    ready: () => state.ready && host.isConnected,
    render: () => {
      state.depth++;
      state.maxDepth = Math.max(state.maxDepth, state.depth);
      state.passes++;
      try {
        pass(state.passes);
      } finally {
        state.depth--;
      }
    },
    ...options,
  });
  return { host, state, loop };
}

test('one pass per update, none before the prerequisites', () => {
  const { state, loop } = setup();
  state.ready = false;
  loop.update();
  assert.equal(state.passes, 0);
  state.ready = true;
  loop.update();
  loop.update();
  assert.equal(state.passes, 2);
});

test('an update asked during a pass runs one more pass after it, never nested', () => {
  let loop!: RenderLoop;
  const ctx = setup({}, (n) => {
    if (n === 1) {
      loop.update();
      loop.update();
    }
  });
  loop = ctx.loop;
  loop.update();
  assert.equal(ctx.state.passes, 2);
  assert.equal(ctx.state.maxDepth, 1);
});

test('rendering is true only during the passes', () => {
  const seen: boolean[] = [];
  let loop!: RenderLoop;
  const ctx = setup({}, () => seen.push(loop.rendering));
  loop = ctx.loop;
  assert.equal(loop.rendering, false);
  loop.update();
  assert.deepEqual(seen, [true]);
  assert.equal(loop.rendering, false);
});

test('the prerequisites are checked before every pass: a pass that detaches the host is the last one', () => {
  let loop!: RenderLoop;
  const ctx = setup({}, (n) => {
    if (n === 1) {
      loop.update();
      ctx.host.remove();
    }
  });
  loop = ctx.loop;
  loop.update();
  assert.equal(ctx.state.passes, 1);
});

test('a pass that throws leaves the loop usable', () => {
  let fail = true;
  const ctx = setup({}, () => {
    if (fail) throw new Error('boom');
  });
  assert.throws(() => ctx.loop.update(), /boom/);
  assert.equal(ctx.loop.rendering, false);
  fail = false;
  ctx.loop.update();
  assert.equal(ctx.state.passes, 2);
});

test('the focus lost during the passes goes to the stable target, judged on the final DOM', () => {
  const scope = document.createElement('div');
  const doomed = document.createElement('button');
  const stable = document.createElement('button');
  scope.append(doomed);
  let loop!: RenderLoop;
  const ctx = setup({ focusScope: () => scope, refocus: () => stable.focus() }, (n) => {
    // Prima passata: il nodo con il focus sparisce e si chiede un'altra passata; la seconda aggiunge il bersaglio.
    if (n === 1) {
      doomed.remove();
      loop.update();
    } else scope.append(stable);
  });
  loop = ctx.loop;
  ctx.host.append(scope);
  doomed.focus();
  loop.update();
  assert.equal(ctx.state.passes, 2);
  assert.equal(document.activeElement, stable);
});

test('no refocus when the focus was elsewhere, when it stayed inside, or when the host went away', () => {
  const scope = document.createElement('div');
  const inside = document.createElement('button');
  const outside = document.createElement('button');
  scope.append(inside);
  let calls = 0;
  let detach = false;
  const ctx = setup({ focusScope: () => scope, refocus: () => calls++ }, () => {
    if (detach) {
      inside.remove();
      ctx.host.remove();
    }
  });
  ctx.host.append(scope);
  document.body.append(outside);
  outside.focus();
  ctx.loop.update();
  inside.focus();
  ctx.loop.update();
  assert.equal(calls, 0);
  detach = true;
  ctx.loop.update();
  assert.equal(calls, 0);
});
