import type { RefObject } from 'react';

import type { ReviewDoc } from '../ui/ai/reviewDoc';
import type { DocHost } from './docExtensions';
import type { Translate } from './formatToolbar';

/**
 * Ponte temporaneo: le props di DiffPane.tsx, lette dal ref a ogni uso, come DocHost.
 * Sparisce con DiffPane.tsx (fase 5b, Task 5).
 */
export function refDocHost(ref: RefObject<ReviewDoc & { t: Translate }>): DocHost {
  return {
    resetKey: () => ref.current.resetKey,
    readOnly: () => ref.current.readOnly,
    session: () => ref.current.session,
    t: () => ref.current.t,
    getDocs: () => ref.current.getDocs(),
    saveImage: (file) => ref.current.saveImage(file),
    docChanged: (changes, texts) => ref.current.docChanged(changes, texts),
    selectionChanged: (range) => ref.current.selectionChanged(range),
  };
}
