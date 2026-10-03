import { ICONS, type IconName } from '../ui/icons';
import { maskIcon, type IconOptions } from './maskIcon';

/**
 * Icona per nome (era <Icon> di React). Sottile di proposito: icons.ts importa gli SVG con `?url`, che
 * tsx non carica, quindi la logica sta in maskIcon.ts, testato.
 */
export function icon(name: IconName, options?: IconOptions): HTMLSpanElement {
  return maskIcon(ICONS[name], options);
}
