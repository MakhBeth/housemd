import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { basename, stripMd } from '../lib/paths';
import type { DocTitle } from '../search/searchIndex';

const TYPED = /^[^[\]\n|#]*$/;

/** Autocompletamento dei wikilink: dopo "[[" propone i file della cartella. */
export function wikiCompletionSource(getDocs: () => DocTitle[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[[^[\]\n|#]*$/);
    if (!match) return null;
    const closed = context.state.sliceDoc(context.pos, context.pos + 2) === ']]';
    return {
      from: match.from + 2,
      validFor: TYPED,
      options: getDocs().map(({ path, title }) => {
        const label = stripMd(path);
        return {
          label,
          detail: title !== basename(label) ? title : undefined,
          apply: closed ? label : `${label}]]`,
          type: 'text',
        };
      }),
    };
  };
}
