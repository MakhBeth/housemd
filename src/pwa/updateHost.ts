import type { SettleResult, Workspace } from '../workspace/workspace';
import type { UpdateHost } from './updateFlow';

let active: Workspace | null = null;

/** Il Workspace aperto (null sulla schermata iniziale): è lui da mettere al sicuro prima del reload. */
export function setUpdateWorkspace(workspace: Workspace | null): void {
  active = workspace;
}

export const updateHost: UpdateHost = {
  prepare: () => (active ? active.beginUpdate() : Promise.resolve<SettleResult>('durable')),
  cancel: () => active?.endUpdate(),
  reload: () => window.location.reload(),
};
