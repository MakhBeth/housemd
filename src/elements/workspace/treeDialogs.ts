import { match } from 'ts-pattern';

import { dirname, joinPath } from '../../lib/paths';
import { renameTaken } from '../../ui/names';
import type { Workspace } from '../../workspace/workspace';
import { showConfirmDialog } from '../dialogs/confirmDialog';
import type { Translate } from '../dialogs/modal';
import { showNameDialog } from '../dialogs/nameDialog';
import type { DialogState } from './dialogFor';

export interface TreeDialogDeps {
  t: Translate;
  signal?: AbortSignal;
  /** Percorsi della cartella, letti alla conferma: il disco può cambiare a dialog aperto. */
  paths: () => readonly string[];
  workspace: Pick<Workspace, 'createFile' | 'createFolder' | 'rename' | 'remove'>;
}

/** Apre il dialog chiesto da `dialogFor` e, se confermato, esegue l'operazione sul workspace. */
export async function runTreeDialog(dialog: NonNullable<DialogState>, { t, signal, paths, workspace }: TreeDialogDeps): Promise<void> {
  const taken = t('name.error.taken');
  await match(dialog)
    .with({ kind: 'new-file' }, { kind: 'new-folder' }, async ({ kind, dir }) => {
      const exists = (path: string) => paths().some((p) => p.toLowerCase() === path.toLowerCase());
      const name = await showNameDialog({
        title: kind === 'new-file' ? t('file.new') : t('folder.new'),
        kind: kind === 'new-file' ? 'file' : 'directory',
        initial: '',
        confirmLabel: t('dialog.create'),
        validate: (n) => (exists(joinPath(dir, n)) ? taken : null),
        t,
        signal,
      });
      if (name === null) return;
      const path = joinPath(dir, name);
      await (kind === 'new-file' ? workspace.createFile(path) : workspace.createFolder(path));
    })
    .with({ kind: 'rename' }, async ({ node }) => {
      const to = (n: string) => joinPath(dirname(node.path), n);
      const name = await showNameDialog({
        title: t('dialog.rename.title', { name: node.name }),
        kind: node.kind === 'directory' ? 'directory' : 'file',
        initial: node.name,
        confirmLabel: t('dialog.rename.confirm'),
        validate: (n) => (renameTaken(node.path, to(n), paths()) ? taken : null),
        t,
        signal,
      });
      if (name !== null) await workspace.rename(node.path, to(name));
    })
    .with({ kind: 'delete' }, async ({ node }) => {
      const ok = await showConfirmDialog({
        title: t('dialog.delete.title', { name: node.name }),
        message: node.kind === 'directory' ? t('dialog.delete.folder') : t('dialog.delete.file'),
        confirmLabel: t('dialog.delete.confirm'),
        t,
        signal,
      });
      if (ok) await workspace.remove(node.path);
    })
    .exhaustive();
}
