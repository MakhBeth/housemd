/** Supporto del browser, scelta della cartella e permessi (File System Access API). */

type PermissionMode = { mode: 'read' | 'readwrite' };
type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission(options: PermissionMode): Promise<PermissionState>;
  requestPermission(options: PermissionMode): Promise<PermissionState>;
};
type PickerWindow = Window & {
  showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
};

const READ_WRITE: PermissionMode = { mode: 'readwrite' };

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function unsupportedMessage(userAgent: string): string {
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return 'HouseMD non funziona su iOS: tutti i browser usano il motore di Safari, che non permette di modificare cartelle locali.';
  }
  if (/firefox/i.test(userAgent)) {
    return 'HouseMD non funziona su Firefox, che non permette di modificare cartelle locali. Usa Chrome o Edge.';
  }
  if (/^((?!chrome|android).)*safari/i.test(userAgent)) {
    return 'HouseMD non funziona su Safari, che non permette di modificare cartelle locali. Usa Chrome o Edge.';
  }
  return 'HouseMD ha bisogno di un browser che permetta di modificare cartelle locali: usa Chrome o Edge su desktop.';
}

export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (window as unknown as PickerWindow).showDirectoryPicker({ id: 'housemd', mode: 'readwrite' });
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}

export async function hasAccess(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await (handle as PermissionHandle).queryPermission(READ_WRITE)) === 'granted';
}

export async function requestAccess(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await (handle as PermissionHandle).requestPermission(READ_WRITE)) === 'granted';
}
