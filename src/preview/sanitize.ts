/**
 * Inserimento sicuro dell'HTML dell'anteprima.
 * Una cartella clonata da internet può contenere HTML malevolo e uno script in pagina
 * avrebbe accesso alla cartella aperta: l'HTML passa SEMPRE da qui.
 * Sanitizer API (`Element.setHTML`) se disponibile, altrimenti DOMPurify caricato al volo.
 */
export const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['data-ai-image', 'data-local-src'],
};

export interface Purifier {
  sanitize(html: string, config: typeof PURIFY_CONFIG): string;
}

export function sanitizeWith(purify: Purifier, html: string): string {
  return purify.sanitize(html, PURIFY_CONFIG);
}

interface SanitizerLike {
  removeElement(name: string): void;
  allowAttribute(name: string): void;
  allowElement(element: string | { name: string; attributes?: string[] }): void;
}

type SanitizerCtor = new () => SanitizerLike;
type MaybeSetHTML = Element & { setHTML?: (html: string, options?: { sanitizer: SanitizerLike }) => void };

/**
 * Sanitizer creato una sola volta (per costruttore) e riusato. Parte dalla configurazione
 * PREDEFINITA (allowlist sicura) e: toglie <style>/<form>; permette `class` (marcatori di riga
 * `hmd-l-N` per lo scroll sincronizzato, `wikilink`/`missing`, `language-*`) e <img> con i soli
 * attributi innocui, più <details>/<summary>. Il default di Chrome toglie class e <img>: senza
 * queste aggiunte lo scroll non si abbina e le immagini spariscono. Gli handler (onerror…) e gli URL
 * javascript: nei link restano esclusi dalla baseline sicura.
 * Un dizionario `{ removeElements }` da solo sarebbe invece una BLOCKLIST: mai usarlo.
 */
let cached: { ctor: SanitizerCtor; sanitizer: SanitizerLike } | null = null;

function getSanitizer(): SanitizerLike | null {
  const ctor = (globalThis as { Sanitizer?: SanitizerCtor }).Sanitizer;
  if (!ctor) return null;
  if (cached?.ctor === ctor) return cached.sanitizer;
  try {
    const s = new ctor();
    s.removeElement('style');
    s.removeElement('form');
    s.allowAttribute('class');
    s.allowAttribute('data-ai-image');
    s.allowAttribute('data-local-src');
    s.allowElement({ name: 'button', attributes: ['type', 'data-ai-image'] });
    s.allowElement({ name: 'img', attributes: ['src', 'alt', 'title', 'width', 'height', 'data-local-src'] });
    s.allowElement('details');
    s.allowElement('summary');
    cached = { ctor, sanitizer: s };
    return s;
  } catch {
    // API diversa da quella attesa: si passa a DOMPurify (vedi setSafeHTML).
    return null;
  }
}

let purifier: Promise<Purifier> | null = null;

export async function setSafeHTML(el: Element, html: string): Promise<void> {
  const target = el as MaybeSetHTML;
  const sanitizer = typeof target.setHTML === 'function' ? getSanitizer() : null;
  if (sanitizer) {
    target.setHTML!(html, { sanitizer });
    return;
  }
  // Senza un Sanitizer configurabile non si usa setHTML() nudo: la sua configurazione predefinita
  // toglierebbe classi e immagini. DOMPurify (PURIFY_CONFIG) le lascia e rimuove il resto.
  purifier ??= import('dompurify').then((m) => m.default as unknown as Purifier);
  let purify: Purifier;
  try {
    purify = await purifier;
  } catch (err) {
    // L'import dinamico è fallito: non tenere in cache una promise rifiutata, altrimenti ogni
    // chiamata successiva fallirebbe subito senza più ritentare il caricamento.
    purifier = null;
    throw err;
  }
  el.innerHTML = sanitizeWith(purify, html);
}
