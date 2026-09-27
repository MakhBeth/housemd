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

export type ConfigProblem = { code: 'invalidJson'; detail: string } | { code: 'invalidSaveTo' } | { code: 'invalidLinkPrefix' };

export function parseConfig(text: string | null): { config: HouseConfig; problems: ConfigProblem[] } {
  if (text === null) return { config: DEFAULT_CONFIG, problems: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { config: DEFAULT_CONFIG, problems: [{ code: 'invalidJson', detail: (err as Error).message }] };
  }
  const problems: ConfigProblem[] = [];
  const images = (raw as { images?: Record<string, unknown> } | null)?.images ?? {};

  let saveTo = DEFAULT_CONFIG.images.saveTo;
  if (images.saveTo !== undefined) {
    if (typeof images.saveTo === 'string' && normalizePath(images.saveTo) !== '') saveTo = normalizePath(images.saveTo);
    else problems.push({ code: 'invalidSaveTo' });
  }

  let linkPrefix = DEFAULT_CONFIG.images.linkPrefix;
  if (images.linkPrefix !== undefined && images.linkPrefix !== null) {
    if (typeof images.linkPrefix === 'string' && images.linkPrefix.startsWith('/')) {
      linkPrefix = `/${normalizePath(images.linkPrefix)}`;
    } else {
      problems.push({ code: 'invalidLinkPrefix' });
    }
  }

  return { config: { images: { saveTo, linkPrefix } }, problems };
}
