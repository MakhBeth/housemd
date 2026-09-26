# HouseMD

Editor markdown nel browser per cartelle locali (File System Access API), stile HackMD. Nessun server.

## Browser Support

**Policy:** solo Chromium desktop recente (Chrome, Edge). Le feature supportate da Chromium stabile
(Popover, Anchor Positioning, `<dialog closedby>`, CSS Custom Highlight API, `light-dark()`,
File System Access API) si usano **senza polyfill e senza fallback**. Unica eccezione:
`Element.setHTML()` (Sanitizer API) va sempre usato con fallback a DOMPurify caricato dinamicamente.

## Regole

- Mai `innerHTML` / `dangerouslySetInnerHTML` con HTML non sanitizzato (vedi `src/preview/sanitize.ts`).
- Mai `alert()` / `confirm()` / `prompt()`: usare `<dialog>` con `showModal()` e `closedby="any"`.
- Solo `src/fs/fsaOps.ts` e `src/fs/access.ts` toccano la File System Access API.
- La logica va in moduli puri testati con `npm test` (`tsx --test`); i componenti React restano sottili.
- Testi UI in italiano, identificatori in inglese.
