import { basename, dirname, isMarkdown, joinPath } from '../lib/paths';
import type { FsOps } from './ops';
import { FsExistsError, FsNotFoundError, type Entry, type Version, type WorkspaceFS } from './types';

export const SKIPPED_DIRS = new Set(['.git', 'node_modules']);

const skipDir = (name: string) => SKIPPED_DIRS.has(name) || name.startsWith('.');

const byPath = (a: Entry, b: Entry) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function createWorkspaceFS(ops: FsOps): WorkspaceFS {
  const versionOf = (file: { blob: Blob; lastModified: number }): Version => ({
    lastModified: file.lastModified,
    size: file.blob.size,
  });

  /** Scansione di una cartella: restituisce le Entry e se la cartella va mostrata. */
  async function scan(dir: string): Promise<{ entries: Entry[]; visible: boolean }> {
    const children = (await ops.readDir(dir)) ?? [];
    const entries: Entry[] = [];
    // Visibile se contiene (anche indirettamente) un .md o una cartella visibile, oppure se è vuota.
    let hasVisible = false;
    for (const child of children) {
      const path = joinPath(dir, child.name);
      if (child.kind === 'directory') {
        if (skipDir(child.name)) continue;
        const sub = await scan(path);
        if (sub.visible) {
          entries.push({ kind: 'directory', path }, ...sub.entries);
          hasVisible = true;
        }
      } else if (isMarkdown(child.name)) {
        const file = await ops.readFile(path);
        if (!file) continue;
        entries.push({ kind: 'file', path, version: versionOf(file) });
        hasVisible = true;
      }
    }
    return { entries, visible: hasVisible || children.length === 0 };
  }

  async function listFiles(dir: string): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    for (const child of (await ops.readDir(dir)) ?? []) {
      const path = joinPath(dir, child.name);
      if (child.kind === 'directory') {
        for (const [p, size] of await listFiles(path)) out.set(p, size);
      } else {
        const file = await ops.readFile(path);
        if (file) out.set(path, file.blob.size);
      }
    }
    return out;
  }

  async function copyTree(from: string, to: string): Promise<void> {
    await ops.mkdir(to);
    for (const child of (await ops.readDir(from)) ?? []) {
      const src = joinPath(from, child.name);
      const dst = joinPath(to, child.name);
      if (child.kind === 'directory') {
        await copyTree(src, dst);
      } else {
        const file = await ops.readFile(src);
        if (file) await ops.writeFile(dst, file.blob);
      }
    }
  }

  async function sameTree(from: string, to: string): Promise<boolean> {
    const a = await listFiles(from);
    const b = await listFiles(to);
    if (a.size !== b.size) return false;
    for (const [path, size] of a) {
      if (b.get(to + path.slice(from.length)) !== size) return false;
    }
    return true;
  }

  async function renameFile(from: string, to: string): Promise<void> {
    if (ops.moveFile) {
      try {
        await ops.moveFile(from, basename(to));
        return;
      } catch (err) {
        // 'move' in FileSystemFileHandle.prototype può essere vero pur non funzionando (es.
        // NotAllowedError su file locali in Chrome): si ripiega su copia + rimozione. Se il file
        // risulta proprio sparito, invece, non ha senso ritentare: si propaga subito.
        if ((err as { name?: string } | null)?.name === 'NotFoundError') throw err;
      }
    }
    const file = await ops.readFile(from);
    if (!file) throw new FsNotFoundError(from);
    await ops.writeFile(to, file.blob);
    await ops.removeEntry(from, false);
  }

  async function renameDirectory(from: string, to: string): Promise<void> {
    try {
      await copyTree(from, to);
      if (!(await sameTree(from, to))) throw new Error(`Copia incompleta di ${from}`);
    } catch (err) {
      await ops.removeEntry(to, true).catch(() => undefined);
      throw err;
    }
    await ops.removeEntry(from, true);
  }

  return {
    async list() {
      const { entries } = await scan('');
      return entries.sort(byPath);
    },

    async read(path) {
      const file = await ops.readFile(path);
      if (!file) throw new FsNotFoundError(path);
      return { text: await file.blob.text(), version: versionOf(file) };
    },

    async readBlob(path) {
      const file = await ops.readFile(path);
      if (!file) throw new FsNotFoundError(path);
      return file.blob;
    },

    async write(path, data) {
      await ops.writeFile(path, data);
      const file = await ops.readFile(path);
      if (!file) throw new FsNotFoundError(path);
      return { version: versionOf(file) };
    },

    async stat(path) {
      const file = await ops.readFile(path);
      return file ? versionOf(file) : null;
    },

    async mkdir(path) {
      if (await ops.exists(path)) throw new FsExistsError(path);
      await ops.mkdir(path);
    },

    async rename(from, to) {
      if (dirname(from) !== dirname(to)) throw new Error('La rinomina è possibile solo nella stessa cartella');
      if (from === to) return;
      const kind = await ops.exists(from);
      if (!kind) throw new FsNotFoundError(from);
      const caseOnly = from.toLowerCase() === to.toLowerCase();
      if (!caseOnly && (await ops.exists(to))) throw new FsExistsError(to);

      if (caseOnly) {
        // Su file system case-insensitive "to" risulta già esistente: passa da un nome temporaneo.
        const tmp = joinPath(dirname(from), `.housemd-rename-${Date.now()}-${basename(from)}`);
        if (kind === 'file') {
          await renameFile(from, tmp);
          await renameFile(tmp, to);
        } else {
          await renameDirectory(from, tmp);
          await renameDirectory(tmp, to);
        }
        return;
      }
      if (kind === 'file') await renameFile(from, to);
      else await renameDirectory(from, to);
    },

    async remove(path) {
      const kind = await ops.exists(path);
      if (!kind) return;
      await ops.removeEntry(path, kind === 'directory');
    },
  };
}
