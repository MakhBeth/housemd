import { ICONS, type IconName } from './icons';

interface Props {
  name: IconName;
  /** Lato in pixel; senza, vale `--icon-size` (20px). */
  size?: number;
  className?: string;
}

/** Icona pixel art: l'SVG fa da maschera, il colore è `currentColor`. Sempre decorativa (aria-hidden). */
export function Icon({ name, size, className }: Props) {
  return (
    <span
      className={className ? `icon ${className}` : 'icon'}
      style={{ maskImage: `url("${ICONS[name]}")`, ...(size ? { width: size, height: size } : {}) }}
      aria-hidden="true"
    />
  );
}
