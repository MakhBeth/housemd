# LAB-417 — Modalità focus: typewriter sempre attivo e grigio al minimo AA

## Typewriter

In modalità focus la riga del cursore resta centrata qualunque sia l'impostazione. L'impostazione «Typewriter» vale fuori dal focus e la sua etichetta lo dice («sempre attivo in modalità focus»). Lo scorrimento di centratura di CodeMirror è istantaneo, quindi con `prefers-reduced-motion` non c'è animazione da disattivare.

## Grigio del testo fuori fuoco

Token `--c-focus-dim` (`src/styles/global.css`), calcolato sullo sfondo dell'editor `--c-surface`. Il testo in fuoco (`--c-text`) e forced-colors restano invariati. Il test `src/editor/focusContrast.test.ts` verifica 4.5 ≤ contrasto < 4.7.

| Tema | Sfondo | `--c-focus-dim` | Contrasto |
| --- | --- | --- | --- |
| Chiaro | `#ffffff` | `#7a756c` | 4.58:1 |
| Scuro | `#1e1e24` | `#888680` | 4.56:1 |

Prima si usava `--c-muted` (`#6b665c` / `#9a978f`), più contrastato. I temi sono solo chiaro e scuro (`light-dark()`).

## Riga attiva

Il velo della riga attiva (`--c-accent-soft` al 35%) porterebbe il grigio sotto 4.5:1 (4.38 chiaro, 3.86 scuro) sulle frasi attenuate della riga del cursore. In modalità focus la classe `cm-focusMode` sul root azzera quel velo, così il contrasto calcolato sulla superficie vale ovunque.
