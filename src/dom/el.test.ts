import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { el, setText, toggleAttr, type Props } from './el';

test('string children become text nodes, never HTML', () => {
  const p = el('p', null, '<b>x</b>');
  assert.equal(p.childNodes.length, 1);
  assert.equal(p.firstChild?.nodeType, Node.TEXT_NODE);
  assert.equal(p.querySelector('b'), null);
  assert.equal(p.textContent, '<b>x</b>');
});

test('children: numbers become text, nodes are appended, arrays are flattened, null/undefined/false are skipped', () => {
  const ul = el('ul', null, [el('li', null, 'a'), null, el('li', null, 'b')], undefined, false, 3);
  assert.deepEqual([...ul.childNodes].map((n) => n.textContent), ['a', 'b', '3']);
  assert.equal(ul.lastChild?.nodeType, Node.TEXT_NODE);
});

test('class, dataset and hyphenated names become attributes', () => {
  const button = el('button', { class: 'row active', dataset: { path: 'docs/a.md', skip: undefined }, 'aria-label': 'x', 'data-tooltip': 'y' });
  assert.equal(button.className, 'row active');
  assert.equal(button.dataset.path, 'docs/a.md');
  assert.equal('skip' in button.dataset, false);
  assert.equal(button.getAttribute('aria-label'), 'x');
  assert.equal(button.getAttribute('data-tooltip'), 'y');
});

test('names that exist on the element are set as properties', () => {
  const input = el('input', { value: 'abc', disabled: true, hidden: false });
  assert.equal(input.value, 'abc');
  assert.equal(input.getAttribute('value'), null);
  assert.equal(input.disabled, true);
  assert.equal(input.hasAttribute('hidden'), false);
});

test('undefined, null and false set no attribute; true sets an empty boolean attribute', () => {
  const div = el('div', { 'aria-describedby': undefined, 'data-a': null, 'data-b': false, 'data-c': true, popover: 'auto' });
  assert.equal(div.hasAttribute('aria-describedby'), false);
  assert.equal(div.hasAttribute('data-a'), false);
  assert.equal(div.hasAttribute('data-b'), false);
  assert.equal(div.getAttribute('data-c'), '');
  assert.equal(div.getAttribute('popover'), 'auto');
});

test('listeners in `on` are attached', () => {
  let clicks = 0;
  const button = el('button', { on: { click: () => clicks++ } });
  button.click();
  assert.equal(clicks, 1);
});

test('HTML from strings and inline handlers are refused', () => {
  for (const props of [{ innerHTML: '<img src=x>' }, { outerHTML: '<p>' }, { srcdoc: '<p>' }, { onclick: 'go()' }, { onClick: 'go()' }]) {
    assert.throws(() => el('div', props as unknown as Props), /non è ammesso/, JSON.stringify(props));
  }
});

test('setText and toggleAttr write only when the value changes', () => {
  const span = el('span', null, 'a');
  const observer = new MutationObserver(() => {});
  observer.observe(span, { attributes: true, childList: true, characterData: true, subtree: true });

  setText(span, 'a');
  toggleAttr(span, 'data-active', false);
  assert.equal(observer.takeRecords().length, 0);

  toggleAttr(span, 'aria-current', true, 'page');
  toggleAttr(span, 'aria-current', true, 'page');
  assert.equal(observer.takeRecords().length, 1);
  assert.equal(span.getAttribute('aria-current'), 'page');

  toggleAttr(span, 'aria-current', false);
  setText(span, 'b');
  assert.equal(span.hasAttribute('aria-current'), false);
  assert.equal(span.textContent, 'b');
  assert.ok(observer.takeRecords().length > 0);
  observer.disconnect();
});
