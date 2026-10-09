import type { RefObject } from 'react';

import type { DocHost } from './docExtensions';
import type { EditorProps } from './Editor';
import type { Translate } from './formatToolbar';

/**
 * Ponte temporaneo: le props di Editor.tsx e DiffPane.tsx, lette dal ref a ogni uso, come DocHost.
 * Sparisce con DiffPane.tsx (fase 5b, Task 5).
 */
export function refDocHost(ref: RefObject<EditorProps & { t: Translate }>): DocHost {
  return {
    resetKey: () => ref.current.resetKey,
    readOnly: () => ref.current.readOnly ?? false,
    session: () => ref.current.session ?? null,
    t: () => ref.current.t,
    getDocs: () => ref.current.getDocs(),
    saveImage: (file) => ref.current.onImage(file),
    docChanged(changes, texts) {
      ref.current.onTransactions?.(changes, texts);
      ref.current.onChange(texts.after);
    },
    selectionChanged: (range) => ref.current.onSelection?.(range),
  };
}
