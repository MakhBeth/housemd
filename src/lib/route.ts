/**
 * Vista corrente indirizzata dall'hash: `''` → documento, `#settings[/<sezione>]` → impostazioni.
 * Niente router: l'hash non porta mai dati (percorsi, nomi, chiavi), solo la sezione.
 */
export const SETTINGS_SECTIONS = ['general', 'ai-profiles', 'ai-presets', 'ai-sync'] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export type Route = { view: 'workspace' } | { view: 'settings'; section: SettingsSection };

const isSection = (value: string): value is SettingsSection => (SETTINGS_SECTIONS as readonly string[]).includes(value);

export function parseRoute(hash: string): Route {
  const [head, section, ...rest] = hash.replace(/^#/, '').split('/');
  if (head !== 'settings') return { view: 'workspace' };
  if (section === undefined || rest.length > 0 || !isSection(section)) return { view: 'settings', section: 'general' };
  return { view: 'settings', section };
}

export function formatRoute(route: Route): string {
  if (route.view === 'workspace') return '';
  return route.section === 'general' ? '#settings' : `#settings/${route.section}`;
}
