import type { EditorView } from '@codemirror/view';
import { pendingRestore, type RestoreCommand } from './restoreCommand';
/** Binding comune: una transazione, mai setState sull'editor posseduto da MergeView. */
export function applyDocRestore(view:EditorView,applied:number,command?:RestoreCommand|null):number{
 const pending=pendingRestore(applied,command);if(!pending)return applied;
 if(view.state.doc.toString()!==pending.textLf)view.dispatch({changes:{from:0,to:view.state.doc.length,insert:pending.textLf},userEvent:'input.restore'});
 return pending.seq;
}
