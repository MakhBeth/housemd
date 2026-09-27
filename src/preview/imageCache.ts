/** Object URL per le immagini lette dalla cartella, con revoca di quelle non più usate. */
export class ImageUrlCache {
  private readonly urls = new Map<string, Promise<string | null>>();

  constructor(
    private readonly readBlob: (path: string) => Promise<Blob>,
    private readonly createUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
    private readonly revokeUrl: (url: string) => void = (url) => URL.revokeObjectURL(url),
  ) {}

  get(path: string): Promise<string | null> {
    let url = this.urls.get(path);
    if (!url) {
      url = this.readBlob(path).then(
        (blob) => this.createUrl(blob),
        () => {
          // Immagine mancante: non la teniamo in cache, così un file aggiunto dopo viene trovato.
          this.urls.delete(path);
          return null;
        },
      );
      this.urls.set(path, url);
    }
    return url;
  }

  async retain(paths: Iterable<string>): Promise<void> {
    const keep = new Set(paths);
    for (const [path, url] of [...this.urls]) {
      if (keep.has(path)) continue;
      this.urls.delete(path);
      const resolved = await url;
      if (resolved) this.revokeUrl(resolved);
    }
  }

  clear(): Promise<void> {
    return this.retain([]);
  }
}
