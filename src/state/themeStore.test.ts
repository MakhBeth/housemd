import test from 'node:test';
import assert from 'node:assert/strict';

import type { ThemePref } from '../theme/theme';
import { createThemeStore } from './themeStore';

function fakeDeps(initial: ThemePref = 'auto') {
  const log: string[] = [];
  let systemListener: (() => void) | null = null;
  return {
    log,
    fireSystemChange: () => systemListener?.(),
    hasSystemListener: () => systemListener !== null,
    deps: {
      initial,
      persist: (t: ThemePref) => log.push(`persist:${t}`),
      transition: (apply: () => void) => {
        log.push('transition:start');
        apply();
        log.push('transition:end');
      },
      apply: (t: ThemePref) => log.push(`apply:${t}`),
      watchSystem: (onChange: () => void) => {
        systemListener = onChange;
        return () => {
          systemListener = null;
        };
      },
    },
  };
}

test('setTheme saves first, then updates and notifies inside the transition, then applies', () => {
  const f = fakeDeps();
  const store = createThemeStore(f.deps);
  store.subscribe(() => f.log.push(`notify:${store.getState()}`));
  store.setTheme('dark');
  assert.deepEqual(f.log, ['persist:dark', 'transition:start', 'notify:dark', 'apply:dark', 'transition:end']);
  assert.equal(store.getState(), 'dark');
});

test('a system color change re-applies the current theme', () => {
  const f = fakeDeps('auto');
  const store = createThemeStore(f.deps);
  store.subscribe(() => {});
  f.fireSystemChange();
  assert.deepEqual(f.log, ['apply:auto']);
});

test('the system listener exists only while someone is subscribed (StrictMode mounts twice)', () => {
  const f = fakeDeps();
  const store = createThemeStore(f.deps);
  assert.equal(f.hasSystemListener(), false);
  const off1 = store.subscribe(() => {});
  const off2 = store.subscribe(() => {});
  assert.equal(f.hasSystemListener(), true);
  off1();
  assert.equal(f.hasSystemListener(), true);
  off2();
  assert.equal(f.hasSystemListener(), false);
  store.subscribe(() => {});
  assert.equal(f.hasSystemListener(), true);
});
