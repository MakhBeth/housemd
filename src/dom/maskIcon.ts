import { el } from './el';

export interface IconOptions {
  /** Lato in pixel; senza, vale `--icon-size` (20px, global.css). */
  size?: number;
  className?: string;
}

/** Icona pixel art: l'SVG fa da maschera, il colore è `currentColor`. Sempre decorativa. Come Icon.tsx. */
export function maskIcon(url: string, { size, className }: IconOptions = {}): HTMLSpanElement {
  const span = el('span', { class: className ? `icon ${className}` : 'icon', 'aria-hidden': 'true' });
  span.style.setProperty('mask-image', `url("${url}")`);
  if (size) {
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
  }
  return span;
}
