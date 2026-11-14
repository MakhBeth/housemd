/**
 * Apertura e salvataggio di un file singolo senza File System Access API (Firefox, Safari, Brave con l'API
 * spenta): `<input type="file">` per aprire, un download per salvare. Niente API dei file del sistema qui.
 */

/** Sceglie un file `.md` con il selettore classico; null se l'utente annulla. */
export function pickFileInput(doc: Document = document): Promise<File | null> {
  return new Promise((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = '.md,text/markdown';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

/** Scarica il contenuto con il nome del file: il browser lo mette nei download (mai sopra il file originale). */
export function downloadFile(name: string, blob: Blob, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  // Il download parte in modo asincrono: l'URL si libera dopo, non subito.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
