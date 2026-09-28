/**
 * Maschere della dissolvenza "a pixel" (puro): la finestra è divisa in celle da 24px che, in ordine
 * casuale ma deterministico, smettono di mostrare il vecchio tema, fotogramma dopo fotogramma.
 */

export const CELL_PX = 24;
export const FRAME_COUNT = 12;

export interface PixelGrid {
  cols: number;
  rows: number;
  cell: number;
}

export function gridFor(width: number, height: number, cell = CELL_PX): PixelGrid {
  return { cols: Math.max(1, Math.ceil(width / cell)), rows: Math.max(1, Math.ceil(height / cell)), cell };
}

/** Generatore pseudo-casuale deterministico (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ordine in cui le celle vengono scoperte (Fisher–Yates con seed). */
export function revealOrder(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  const next = random(seed);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Numero di celle scoperte alla fine di ogni fotogramma: crescente, l'ultimo vale `count`. */
export function frameThresholds(count: number, frames = FRAME_COUNT): number[] {
  return Array.from({ length: frames }, (_, i) => Math.round((count * (i + 1)) / frames));
}

/** Per ogni fotogramma, quali celle mostrano ancora il vecchio tema (true = opache nella maschera). */
export function pixelFrames(grid: PixelGrid, seed: number, frames = FRAME_COUNT): boolean[][] {
  const count = grid.cols * grid.rows;
  const order = revealOrder(count, seed);
  return frameThresholds(count, frames).map((uncovered) => {
    const visible = new Array<boolean>(count).fill(true);
    for (let k = 0; k < uncovered; k++) visible[order[k]] = false;
    return visible;
  });
}
