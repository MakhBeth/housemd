import type { ChangeDesc } from '@codemirror/state';

import type { TextRange } from '../../ai/selectionChip';
import type { DocSession } from '../../editor/docSession';
import type { RestoreCommand } from '../../editor/restoreCommand';
import type { DocTitle } from '../../search/searchIndex';

/** Il documento aperto come lo riceve la revisione AI, per l'editor semplice e per il lato documento del diff. */
export interface ReviewDoc {
  path: string;
  text: string;
  resetKey: string;
  session: DocSession;
  restore: RestoreCommand | null;
  readOnly: boolean;
  getDocs(): DocTitle[];
  saveImage(file: File): Promise<string | null>;
  docChanged(changes: ChangeDesc, texts: { before: string; after: string }): void;
  selectionChanged(range: TextRange | null): void;
}
