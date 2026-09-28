import { createWorkspaceFS } from '../../fs/workspaceFS';
import { memoryOps, type MemoryOps, type MemoryOpsOptions } from '../../fs/testing/memoryOps';
import type { WorkspaceFS } from '../../fs/types';
import type { HistoryStore } from '../../history/historyStore';
import type { AutosaveSettings } from '../autosave';
import { memoryBufferStore, type BufferStore } from '../buffers';
import { Workspace, type Scheduler } from '../workspace';

/** Scheduler a tempo virtuale: i timer scattano solo con advance(), in ordine di scadenza. */
export interface ClockScheduler extends Scheduler {
  now(): number;
  pending(): number;
  advance(ms: number): void;
}

export function clockScheduler(): ClockScheduler {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { due: number; fn: () => void }>();
  return {
    set(fn, ms) {
      timers.set(++seq, { due: now + ms, fn });
      return seq;
    },
    clear(handle) {
      timers.delete(handle as number);
    },
    now: () => now,
    pending: () => timers.size,
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next: [number, { due: number; fn: () => void }] | null = null;
        for (const entry of timers) {
          if (entry[1].due <= target && (next === null || entry[1].due < next[1].due)) next = entry;
        }
        if (next === null) break;
        timers.delete(next[0]);
        now = next[1].due;
        next[1].fn();
      }
      now = target;
    },
  };
}

/** Lascia completare le promise in sospeso (scritture in memoria, lavori fire-and-forget…). */
export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

/** Cancello: un'operazione finta aspetta `wait` finché il test non chiama `open()`. */
export function gate(): { wait: Promise<void>; open: () => void } {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => (open = resolve));
  return { wait, open };
}

export interface HarnessOptions {
  ops?: MemoryOpsOptions;
  autosave?: AutosaveSettings;
  workspaceId?: string;
  now?: () => Date;
  /** Buffer di emergenza già popolato prima di load(). */
  buffers?: BufferStore;
  history?: HistoryStore;
}

export interface Harness {
  ops: MemoryOps;
  fs: WorkspaceFS;
  buffers: BufferStore;
  scheduler: ClockScheduler;
  ws: Workspace;
  history: HistoryStore | null;
}

export async function harness(files: Record<string, string>, options: HarnessOptions = {}): Promise<Harness> {
  const ops = memoryOps(options.ops);
  for (const [path, text] of Object.entries(files)) ops.setFile(path, text);
  const fs = createWorkspaceFS(ops);
  const buffers = options.buffers ?? memoryBufferStore();
  const scheduler = clockScheduler();
  const ws = new Workspace({
    fs,
    workspaceId: options.workspaceId ?? 'ws-1',
    name: 'test',
    buffers,
    scheduler,
    autosave: options.autosave,
    history: options.history,
    now: options.now ?? (() => new Date(2026, 8, 27, 14, 32, 5)),
  });
  await ws.load();
  return { ops, fs, buffers, scheduler, ws, history: options.history ?? null };
}
