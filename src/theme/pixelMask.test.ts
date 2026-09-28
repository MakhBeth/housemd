import test from 'node:test';
import assert from 'node:assert/strict';

import { CELL_PX, FRAME_COUNT, frameThresholds, gridFor, pixelFrames, revealOrder } from './pixelMask';

test('gridFor covers the window with 24px cells', () => {
  assert.deepEqual(gridFor(1000, 700), { cols: 42, rows: 30, cell: CELL_PX });
  assert.deepEqual(gridFor(0, 0), { cols: 1, rows: 1, cell: CELL_PX });
});

test('revealOrder is a permutation, deterministic for a seed', () => {
  const order = revealOrder(500, 7);
  assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: 500 }, (_, i) => i));
  assert.deepEqual(revealOrder(500, 7), order, 'stesso seed, stesso ordine');
  assert.notDeepEqual(revealOrder(500, 8), order, 'seed diverso, ordine diverso');
});

test('frameThresholds grows strictly and ends with every cell', () => {
  const thresholds = frameThresholds(1260);
  assert.equal(thresholds.length, FRAME_COUNT);
  for (let i = 1; i < thresholds.length; i++) assert.ok(thresholds[i] > thresholds[i - 1], `fotogramma ${i}`);
  assert.equal(thresholds.at(-1), 1260);
});

test('pixelFrames uncovers more cells each frame, never re-covers one, and uncovers all at the last frame', () => {
  const grid = gridFor(1000, 700);
  const frames = pixelFrames(grid, 42);
  assert.equal(frames.length, FRAME_COUNT);
  let previous = new Array<boolean>(grid.cols * grid.rows).fill(true);
  for (const visible of frames) {
    assert.equal(visible.length, grid.cols * grid.rows);
    const uncovered = visible.filter((v) => !v).length;
    assert.ok(uncovered > previous.filter((v) => !v).length, 'più celle scoperte del fotogramma prima');
    visible.forEach((v, i) => assert.ok(!(v && !previous[i]), `cella ${i} ricoperta`));
    previous = visible;
  }
  assert.ok(frames.at(-1)!.every((v) => !v), "all'ultimo fotogramma il vecchio tema è sparito");
});
