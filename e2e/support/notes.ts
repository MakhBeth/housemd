/** Nota di riferimento per snapshot e audit: frontmatter, titoli, enfasi, codice, wikilink, liste, citazione. */
export const NOTE = [
  '---',
  'title: Visual reference',
  'tags: [alpha, beta]',
  'date: 2026-01-15',
  '---',
  '# Heading',
  '',
  'Some *emphasis*, **strong**, `code` and a [[wikilink]].',
  '',
  '- one',
  '- two',
  '',
  '> a quote',
  '',
  '```ts',
  'const answer = 42;',
  '```',
].join('\n');

/** Data fissa: i tempi relativi della cronologia non cambiano tra un'esecuzione e l'altra. */
export const NOW = new Date('2026-10-01T10:00:00+02:00');
