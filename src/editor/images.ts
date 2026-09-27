/** Solo le immagini tra i file incollati o trascinati. */
export function imageFiles<T extends { type: string }>(files: ArrayLike<T> | null | undefined): T[] {
  return files ? Array.from(files).filter((f) => f.type.startsWith('image/')) : [];
}

export function imageMarkdown(link: string, alt = ''): string {
  const target = /[\s()]/.test(link) ? `<${link}>` : link;
  return `![${alt}](${target})`;
}
