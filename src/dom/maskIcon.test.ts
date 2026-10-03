import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { maskIcon } from './maskIcon';

test('an icon is a decorative span masked by the SVG, sized by --icon-size by default', () => {
  const span = maskIcon('/assets/close.svg');
  assert.equal(span.localName, 'span');
  assert.equal(span.className, 'icon');
  assert.equal(span.getAttribute('aria-hidden'), 'true');
  assert.equal(span.style.getPropertyValue('mask-image'), 'url("/assets/close.svg")');
  assert.equal(span.style.width, '');
  assert.equal(span.childNodes.length, 0);
});

test('size and className behave like the props of Icon.tsx', () => {
  const span = maskIcon('/assets/search.svg', { size: 16, className: 'searchIcon' });
  assert.equal(span.className, 'icon searchIcon');
  assert.equal(span.style.width, '16px');
  assert.equal(span.style.height, '16px');
});
