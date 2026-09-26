import { normalizePath } from '../lib/paths';

export const CONFIG_FILE = '.housemd.json';

export interface HouseConfig {
  images: {
    /** Cartella (relativa alla radice) dove salvare le immagini incollate. */
    saveTo: string;
    /** Prefisso dei link alle immagini (es. "/images"), mappato su saveTo. null = link relativi. */
    linkPrefix: string | null;
  };
}

export const DEFAULT_CONFIG: HouseConfig = { images: { saveTo: 'assets', linkPrefix: null } };

export function parseConfig(text: string | null): { config: HouseConfig; warning: string | null } {
  if (text === null) return { config: DEFAULT_CONFIG, warning: null };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { config: DEFAULT_CONFIG, warning: `${CONFIG_FILE} non valido: ${(err as Error).message}` };
  }
  const problems: string[] = [];
  const images = (raw as { images?: Record<string, unknown> } | null)?.images ?? {};

  let saveTo = DEFAULT_CONFIG.images.saveTo;
  if (images.saveTo !== undefined) {
    if (typeof images.saveTo === 'string' && normalizePath(images.saveTo) !== '') saveTo = normalizePath(images.saveTo);
    else problems.push('images.saveTo deve essere un percorso');
  }

  let linkPrefix = DEFAULT_CONFIG.images.linkPrefix;
  if (images.linkPrefix !== undefined && images.linkPrefix !== null) {
    if (typeof images.linkPrefix === 'string' && images.linkPrefix.startsWith('/')) {
      linkPrefix = `/${normalizePath(images.linkPrefix)}`;
    } else {
      problems.push('images.linkPrefix deve iniziare con "/"');
    }
  }

  return {
    config: { images: { saveTo, linkPrefix } },
    warning: problems.length > 0 ? `${CONFIG_FILE}: ${problems.join('; ')}` : null,
  };
}
