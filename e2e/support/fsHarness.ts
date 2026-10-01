import type { Page } from '@playwright/test';

/**
 * Comportamento simulato del browser. Letto a OGNI chiamata da localStorage (chiave FLAGS_KEY):
 * i test lo cambiano al volo con App.setFlags, anche senza ricaricare la pagina.
 */
export interface HarnessFlags {
  /** false = browser senza File System Access (niente showDirectoryPicker). */
  picker: boolean;
  /** Sottocartella dell'OPFS restituita dal selettore. */
  folder: string;
  /** Risultato di queryPermission (avvio con cartella già nota). */
  query: PermissionState;
  /** Risultato di requestPermission (clic su "Riprendi accesso"). */
  request: PermissionState;
  /** createWritable fallisce con NotAllowedError: il browser ha revocato l'accesso. */
  denyWrites: boolean;
}

export const FLAGS_KEY = 'hmd-e2e';

export const DEFAULT_FLAGS: HarnessFlags = {
  picker: true,
  folder: 'notes',
  query: 'granted',
  request: 'granted',
  denyWrites: false,
};

/** Contenuto dei file di prova: testo, oppure byte in base64 (immagini). */
export type Seed = Record<string, string | { base64: string }>;

/** PNG 1×1 trasparente, per immagini di prova. */
export const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Eseguito nella pagina prima di qualsiasi script dell'app (page.addInitScript).
 * Deve essere autosufficiente: niente riferimenti a variabili di questo modulo.
 */
export function harnessScript({ defaults, key }: { defaults: HarnessFlags; key: string }): void {
  const flags = (): HarnessFlags => {
    try {
      return { ...defaults, ...(JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<HarnessFlags>) };
    } catch {
      return defaults;
    }
  };
  const win = window as unknown as Record<string, unknown>;
  if (!flags().picker) {
    delete win.showDirectoryPicker;
    delete (Window.prototype as unknown as Record<string, unknown>).showDirectoryPicker;
    return;
  }
  win.showDirectoryPicker = async () =>
    (await navigator.storage.getDirectory()).getDirectoryHandle(flags().folder, { create: true });
  const handleProto = FileSystemHandle.prototype as unknown as Record<string, unknown>;
  handleProto.queryPermission = async () => flags().query;
  handleProto.requestPermission = async () => flags().request;
  const createWritable = FileSystemFileHandle.prototype.createWritable;
  FileSystemFileHandle.prototype.createWritable = function (
    this: FileSystemFileHandle,
    ...args: Parameters<typeof createWritable>
  ) {
    if (flags().denyWrites) return Promise.reject(new DOMException('Accesso revocato (e2e)', 'NotAllowedError'));
    return createWritable.apply(this, args);
  };
}

/** Scrive i file nella cartella OPFS `folder`, creando le sottocartelle. Con denyWrites attivo fallisce. */
export async function seedFolder(page: Page, folder: string, files: Seed): Promise<void> {
  await page.evaluate(
    async ({ folder, files }) => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder, { create: true });
      for (const [path, content] of Object.entries(files)) {
        const parts = path.split('/');
        let dir = root;
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
        const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
        const writable = await handle.createWritable();
        await writable.write(
          typeof content === 'string' ? content : Uint8Array.from(atob(content.base64), (c) => c.charCodeAt(0)),
        );
        await writable.close();
      }
    },
    { folder, files },
  );
}

/** Contenuto testuale di un file della cartella OPFS, oppure null se non esiste. */
export async function readText(page: Page, folder: string, path: string): Promise<string | null> {
  return page.evaluate(
    async ({ folder, path }) => {
      try {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
        const parts = path.split('/');
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
        return await (await (await dir.getFileHandle(parts[parts.length - 1])).getFile()).text();
      } catch {
        return null;
      }
    },
    { folder, path },
  );
}

/** true se `path` (file o cartella) esiste nella cartella OPFS. */
export async function pathExists(page: Page, folder: string, path: string): Promise<boolean> {
  return page.evaluate(
    async ({ folder, path }) => {
      try {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
        const parts = path.split('/');
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
        const last = parts[parts.length - 1];
        for await (const name of dir.keys()) if (name === last) return true;
        return false;
      } catch {
        return false;
      }
    },
    { folder, path },
  );
}

/** Elimina un file o una cartella (ricorsivamente) dalla cartella OPFS, "fuori dall'app". */
export async function removePath(page: Page, folder: string, path: string): Promise<void> {
  await page.evaluate(
    async ({ folder, path }) => {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
      const parts = path.split('/');
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
      await dir.removeEntry(parts[parts.length - 1], { recursive: true });
    },
    { folder, path },
  );
}
