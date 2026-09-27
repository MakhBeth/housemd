/**
 * Icone di Pixelarticons: nome usato nell'interfaccia → URL dell'SVG (import `?url` di Vite).
 * Un nome che non è in questa mappa è un errore di TypeScript; `icons.test.ts` verifica che ogni
 * file SVG importato esista davvero nel pacchetto.
 */
import arrowBarLeft from 'pixelarticons/svg/arrow-bar-left.svg?url';
import arrowBarRight from 'pixelarticons/svg/arrow-bar-right.svg?url';
import chevronDown from 'pixelarticons/svg/chevron-down.svg?url';
import chevronRight from 'pixelarticons/svg/chevron-right.svg?url';
import circle from 'pixelarticons/svg/circle.svg?url';
import clock from 'pixelarticons/svg/clock.svg?url';
import close from 'pixelarticons/svg/close.svg?url';
import fileText from 'pixelarticons/svg/file-text.svg?url';
import folder from 'pixelarticons/svg/folder.svg?url';
import folderPlus from 'pixelarticons/svg/folder-plus.svg?url';
import invert from 'pixelarticons/svg/invert.svg?url';
import moon from 'pixelarticons/svg/moon.svg?url';
import moreHorizontal from 'pixelarticons/svg/more-horizontal.svg?url';
import plus from 'pixelarticons/svg/plus.svg?url';
import save from 'pixelarticons/svg/save.svg?url';
import search from 'pixelarticons/svg/search.svg?url';
import settingsCog from 'pixelarticons/svg/settings-cog.svg?url';
import sun from 'pixelarticons/svg/sun.svg?url';
import warningDiamond from 'pixelarticons/svg/warning-diamond.svg?url';

export const ICONS = {
  sidebarOpen: arrowBarRight,
  sidebarClose: arrowBarLeft,
  newFile: plus,
  newFolder: folderPlus,
  more: moreHorizontal,
  folder,
  folderClosed: chevronRight,
  folderOpen: chevronDown,
  file: fileText,
  draft: circle,
  search,
  settings: settingsCog,
  themeAuto: invert,
  themeLight: sun,
  themeDark: moon,
  history: clock,
  close,
  warning: warningDiamond,
  save,
} as const;

export type IconName = keyof typeof ICONS;
