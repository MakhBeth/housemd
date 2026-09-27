import { useSyncExternalStore } from 'react';

import type { Workspace, WorkspaceState } from '../workspace/workspace';

export function useWorkspaceState(workspace: Workspace): WorkspaceState {
  return useSyncExternalStore(workspace.subscribe, workspace.getState);
}
