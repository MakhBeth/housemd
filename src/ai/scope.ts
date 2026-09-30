import type { ChangeDesc } from '@codemirror/state';
import type { SelectionScope } from './types';
export function mapScope(scope: SelectionScope, changes: ChangeDesc, reset = false): SelectionScope {
  if (reset || scope.status === 'lost') return { ...scope, status: 'lost' };
  let touched = false;
  changes.iterChangedRanges((from, to) => { if ((from < scope.to && to > scope.from) || (from === to && from > scope.from && from < scope.to)) touched = true; });
  return { ...scope, from: changes.mapPos(scope.from, 1), to: changes.mapPos(scope.to, -1), status: touched ? 'lost' : 'valid' };
}
export function applyScope(text: string, scope: SelectionScope, replacement: string): string | null {
  if (scope.status !== 'valid' || text.slice(scope.from, scope.to) !== scope.originalText) return null;
  return text.slice(0, scope.from) + replacement + text.slice(scope.to);
}
