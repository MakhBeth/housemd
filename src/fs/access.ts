/** Supporto del browser, scelta della cartella e permessi (File System Access API). */

type PermissionMode = { mode: 'read' | 'readwrite' };
type PermissionHandle = FileSystemHandle & {
  queryPermission(options: PermissionMode): Promise<PermissionState>;
  requestPermission(options: PermissionMode): Promise<PermissionState>;
};
type PickerWindow = Window & {
  showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker(options?: {
    id?: string;
    multiple?: false;
    excludeAcceptAllOption?: boolean;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle[]>;
};
type LaunchWindow = Window & {
  launchQueue?: { setConsumer(consumer: (params: { files: readonly FileSystemHandle[] }) => void): void };
};

/** Tipi accettati da «Apri un file» e da `file_handlers` del manifest (`vite.config.ts`). */
export const MARKDOWN_ACCEPT: Record<string, string[]> = { 'text/markdown': ['.md'] };

const READ_WRITE: PermissionMode = { mode: 'readwrite' };

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export const UNSUPPORTED_REASONS = ['ios', 'firefox', 'safari', 'other'] as const;
export type UnsupportedReason = (typeof UNSUPPORTED_REASONS)[number];

export function unsupportedReason(userAgent: string): UnsupportedReason {
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  if (/firefox/i.test(userAgent)) return 'firefox';
  if (/^((?!chrome|android).)*safari/i.test(userAgent)) return 'safari';
  return 'other';
}

/** C'è il selettore di file della File System Access API (si scrive sul file vero). */
export function canPickFileHandle(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/** Sceglie un file `.md` e chiede subito il permesso di scrittura (il clic dell'utente vale anche per quello). */
export async function pickFileHandle(): Promise<FileSystemFileHandle | null> {
  let handle: FileSystemFileHandle | undefined;
  try {
    [handle] = await (window as unknown as PickerWindow).showOpenFilePicker({ id: 'housemd-file', types: [{ accept: MARKDOWN_ACCEPT }] });
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
  if (!handle) return null;
  // Un rifiuto non impedisce di leggere: la prima scrittura passa dal dialog dell'accesso perso.
  await requestAccess(handle).catch(() => false);
  return handle;
}

/**
 * File aperti dal sistema con «Apri con… HouseMD» (PWA installata, `file_handlers`): il consumer riceve il primo
 * file. Senza `launchQueue` non succede niente.
 */
export function onLaunchFile(consumer: (handle: FileSystemFileHandle) => void): void {
  const queue = (window as LaunchWindow).launchQueue;
  queue?.setConsumer(({ files }) => {
    const file = files.find((handle): handle is FileSystemFileHandle => handle.kind === 'file');
    if (file) consumer(file);
  });
}

export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (window as unknown as PickerWindow).showDirectoryPicker({ id: 'housemd', mode: 'readwrite' });
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}

export async function hasAccess(handle: FileSystemHandle): Promise<boolean> {
  return (await (handle as PermissionHandle).queryPermission(READ_WRITE)) === 'granted';
}

export async function requestAccess(handle: FileSystemHandle): Promise<boolean> {
  return (await (handle as PermissionHandle).requestPermission(READ_WRITE)) === 'granted';
}
