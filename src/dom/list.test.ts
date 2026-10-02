import '../testing/domEnv';

import test from 'node:test';
import assert from 'node:assert/strict';

import { el } from './el';
import { reconcileList } from './list';

interface Item {
  id: string;
  label: string;
}

const items = (...ids: string[]): Item[] => ids.map((id) => ({ id, label: id.toUpperCase() }));

function render(parent: Element, list: Item[], created: string[] = []): void {
  reconcileList(
    parent,
    list,
    (item) => item.id,
    (item) => {
      created.push(item.id);
      return el('li', null, el('button'));
    },
    (node, item) => {
      node.firstElementChild!.textContent = item.label;
    },
  );
}

const labels = (parent: Element) => [...parent.children].map((n) => n.textContent);

test('the first render creates every node in order and fills it with update', () => {
  const ul = el('ul');
  const created: string[] = [];
  render(ul, items('a', 'b', 'c'), created);
  assert.deepEqual(labels(ul), ['A', 'B', 'C']);
  assert.deepEqual(created, ['a', 'b', 'c']);
});

test('nodes are reused by key and updated, new keys are created, missing keys are removed', () => {
  const ul = el('ul');
  render(ul, items('a', 'b', 'c'));
  const [a, , c] = [...ul.children];
  const created: string[] = [];
  render(ul, [{ id: 'a', label: 'A2' }, { id: 'c', label: 'C' }, { id: 'd', label: 'D' }], created);
  assert.deepEqual(labels(ul), ['A2', 'C', 'D']);
  assert.equal(ul.children[0], a);
  assert.equal(ul.children[1], c);
  assert.deepEqual(created, ['d']);
});

test('reordering keeps the same nodes', () => {
  const ul = el('ul');
  render(ul, items('a', 'b', 'c'));
  const before = [...ul.children];
  render(ul, items('c', 'a', 'b'));
  assert.deepEqual(labels(ul), ['C', 'A', 'B']);
  assert.deepEqual([...ul.children], [before[2], before[0], before[1]]);
});

test('a focused node that is reused and does not move keeps the focus', () => {
  const ul = el('ul');
  document.body.append(ul);
  render(ul, items('a', 'b'));
  const button = ul.children[1].firstElementChild as HTMLButtonElement;
  button.focus();
  render(ul, items('x', 'a', 'b', 'y'));
  assert.equal(document.activeElement, button);
  ul.remove();
});

// jsdom non ha moveBefore: qui si prova solo che list.ts lo sceglie. Che il nodo spostato tenga il focus
// è una garanzia di Chromium, verificata end-to-end quando le liste diventano elementi (fase 6: albero e
// ricerca con il focus su una riga durante l'aggiornamento).
test('nodes out of place move with moveBefore when the connected parent has it', () => {
  const ul = el('ul');
  document.body.append(ul);
  render(ul, items('a', 'b', 'c'));
  const moved: string[] = [];
  Object.defineProperty(ul, 'moveBefore', {
    value(node: Element, ref: Node | null) {
      moved.push(node.textContent ?? '');
      ul.insertBefore(node, ref);
    },
  });
  render(ul, items('c', 'a', 'b'));
  assert.deepEqual(labels(ul), ['C', 'A', 'B']);
  assert.deepEqual(moved, ['C']);
  ul.remove();
});

test('a detached parent never uses moveBefore', () => {
  const ul = el('ul');
  const moved: unknown[] = [];
  Object.defineProperty(ul, 'moveBefore', { value: (node: Node) => moved.push(node) });
  render(ul, items('a', 'b'));
  render(ul, items('b', 'a'));
  assert.deepEqual(labels(ul), ['B', 'A']);
  assert.deepEqual(moved, []);
});

test('an empty list removes every node; a duplicate key is an error', () => {
  const ul = el('ul');
  render(ul, items('a', 'b'));
  render(ul, []);
  assert.equal(ul.children.length, 0);
  assert.throws(() => render(ul, items('a', 'a')), /chiave doppia "a"/);
});
