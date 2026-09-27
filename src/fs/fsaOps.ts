/**
 * `FsOps` sulla File System Access API (solo Chromium desktop).
 * Non testabile in Node: la logica sta in `workspaceFS.ts`, testata con `memoryOps`.
 */
import { basename, dirname, splitPath } from '../lib/paths';
import type { FsOps, OpsDirEntry } from './ops';

interface MovableFileHandle extends FileSystemFileHandle {
  move(name: string): Promise<void>;
}

export function fsaSupportsMove(): boolean {
  return typeof FileSystemFileHandle !== 'undefined' && 'move' in FileSystemFileHandle.prototype;
}

const errorName = (err: unknown) => (err as { name?: string } | null)?.name;
const isNotFound = (err: unknown) => errorName(err) === 'NotFoundError';

export function fsaOps(root: FileSystemDirectoryHandle): FsOps {
  async function directory(path: string, create: boolean): Promise<FileSystemDirectoryHandle | null> {
    let handle = root;
    for (const part of splitPath(path)) {
      try {
        handle = await handle.getDirectoryHandle(part, { create });
      } catch (err) {
        if (!create && (isNotFound(err) || errorName(err) === 'TypeMismatchError')) return null;
        throw err;
      }
    }
    return handle;
  }

  async function fileHandle(path: string): Promise<FileSystemFileHandle | null> {
    const parent = await directory(dirname(path), false);
    if (!parent) return null;
    try {
      return await parent.getFileHandle(basename(path));
    } catch (err) {
      if (isNotFound(err) || errorName(err) === 'TypeMismatchError') return null;
      throw err;
    }
  }

  const ops: FsOps = {
    async readDir(path) {
      const dir = await directory(path, false);
      if (!dir) return null;
      const out: OpsDirEntry[] = [];
      for await (const [name, handle] of dir.entries()) out.push({ name, kind: handle.kind });
      return out;
    },

    async readFile(path) {
      const handle = await fileHandle(path);
      if (!handle) return null;
      const file = await handle.getFile();
      return { blob: file, lastModified: file.lastModified };
    },

    async writeFile(path, data) {
      const parent = (await directory(dirname(path), true))!;
      const handle = await parent.getFileHandle(basename(path), { create: true });
      const writable = await handle.createWritable();
      try {
        await writable.write(data);
        await writable.close();
      } catch (err) {
        await writable.abort().catch(() => undefined);
        throw err;
      }
    },

    async mkdir(path) {
      await directory(path, true);
    },

    async removeEntry(path, recursive) {
      const parent = await directory(dirname(path), false);
      if (!parent) return;
      try {
        await parent.removeEntry(basename(path), { recursive });
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    },

    async exists(path) {
      if (splitPath(path).length === 0) return 'directory';
      const parent = await directory(dirname(path), false);
      if (!parent) return null;
      // getFileHandle/getDirectoryHandle rispettano la (in)sensibilità alle maiuscole del sistema.
      try {
        await parent.getFileHandle(basename(path));
        return 'file';
      } catch (err) {
        if (errorName(err) === 'TypeMismatchError') return 'directory';
        if (isNotFound(err)) return null;
        throw err;
      }
    },
  };

  if (fsaSupportsMove()) {
    ops.moveFile = async (from, toName) => {
      const handle = (await fileHandle(from)) as MovableFileHandle | null;
      if (!handle) throw new DOMException(`Non trovato: ${from}`, 'NotFoundError');
      await handle.move(toName);
    };
  }

  return ops;
}
