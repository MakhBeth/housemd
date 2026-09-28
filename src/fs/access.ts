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

export const UNSUPPORTED_REASONS = ['ios', 'firefox', 'safari', 'other'] as const;
export type UnsupportedReason = (typeof UNSUPPORTED_REASONS)[number];

export function unsupportedReason(userAgent: string): UnsupportedReason {
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  if (/firefox/i.test(userAgent)) return 'firefox';
  if (/^((?!chrome|android).)*safari/i.test(userAgent)) return 'safari';
  return 'other';
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
