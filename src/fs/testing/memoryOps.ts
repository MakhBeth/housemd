import { basename, dirname, joinPath } from '../../lib/paths';
import type { FsOps, OpsDirEntry, StoredFile } from '../ops';

export interface MemoryOpsOptions {
  /** Espone `moveFile` (come Chromium con `FileSystemFileHandle.move`). */
  withMove?: boolean;
  /** Simula un file system case-insensitive (macOS/Windows). */
  caseInsensitive?: boolean;
  /** Fa fallire ogni scrittura il cui percorso soddisfa il predicato. */
  failWrite?: (path: string) => boolean;
}

export interface MemoryOps extends FsOps {
  files: Map<string, StoredFile>;
  dirs: Set<string>;
  log: string[];
  /** Simula una modifica esterna (vim, git pull…): nuovo contenuto e nuovo lastModified. */
  setFile(path: string, text: string): void;
  textOf(path: string): Promise<string | null>;
}

/** File system in memoria per i test. Mai usato in produzione. */
export function memoryOps(options: MemoryOpsOptions = {}): MemoryOps {
  const files = new Map<string, StoredFile>();
  const dirs = new Set<string>();
  const log: string[] = [];
  let clock = 1_000;

  const key = (path: string) => (options.caseInsensitive ? path.toLowerCase() : path);
  const findFile = (path: string) => [...files.keys()].find((p) => key(p) === key(path));
  const findDir = (path: string) => [...dirs].find((p) => key(p) === key(path));

  const ensureDirs = (dir: string) => {
    let current = '';
    for (const part of dir.split('/').filter(Boolean)) {
      current = joinPath(current, part);
      if (!findDir(current)) dirs.add(current);
    }
  };

  const ops: MemoryOps = {
    files,
    dirs,
    log,
    setFile(path, text) {
      ensureDirs(dirname(path));
      const existing = findFile(path);
      if (existing) files.delete(existing);
      files.set(path, { blob: new Blob([text]), lastModified: ++clock });
    },
    async textOf(path) {
      const f = files.get(path);
      return f ? f.blob.text() : null;
    },
    async readDir(dir) {
      if (dir !== '' && !findDir(dir)) return null;
      const d = dir === '' ? '' : findDir(dir)!;
      const out: OpsDirEntry[] = [];
      for (const p of dirs) if (dirname(p) === d) out.push({ name: basename(p), kind: 'directory' });
      for (const p of files.keys()) if (dirname(p) === d) out.push({ name: basename(p), kind: 'file' });
      return out;
    },
    async readFile(path) {
      const p = findFile(path);
      return p ? files.get(p)! : null;
    },
    async writeFile(path, data) {
      log.push(`write ${path}`);
      if (options.failWrite?.(path)) throw new Error(`ENOSPC write ${path}`);
      ensureDirs(dirname(path));
      const existing = findFile(path) ?? path;
      files.set(existing, { blob: typeof data === 'string' ? new Blob([data]) : data, lastModified: ++clock });
    },
    async mkdir(path) {
      log.push(`mkdir ${path}`);
      ensureDirs(path);
    },
    async removeEntry(path, recursive) {
      log.push(`remove ${path}`);
      const file = findFile(path);
      if (file) {
        files.delete(file);
        return;
      }
      const dir = findDir(path);
      if (!dir) return;
      const inside = (p: string) => p.startsWith(`${dir}/`);
      const hasChildren = [...files.keys()].some(inside) || [...dirs].some(inside);
      if (hasChildren && !recursive) throw new Error(`ENOTEMPTY ${path}`);
      for (const p of [...files.keys()]) if (inside(p)) files.delete(p);
      for (const p of [...dirs]) if (inside(p)) dirs.delete(p);
      dirs.delete(dir);
    },
    async exists(path) {
      if (path === '') return 'directory';
      if (findFile(path)) return 'file';
      if (findDir(path)) return 'directory';
      return null;
    },
  };

  if (options.withMove) {
    ops.moveFile = async (from, toName) => {
      log.push(`move ${from} ${toName}`);
      const src = findFile(from);
      if (!src) throw new Error(`ENOENT ${from}`);
      const stored = files.get(src)!;
      files.delete(src);
      files.set(joinPath(dirname(src), toName), stored);
    };
  }

  return ops;
}
