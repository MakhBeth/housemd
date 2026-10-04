/**
 * Hook di Node per `npm test` (registrato con --import, prima di qualsiasi import dei test): gli import
 * `…?url` di Vite diventano una stringa con il percorso, i fogli `.css` un modulo vuoto. Così gli elementi,
 * che importano icone (`dom/icon.ts` → `ui/icons.ts`) e il proprio foglio, si caricano in jsdom.
 */
import { registerHooks } from 'node:module';

const ASSET = 'housemd-asset:';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('?url')) return { url: ASSET + specifier.slice(0, -'?url'.length), shortCircuit: true };
    if (specifier.endsWith('.css')) return { url: `${ASSET}css`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === `${ASSET}css`) return { format: 'module', source: 'export {};', shortCircuit: true };
    if (url.startsWith(ASSET)) {
      return { format: 'module', source: `export default ${JSON.stringify(`/${url.slice(ASSET.length)}`)};`, shortCircuit: true };
    }
    return next(url, context);
  },
});
