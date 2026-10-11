import './domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { installPopoverStub } from './popoverStub';

installPopoverStub();

test('hidePopover on a detached, never-opened element returns quietly', () => {
  const el = document.createElement('div');
  assert.doesNotThrow(() => el.hidePopover());
});

test('showPopover on a detached element throws InvalidStateError', () => {
  const el = document.createElement('div');
  assert.throws(() => el.showPopover(), { name: 'InvalidStateError' });
});
