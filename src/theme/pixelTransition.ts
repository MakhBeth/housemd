import { FRAME_COUNT, gridFor, pixelFrames, type PixelGrid } from './pixelMask';

export const TRANSITION_MS = 450;

function maskUrl(ctx: CanvasRenderingContext2D, grid: PixelGrid, visible: boolean[]): string {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#000';
  visible.forEach((on, index) => {
    if (!on) return;
    ctx.fillRect((index % grid.cols) * grid.cell, Math.floor(index / grid.cols) * grid.cell, grid.cell, grid.cell);
  });
  return `url("${ctx.canvas.toDataURL('image/png')}")`;
}

/**
 * Cambia tema con una view transition in cui il vecchio tema (sopra, vedi global.css) viene
 * "mangiato" a blocchi. Senza View Transitions o con "riduci animazioni": cambio istantaneo.
 */
export async function pixelTransition(apply: () => void): Promise<void> {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof document.startViewTransition !== 'function' || reduce) {
    apply();
    return;
  }
  const transition = document.startViewTransition(apply);
  try {
    await transition.ready;
  } catch {
    return; // transizione saltata: il tema è comunque applicato
  }
  const grid = gridFor(window.innerWidth, window.innerHeight);
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols * grid.cell;
  canvas.height = grid.rows * grid.cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const full = new Array<boolean>(grid.cols * grid.rows).fill(true);
  const masks = [full, ...pixelFrames(grid, Date.now())].map((visible) => maskUrl(ctx, grid, visible));
  // mask-image si anima in modo discreto: un keyframe per fotogramma, ciascuno tenuto fermo fino al
  // successivo (steps(1, end)) — 12 scatti uguali in 450 ms, come steps(12, end) sull'intera durata.
  const keyframes = masks.map((maskImage, i) => ({
    offset: i / FRAME_COUNT,
    maskImage,
    maskSize: '100% 100%',
    easing: 'steps(1, end)',
  }));
  document.documentElement.animate(keyframes, {
    duration: TRANSITION_MS,
    fill: 'forwards',
    pseudoElement: '::view-transition-old(root)',
  });
}
