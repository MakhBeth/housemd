/** Solo le immagini tra i file incollati o trascinati. */
export function imageFiles<T extends { type: string }>(files: ArrayLike<T> | null | undefined): T[] {
  return files ? Array.from(files).filter((f) => f.type.startsWith('image/')) : [];
}

export function imageMarkdown(link: string, alt = ''): string {
  const target = /[\s()]/.test(link) ? `<${link}>` : link;
  return `![${alt}](${target})`;
}

/** L'editor in cui inserire i link: `key` identifica il documento aperto (il resetKey dell'editor). */
export interface ImageInsertTarget {
  key(): string;
  length(): number;
  insert(at: number, text: string): void;
}

/**
 * Salva le immagini una alla volta e inserisce il link di ciascuna a partire da `pos`. Se nel
 * frattempo l'editor è passato a un altro documento (o lo stesso è stato ricaricato), i link non
 * vengono inseriti: finirebbero nel file sbagliato, con un percorso relativo al file di partenza.
 */
export async function insertImageLinks<F>(
  files: readonly F[],
  pos: number,
  save: (file: F) => Promise<string | null>,
  target: ImageInsertTarget,
): Promise<void> {
  const key = target.key();
  let at = pos;
  for (const file of files) {
    const link = await save(file);
    if (target.key() !== key) return;
    if (!link) continue;
    at = Math.min(at, target.length());
    const text = `${imageMarkdown(link)}\n`;
    target.insert(at, text);
    at += text.length;
  }
}
