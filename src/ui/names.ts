/** Valida il nome scelto nel dialog; ai file senza estensione aggiunge ".md". */
export function validateName(name: string, kind: 'file' | 'directory'): { name: string } | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Il nome non può essere vuoto' };
  if (/[/\\]/.test(trimmed)) return { error: 'Il nome non può contenere / o \\' };
  if (trimmed.startsWith('.')) return { error: 'Il nome non può iniziare con un punto' };
  return { name: kind === 'file' && !/\.md$/i.test(trimmed) ? `${trimmed}.md` : trimmed };
}
