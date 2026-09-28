export const NAME_ERRORS = ['empty', 'slash', 'dot'] as const;
export type NameError = (typeof NAME_ERRORS)[number];

/** Valida il nome scelto nel dialog; ai file senza estensione aggiunge ".md". */
export function validateName(name: string, kind: 'file' | 'directory'): { name: string } | { error: NameError } {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'empty' };
  if (/[/\\]/.test(trimmed)) return { error: 'slash' };
  if (trimmed.startsWith('.')) return { error: 'dot' };
  return { name: kind === 'file' && !/\.md$/i.test(trimmed) ? `${trimmed}.md` : trimmed };
}

/**
 * La rinomina di `from` in `to` andrebbe a sbattere contro un elemento esistente? Se cambia solo
 * maiuscole/minuscole conta solo un elemento con ESATTAMENTE il percorso `to` (su un file system
 * case-sensitive "a.md" e "A.md" sono due file distinti); altrimenti il confronto resta
 * case-insensitive, per non creare nomi che su macOS/Windows collidono.
 */
export function renameTaken(from: string, to: string, paths: readonly string[]): boolean {
  if (to === from) return false;
  if (to.toLowerCase() === from.toLowerCase()) return paths.includes(to);
  return paths.some((p) => p.toLowerCase() === to.toLowerCase());
}
