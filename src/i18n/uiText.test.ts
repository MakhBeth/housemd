import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Tutti i .tsx sotto src/. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

const files = tsxFiles(fileURLToPath(new URL('..', import.meta.url)));

/** Testi scritti a mano nei componenti di v1: nessuno deve sopravvivere al passaggio a t(). */
const LEGACY = [
  'Salvato', 'Modifiche…', 'Salvataggio…', 'Errore di salvataggio', 'Eliminato su disco', 'Nessun file aperto',
  'Modalità di visualizzazione', 'Anteprima', 'Split', 'Nuovo file', 'Nuova cartella', "Apri un'altra cartella",
  'Apri cartella', 'Bozze senza file', 'Recupera la bozza', 'Larghezza della barra laterale', 'Nascondi barra laterale',
  'Mostra barra laterale', 'Scegli un file', 'Rinomina', 'Elimina', 'Crea', 'Annulla', 'Chiudi', 'Esiste già',
  'La cartella e tutto', 'Il file verrà eliminato', 'Accesso alla cartella perso', 'Il browser non permette',
  'Accesso non concesso', 'Riprendi accesso', 'Il file è cambiato su disco', 'Ricarica dal disco', 'Sovrascrivi',
  'Azioni per', 'Cartella vuota', 'Nessun file markdown', 'File della cartella', 'Cerca', 'Risultati della ricerca',
  'Nessun risultato', 'Scrivi markdown nel browser', 'Impossibile aprire la cartella', 'Frontmatter non valido',
  'Immagine non trovata',
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('no .tsx file contains the hand-written UI texts of v1', () => {
  const found: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const text of LEGACY) {
      // Il testo come stringa ('…', "…", `…`), come figlio JSX (>…) o da solo su una riga di JSX.
      const pattern = new RegExp(`(['"\`>]\\s*${escape(text)})|(^\\s*${escape(text)}\\s*$)`, 'm');
      if (pattern.test(source)) found.push(`${file}: ${text}`);
    }
  }
  assert.deepEqual(found, []);
});

test('no .tsx file has a literal aria-label, title, placeholder or alt with words in it', () => {
  const found: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\b(aria-label|title|placeholder|alt)="([^"]*)"/g)) {
      if (/\p{L}/u.test(match[2])) found.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(found, []);
});
