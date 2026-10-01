/** Titolo della scheda del browser (puro): impostazioni o file aperto; altrimenti il nome dell'app. */
import { basename } from './paths';

export const APP_TITLE = 'HouseMD';
const SHORT = 'HMD';

export function pageTitle(view: { settings: boolean; filePath: string | null | undefined }, settingsLabel: string): string {
  if (view.settings) return `${SHORT} - ${settingsLabel}`;
  if (view.filePath) return `${SHORT} - ${basename(view.filePath)}`;
  return APP_TITLE;
}
